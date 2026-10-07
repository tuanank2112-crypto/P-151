"""Extra probe (handoff hints: new B-01 prefixes nho/xin/giup/thay, homographs ga/mau/roi/do; Q25 "xin cứu, nhà cháy").

Differential of the rule floor: the SAME safety code (unchanged since 82f01f0) with the base lexicon (2026-10-05.p0g,
read from the base worktree) versus the lexicon of HEAD (2026-10-05.p1d), on every labelled sentence plus a generated
corpus (polite/help prefixes x fire/short-circuit/electric/fall/blood cores x place), accented and unaccented.
A sentence whose level goes DOWN with the new lexicon is a regression of the floor (the Agent cannot fix it when the
model is down). Also listed: help-cry fire sentences that stay below EMERGENCY with the new lexicon (Q25)."""

import itertools
import sys
import unicodedata
from pathlib import Path

from common import DATA, out
import yaml
from src.maintenance.catalog import Lexicon
from src.maintenance.safety import assess

OLD_DIR = Path(sys.argv[1]) / "seed" / "maintenance_v1"
NEW_DIR = Path(__file__).resolve().parents[5] / "seed" / "maintenance_v1"
old = Lexicon.model_validate(yaml.safe_load((OLD_DIR / "lexicon.yaml").read_text(encoding="utf-8"))).safety
new = Lexicon.model_validate(yaml.safe_load((NEW_DIR / "lexicon.yaml").read_text(encoding="utf-8"))).safety
new_p0 = new.model_copy(update={"active_phases": ("P0",)})
ORDER = {"NONE": 0, "UNCLEAR": 1, "EMERGENCY": 2}


def fold(text):
    low = unicodedata.normalize("NFC", text).replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", low) if unicodedata.category(c) != "Mn")


corpus = set()
for name in ("safety_cases_p0.yaml", "safety_cases_p1.yaml"):
    doc = yaml.safe_load((DATA / name).read_text(encoding="utf-8"))
    for key, cases in doc.items():
        if isinstance(cases, list):
            corpus.update(c["text"] for c in cases if isinstance(c, dict) and "text" in c)
labelled = len(corpus)

PREFIXES = ["", "Nhờ ", "Xin ", "Giúp ", "Nhờ giúp ", "Xin giúp ", "Giúp em với, ", "Xin cứu, ", "Cứu với, ",
            "Nhờ ban quản lý xem gấp, ", "Thay bóng đèn ", "Thay đèn xong thì ", "Thấy ", "Xin báo ", "Nhờ thay đèn, "]
CORES = ["cháy", "cháy rồi", "nhà cháy", "cháy nhà", "đang cháy", "cháy to lắm", "cháy lan sang trần",
         "đèn cháy", "đèn cháy rồi bốc khói", "đèn cháy có lửa", "cháy đèn", "chập điện", "chập cháy",
         "chập điện tóe lửa", "bị điện giật", "điện giật người", "bị giật tê tay", "nổ to", "đèn nổ bốc khói",
         "đèn rơi xuống", "trần sắp sập", "có máu", "vết máu", "mùi gas", "mùi ga", "đổ hóa chất", "kim tiêm",
         "hộp điện nóng ran", "nước tràn vào tủ điện"]
PLACES = ["", " ở hành lang tầng 3 tòa S1", " hành lang tầng 3 tòa S1 ạ"]
for p, c, s in itertools.product(PREFIXES, CORES, PLACES):
    text = (p + c + s).strip()
    text = text[0].upper() + text[1:]
    corpus.add(text)
    corpus.add(fold(text))

down, down_p0, help_fire_low = [], [], []
for text in sorted(corpus):
    lo, ln, lp0 = (assess(text, lex).risk_level.value for lex in (old, new, new_p0))
    if ORDER[ln] < ORDER[lo]:
        down.append((lo, ln, text))
    if ORDER[lp0] < ORDER[lo]:
        down_p0.append((lo, lp0, text))
    low = fold(text).lower()
    if any(h in low for h in ("xin cuu", "cuu voi", "giup em voi")) and "chay" in low and ORDER[ln] < 2:
        help_fire_low.append((ln, text))

out(f"lexicon old={OLD_DIR} -> new={NEW_DIR}")
out(f"corpus: labelled={labelled} total={len(corpus)}")
out(f"level DOWN old(p0g) -> new(p1d, P0+P1): {len(down)}")
for row in down:
    out("  DOWN", row)
out(f"level DOWN old(p0g) -> new(p1d) with P1 switched off (P0 part only): {len(down_p0)}")
for row in down_p0[:40]:
    out("  DOWN-P0", row)
out(f"help-cry + 'cháy' sentences below EMERGENCY with the new lexicon (Q25): {len(help_fire_low)}")
for row in help_fire_low:
    out("  Q25", row)
out(f"RESULT corpus={len(corpus)} regressions={len(down)} regressions_p0_part={len(down_p0)} q25_low={len(help_fire_low)}")
raise SystemExit(1 if down else 0)
