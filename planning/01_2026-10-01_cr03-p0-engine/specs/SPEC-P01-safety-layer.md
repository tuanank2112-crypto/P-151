# SPEC-P01 — Tầng an toàn (bước 2b): bộ nhận diện thuần + từ vựng dữ liệu + guard LLM

| Trường | Giá trị |
|---|---|
| WP | WP3 (✅ R02) · WP3b (✅ R06) · **WP3c (🟠 worker — thiết kế phạm vi theo luật R1–R10 của judge, plan.md Q29, ĐÃ CHỐT)** |
| Nguồn | CR-03 §5.1 (2b), §5.2, §6.1–§6.3, §6.6 (B-01…B-04), §15 (bộ câu, "0 bỏ sót Bậc 1"), AC-01…AC-05, AC-08 (phần chạy lại), AC-18; Q06–Q09, Q11, Q24–Q29 |
| Hợp đồng từ vựng | [`01-CONTRACTS.md`](01-CONTRACTS.md) §5 (bản WP3c). Nguồn chân lý dữ liệu = `seed/maintenance_v1/lexicon.yaml`. [`LEXICON-P0.yaml`](LEXICON-P0.yaml), [`REF-safety-proto.py`](REF-safety-proto.py), [`SAFETY-CASES-P0.yaml`](SAFETY-CASES-P0.yaml) = **lịch sử WP3, đóng băng** — mô tả thuật toán cửa sổ 4 từ đã bị thay (§7.4); CẤM dùng làm thước đo WP3c |
| File được ghi (WP3c) | `src/maintenance/safety.py`, `src/maintenance/priority.py` (chỉ SPEC-P03 §1), `src/maintenance/catalog.py` (chỉ 01 §5), `seed/maintenance_v1/lexicon.yaml`, `tests/test_maintenance/test_safety.py`, `tests/test_maintenance/test_priority.py`, `tests/test_maintenance/data/safety_stop_sets_p0.yaml` (mới, `git add -f` theo Q21; `safety_cases_p0.yaml` KHÔNG sửa), `planning/01_2026-10-01_cr03-p0-engine/evidence/WP3c/*.txt`, file report. **Không** đụng `engine.py` (chữ ký `assess_with_llm` giữ nguyên — đã kiểm: engine chỉ gọi `assess_with_llm(text, self.lexicon.safety, self.safety_llm, self.llm_label)`, `engine.py:2032`), `models.py`, `views.py`, `rules.py`, `proposer.py`, `src/api/`, `src/web/`, `specs/`, `plan.md` |
| Bản đo của architect | `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\50fe2a3e-bc4a-4de2-bd98-02ab091c7e1d\scratchpad\arch3\` (`root2/` = bản cài đúng hợp đồng này; `rb.sh`, `stopsets_sim.py`, `dump_check.py`, `perf.py` = lệnh đo). Dùng để tái hiện mọi số ở §9 và TESTING §10–§11. **CẤM chép nguyên văn vào `src/`** (không qua ruff, không docstring theo quy ước; đọc tham khảo được) |

## 0. Luật WP3c → mục hợp đồng

| Luật (Q29) | Một câu | Mục |
|---|---|---|
| **R1** | Phủ định chỉ tính khi **cue + 0..2 token đệm** {`co, thay, bi, he, duoc, con`} kết thúc **đúng ngay trước span**, trong mệnh đề, cửa sổ **≤ 80 ký tự**; **hai cue liền ⇒ UNCLEAR**; MỘT hàm dùng chung safety + priority | §1 `scope_before`, §3.2.1, SPEC-P03 §1.1 |
| **R2** | Các match chồng nhau của CÙNG tín hiệu gộp thành một span, phán một lần | §3.3 `merge_spans` |
| **R3** | Cue chung **không chứa đối tượng**; cue chứa đối tượng NGƯỜI ("không ai", "không có ai"…) chỉ áp cho tín hiệu người (S-09) | §3.2.2 |
| **R4** | Kế thừa phủ định qua **hay/hoặc/lẫn**; **cấm** qua dấu phẩy/"và" | §3.2.3 |
| **R5** | Hedge **cùng luật R1** (đệm riêng); marker T2-02 chỉ khi đứng **SAU** tín hiệu và sau marker chỉ còn **tiểu từ** | §3.2.4, §3.2.5 |
| **R6** | B-01 chỉ khi phần trước (trong mệnh đề) thuộc **tập đóng** {danh từ đèn, vị trí, tầng/tòa, bị/đã/…, mã} và **≤ 20 token**; bỏ `non_lamp_electrical` | §3.5 |
| **R7** | Đồng tự xét theo **token CÓ dấu**, theo **từng pattern** | §3.3.1, §3.5.2 |
| **R8** | Ký tự vô hình = **Cf ∪ U+034F ∪ U+FE00–U+FE0F ∪ filler Hangul**; chạy **2 biến thể** (bỏ / thành khoảng trắng), **lấy max** | §3.1 |
| **R9** | "lửa / khói / máu / bất động" (dạng có dấu) nằm **ngoài mọi span** ⇒ `T2-03` (lưới Bậc 2) | §3.6.2 |
| **R10** | Từ vựng M14; "kẹt" chỉ với người/thang máy; loại "phòng/chữa cháy"; S-05 không khớp "chạy chậm/liên tục/thử…"; **24 KB < 1 s** | 01 §5.3, §3.11 |

**Làm rõ của architect (đều theo hướng AN TOÀN, không đổi Q29; mỗi điểm có số đo §9.3 và nằm trong Câu hỏi mở của report architect):**
- **A1** — R7 áp cho danh từ đèn của B-01 ở dạng **danh sách dương** (`benign_lamp_noun_forms`): "đến/đen/bông" không phải "đèn". Lỗ đo được trên bản thử judge + HEAD: `Cháy đến tầng 3 tòa SIM-A rồi` ⇒ NONE.
- **A2** — R5 marker: giữa tín hiệu (hoặc đầu mệnh đề của marker) và marker chỉ được có token nối trong `resolved_bridge_tokens` — không chủ ngữ khác chen giữa. Lỗ đo được trên bản thử judge (R5 theo chữ): `Có tia lửa tóe ra từ ổ cắm, đèn đã tắt.` ⇒ UNCLEAR `T2-02` (HEAD: EMERGENCY — hồi quy nếu cài R5 theo chữ).
- **A3** — R4 chỉ kế thừa khi vế trước "hay/hoặc/lẫn" chứa token nguy hiểm (`coordination_hazard_tokens`, lọc R7) — giữ `jx_coord` 0 lọt. Bản thử judge **chưa từng chạy R4**: `patch_proto.py` dòng 114 chứa byte `0x08` thay cho `\b` (đo `od -c`), regex không bao giờ khớp.
- **A4** — Từ vựng thêm ngoài danh sách Q29: cue `khong phai la`, `chang phai` (phủ định kép có "là"); cue người `chua thay ai, chua co ai, khong co nguoi, khong thay nguoi, khong thay co nguoi`; loại trừ `khoi thuoc, khoi huong, khoi nhang` (nguồn khói lành tính — cần để R9 giữ ngưỡng UNCLEAR ≤ 5/59 b_fp); `homograph_intended` cho pattern chắc nghĩa (`tia lua`, `ngat xiu`…).

## 1. Hợp đồng module `src/maintenance/safety.py` (WP3c)

```python
"""Tầng an toàn 2b (CR-BPTN-03 §6): luật cố định quyết định; LLM chỉ nâng mức (Q09).

Hàm thuần, không IO, không đọc đồng hồ, không gọi LLM trừ assess_with_llm. Nội dung ticket là DỮ LIỆU: chỉ so khớp
mẫu từ lexicon; mọi câu lệnh trong text không có hiệu lực (FR-SECURITY-001, AC-18).
"""
import re
import unicodedata
from bisect import bisect_left, bisect_right
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field

from src.maintenance.catalog import SafetyLexicon, compile_pattern
from src.maintenance.enums import DetectedBy, RiskLevel, SignalStatus
from src.maintenance.models import RiskSignal

SEVERITY: dict[SignalStatus, int] = {SignalStatus.ABSENT: 0, SignalStatus.UNCLEAR: 1, SignalStatus.PRESENT: 2}
LEAD = re.compile(r"^(co|thay|nghe thay|ngui thay|bi) ")   # giữ (WP3): span mở bằng từ dẫn ⇒ cửa sổ kết thúc SAU từ dẫn
SOFT_BREAKS = ",:()—–"                                      # giữ (WP3b): ngắt mệnh đề, vẫn là khoảng trắng trong norm
HARD_BREAKS = ".;!?"                                        # giữ: ngắt câu, giữ ký tự trong norm
HANGUL_FILLERS = frozenset({"\u115f", "\u1160", "\u3164", "\uffa0"})   # R8
DOWNGRADE_RULES = frozenset({"B-02", "B-02D", "T2-01", "T2-02"})       # rule hạ được chép sang T2-05 (§3.4)

Span = tuple[int, int]


def is_invisible(char: str) -> bool: ...                                                   # R8, §3.1
def normalize_with_map(text: str, *, invisible_as_space: bool = False) -> tuple[str, list[int]]: ...   # §3.1
def quote_of(text: str, index_map: list[int], start: int, end: int) -> str: ...             # §3.1 (giữ)


@dataclass(frozen=True)
class TextContext:
    text: str
    norm: str
    index: list[int]
    sentence_cuts: list[int]
    clause_cuts: list[int]

    def sentence(self, pos: int) -> Span: ...      # giữ (WP3b)
    def clause(self, pos: int) -> Span: ...        # giữ (WP3b)
    def original(self, start: int, end: int) -> str: ...   # [MỚI] R7/R9: chữ gốc CÓ dấu của norm[start:end] (§3.1)


def build_context(text: str, conjunctions: Sequence[str] = (), *, invisible_as_space: bool = False) -> TextContext: ...


@dataclass(frozen=True)
class Scope:
    cue_start: int     # vị trí trong norm của chữ đầu tiên của cue (đầu trích dẫn)
    double: bool       # R1: một cue khác (+ 0..max_fillers đệm) kết thúc ngay trước cue này ⇒ phủ định kép


def scope_before(ctx: TextContext, start: int, hi: int, cues: Sequence[str], fillers: Sequence[str], *,
                 max_fillers: int, max_chars: int) -> Scope | None: ...    # R1 — DÙNG CHUNG safety + priority (§3.2.1)
def merge_spans(spans: Sequence[Span]) -> list[Span]: ...                  # R2 (§3.3)


@dataclass(frozen=True)
class SafetyAssessment:                    # giữ
    risk_level: RiskLevel
    signals: tuple[RiskSignal, ...]        # đã gộp trùng theo (signal_id, status) — §3.7
    notes: tuple[str, ...] = ()
    proposer: str = "rules"                # "rules" | "rules+llm:<model_label>"


def assess(text: str, lexicon: SafetyLexicon) -> SafetyAssessment: ...                      # §3 (R8: hợp 2 biến thể)
def derive_risk_level(signals: Sequence[RiskSignal], lexicon: SafetyLexicon) -> RiskLevel: ...   # §3.8 (giữ)
# SignalJudgement, LLMSafetyAssessment, SafetyLLMClient, merge_llm, assess_with_llm: GIỮ NGUYÊN chữ ký và hành vi (§4)
```

- **XOÁ** (thiết kế WP3b, bị R1 thay): `TextContext.words_before`, `negation_spans`, `is_negated`, `WINDOW_CHARS`. CẤM giữ làm đường phụ/alias.
- Hàm nội bộ (tên khuyến nghị, không phải hợp đồng; test chỉ gọi hàm công khai): `_judge(lk, start, end, signal_id="")`, `_assess_hits(text, lexicon, invisible_as_space)`, `_Lookups`.
- `assess` là hàm **xác định** (cùng text + cùng lexicon ⇒ cùng kết quả): duyệt `lexicon.signals`/`components`/`tier2_net_roots` theo thứ tự khai báo.
- `scope_before` là hợp đồng công khai của R1: `priority.py` import nó (SPEC-P03 §1). Chữ ký trên là **từng chữ** — đổi tên/thứ tự tham số = đổi hợp đồng.

## 2. Dữ liệu: `seed/maintenance_v1/lexicon.yaml`

- Bản WP3c: **thay** các khoá theo 01 §5.2–§5.3 (bỏ 3 khoá, thêm 17 khoá, đổi 4 khoá, sửa pattern S-03/S-04/S-05/S-09). `lexicon_version: "2026-10-02.p0c"`.
- Ai sửa gì không chạm code: Trường (chủ rules/nhãn) thêm/bớt pattern, cue, đệm, tập đóng B-01, đồng tự, gốc lưới R9. Mỗi lần sửa phải chạy `tests/test_maintenance/test_safety.py` + bộ dừng TESTING §11 — đó là lưới an toàn của dữ liệu.
- Cột `scope` **không** được code dùng ở P0 (D12). CẤM lọc tín hiệu theo category trong 2b (2b chạy trước phân loại).

## 3. Thuật toán `assess` (WP3c)

### 3.0 Trình tự (mỗi biến thể R8 chạy TRỌN trình tự này; §3.7 hợp kết quả)
1. `ctx = build_context(text, lexicon.clause_conjunctions, invisible_as_space=v)`; `ctx.norm.strip() == ""` ⇒ không bản ghi nào.
2. `excluded` = span mọi match `ambiguous_exclusions`.
3. `benign` = span mọi match `benign_phrases` thoả `b01_ok` (§3.5.1).
4. Tín hiệu có `patterns` (§3.3) ⇒ bản ghi + `tier1` (span tín hiệu Bậc 1 PRESENT) + `anysig` (span mọi tín hiệu, MỌI status).
5. Thành phần + tổ hợp S-14/T2-05 (§3.4).
6. Bản ghi B-01 cho span `benign` không nằm trọn trong `tier1` (§3.5.3).
7. Từ nhiều nghĩa `ambiguous_terms` (§3.6.1).
8. Lưới Bậc 2 R9 (§3.6.2).

"Nằm trong" một tập span = mọi vị trí `[a, b)` đều được phủ (`_Coverage` bytearray của WP3b giữ nguyên).

### 3.1 Chuẩn hoá có bản đồ chỉ số + **R8**
- Duyệt từng ký tự gốc `text[i]` (giữ WP3b): `NFKC` → `lower()` → `đ→d` → `NFD` → bỏ ký tự loại `Mn`. Chuỗi ≥ 3 chữ cái giống nhau liên tiếp ⇒ một chữ (`index_map` trỏ ký tự cuối chuỗi). `.;!?` giữ nguyên (ngắt câu); `\n` ⇒ một khoảng trắng + ngắt câu; `,:()—–` ⇒ một khoảng trắng + ngắt mệnh đề; chữ/số giữ; mọi ký tự khác ⇒ MỘT khoảng trắng (gộp liên tiếp); bỏ khoảng trắng cuối. Liên từ `clause_conjunctions` (khớp nguyên từ) cắt mệnh đề ở cả hai đầu.
- **R8 — kiểm trên ký tự GỐC, TRƯỚC khi fold:** `is_invisible(c) ⇔ unicodedata.category(c) == "Cf" or c == "\u034f" or "\ufe00" <= c <= "\ufe0f" or c in HANGUL_FILLERS`.
  - Biến thể A (`invisible_as_space=False`, mặc định): ký tự vô hình **không sinh gì và không cắt chuỗi chữ** (`kh\u200bói` ⇒ `khoi`).
  - Biến thể B (`invisible_as_space=True`): ký tự vô hình ⇒ **một khoảng trắng** (cắt chuỗi chữ; KHÔNG phải ranh giới mệnh đề) (`có\u200bkhói` ⇒ `co khoi`).
  - `assess` luôn chạy A; chạy thêm B **khi và chỉ khi** `any(is_invisible(c) for c in text)`. Kết quả = §3.7 trên hợp bản ghi của các biến thể ⇒ `risk_level` = max mức hai biến thể (BẮT BUỘC test).
- `quote_of(text, index_map, a, b) = text[index_map[a] : index_map[b-1] + 1]` — **nguyên văn có dấu** (giữ). Bất biến (test trên mọi bộ câu): mọi `source_quote` (tách `" | "`) là chuỗi con của `text`, kể cả khi quote chứa ký tự vô hình.
- `TextContext.original(a, b) = " ".join(unicodedata.normalize("NFC", quote_of(text, index, a, b)).lower().split())`. Văn bản NFD: dấu của chữ CUỐI token có thể rơi khỏi lát cắt ⇒ `original` không khớp dạng có dấu nào ⇒ R7 giữ match, R9 không bắn — chiều an toàn, chấp nhận.
- Ví dụ: `"MÙI  KHÉT!!! Ở HÀNH LANG"` → `norm = "mui khet!!! o hanh lang"` (đo, giữ WP3b); `"có\u200bkhói"` → A: `"cokhoi"`, B (`invisible_as_space=True`): `"co khoi"` (đo).

### 3.2 Phán một span (`_judge`) — thứ tự cố định **B-02 (R1/R3/R4) > T2-01 (R5) > T2-02 (R5) > PRESENT**
Đầu vào: span `(start, end)` trên `norm`, `signal_id` (chuỗi rỗng cho thành phần §3.4, từ nhiều nghĩa §3.6.1, lưới R9 §3.6.2).
- `hi = start + LEAD.match(norm[start:end]).end() - 1` nếu span mở bằng từ dẫn, ngược lại `hi = start` (vd span `co khoi` ⇒ cửa sổ kết thúc sau `co`).
- Mọi kiểm cue (R1, R3, R4, R5) đều trên cửa sổ `W = norm[lo:hi]`, `lo = max(ctx.clause(start)[0], hi - scope_max_chars)` — **trong mệnh đề**, ≤ 80 ký tự, neo tại tín hiệu.

#### 3.2.1 R1 — `scope_before(ctx, start, hi, cues, fillers, *, max_fillers, max_chars)`
- Regex (compile một lần, cache theo `(tuple(cues), tuple(fillers), max_fillers)`):
  `(?:^|(?<=\s))(?P<cue>ALT(cues))(?:\s(?:ALT(fillers))){0,max_fillers}\s*$` với `ALT(xs) = "|".join(re.escape(x) for x in sorted(set(xs), key=len, reverse=True))` (dài trước). `fillers` rỗng hoặc `max_fillers == 0` ⇒ bỏ nhóm đệm.
- `m = regex.search(W)`; không khớp ⇒ `None`. Khớp ⇒ `Scope(cue_start = lo + m.start("cue"), double = W[:m.start("cue")].strip() != "" and regex.search(W[:m.start("cue")]) is not None)`.
- Phủ định trong safety: `cues = negation_prefixes` (+ R3), `fillers = negation_fillers` = `[co, thay, bi, he, duoc, con]`, `max_fillers = scope_max_fillers = 2`, `max_chars = scope_max_chars = 80`.
- Kết quả: `double` ⇒ `UNCLEAR`, `rule_id="B-02D"`; ngược lại `ABSENT`, `rule_id="B-02"`; quote = `quote_of(text, index, cue_start, end)`.
- Ví dụ (đo trên bản thử §9): `Không có khói ở hộp đèn.` ⇒ `S-04 ABSENT B-02 "Không có khói"` · `Không thấy có khói…` ⇒ `ABSENT "Không thấy có khói"` · `Không có điện có tia lửa ở hộp đèn.` ⇒ `S-02 PRESENT` (EMERGENCY — "điện" là đối tượng của cue, không phải đệm) · `Không phải không có khói.` ⇒ `S-04 UNCLEAR B-02D` · `"x " * 1000 + "không có khói"` ⇒ `ABSENT` (cửa sổ neo tại tín hiệu, không quét cả mệnh đề).

#### 3.2.2 R3 — cue chứa đối tượng
- `negation_prefixes` (cue chung) chỉ gồm từ phủ định + động từ/khung (`khong co`, `khong thay`, `khong co dau hieu`…) — **không chứa đối tượng** của tín hiệu.
- Cue chứa đối tượng NGƯỜI nằm ở `person_negation_cues`; chỉ khi `signal_id ∈ person_signal_ids` (P0: `[S-09]`) thì `cues = negation_prefixes + person_negation_cues`.
- Ví dụ: `Không ai bị thương nhưng kính … vỡ.` ⇒ `S-09 ABSENT "Không ai bị thương"` · `Không thấy ai có khói bốc ra từ hộp điện.` ⇒ `S-04 PRESENT` (cue người không áp cho S-04) · `Không ai biết có người bị thương.` ⇒ `S-09 PRESENT`.

#### 3.2.3 R4 — phối hợp hay/hoặc/lẫn (chỉ chạy khi R1 + R3 trả `None`)
- Regex trên `W`: `(?:^|(?<=\s))(?P<cue>ALT(negation_prefixes))(?:\s(?:ALT(negation_fillers))){0,scope_max_fillers}(?P<x>(?:\s[a-z0-9]+){1,3})\s(?:ALT(coordination_conjunctions))(?:\s(?:ALT(negation_fillers)))?\s*$` (chỉ cue CHUNG, không cue người).
- Chấp nhận **chỉ khi** vế `x` có ít nhất một token `t ∈ coordination_hazard_tokens` mà `ctx.original(token) ∉ homographs.get(t, ())` (A3 + R7). Chấp nhận ⇒ `Scope(cue_start = lo + m.start("cue"), double = <một cue của CÙNG tập cue R1 cho tín hiệu này (chung, + người nếu S-09) + 0..max_fillers đệm kết thúc ngay trước cue_start trong W>)` ⇒ kết quả như R1.
- **Cấm** qua phẩy/"và": `W` dừng ở ranh giới mệnh đề; validator 01 §5.4 bắt `va ∈ clause_conjunctions` và `coordination_conjunctions ∩ clause_conjunctions = ∅`.
- Ví dụ: `Không thấy khói hay tia lửa gì, …` ⇒ `S-02 ABSENT "Không thấy khói hay tia lửa"`, `S-04 ABSENT` (NONE) · `Không có điện hay tia lửa ở hộp đèn.` ⇒ `S-02 PRESENT` (vế trước không nguy hiểm) · `Không có khói, có tia lửa…` / `Không có khói và tia lửa…` ⇒ `S-02 PRESENT`.

#### 3.2.4 R5 — hedge (chỉ khi không phủ định)
- `h = scope_before(ctx, start, hi, hedges, hedge_fillers, max_fillers=scope_max_fillers, max_chars=scope_max_chars)`; `hedge_fillers = [co, thay, bi, la, nhu, dang]`. Có ⇒ `UNCLEAR`, `rule_id="T2-01"`, quote = `quote_of(text, index, h.cue_start, end)`. `h.double` bỏ qua.
- Hedge đứng SAU tín hiệu không tính (an toàn trước).
- Ví dụ: `Hình như có mùi khét ở hành lang…` ⇒ `S-01 UNCLEAR T2-01 "Hình như có mùi khét"` · `Hình như đang có khói…` ⇒ `UNCLEAR` · `Hình như mất điện có khói ở hộp đèn.` ⇒ `S-04 PRESENT` (EMERGENCY).

#### 3.2.5 R5 — marker "đã xảy ra và đã hết" (chỉ khi không phủ định, không hedge)
- Marker **hợp lệ** của câu `S = [s0, s1)`: match `resolved_markers` `(m0, m1)` nằm trong `S` sao cho mọi token `[a-z0-9]+` của `norm[m1:s1]` ∈ `final_particles` (sau marker chỉ còn tiểu từ, kể cả không còn gì). Tính một lần mỗi câu (vị trí cuối của token không phải tiểu từ cuối câu).
- Với span `(start, end)` trong câu `S`: duyệt marker hợp lệ theo `m0` tăng dần với `end <= m0 < s1`; chọn marker ĐẦU TIÊN thoả **A2**: `gap = norm[max(end, ctx.clause(m0)[0]) : m0]` dài ≤ `scope_max_chars` và mọi token của `gap` ∈ `resolved_bridge_tokens`. Có ⇒ `UNCLEAR`, `rule_id="T2-02"`, quote = `quote_of(text, index, start, m1)`.
- Marker đứng TRƯỚC tín hiệu không tính (kể cả cùng mệnh đề). Mốc quá khứ đơn thuần ("hôm qua") KHÔNG hạ (D4).
- Ví dụ: `Hôm qua đèn tầng 2 tòa SIM-B có tia lửa, giờ hết rồi.` ⇒ `S-02 UNCLEAR T2-02 "tia lửa, giờ hết rồi"` · `Có khói bốc ra từ hộp điện, giờ hết rồi` ⇒ `UNCLEAR` · `Có tia lửa tóe ra từ ổ cắm, đèn đã tắt.` ⇒ `EMERGENCY` (A2: "đèn" chen giữa) · `Có khói …, đã ổn chưa?` ⇒ `EMERGENCY` ("chua" không phải tiểu từ) · `Em đã tắt cầu dao tổng có khói bốc ra từ tủ điện` ⇒ `EMERGENCY` (marker đứng trước).
- Không khớp gì ở 3.2.1–3.2.5 ⇒ `PRESENT`, `rule_id = None` (người gọi đặt `signal_id`), quote = span.

### 3.3 Tín hiệu có `patterns` (chỉ `phase ∈ active_phases`) — R7 rồi R2
Với mỗi `SignalDef` có `patterns` (thứ tự khai báo):
1. `raw` = span mọi match của mọi pattern trên `norm`, **bỏ** match bị R7 loại (§3.3.1, khoá = chính chuỗi pattern).
2. **R2** `merge_spans(raw)`: sắp theo `(start, end)`; span có `start < end` của span trước (chồng thật) ⇒ gộp thành `(start_trước, max(end_trước, end))`; span chỉ chạm nhau (`start == end_trước`) KHÔNG gộp.
3. Mỗi span đã gộp: `anysig += span`; `status, quote, rule = _judge(lk, a, b, signal.signal_id)`; `rule_id = rule or signal_id`.
4. **B-04** chỉ cho `S-01` (giữ WP3b, Q25.4): `PRESENT` và câu chứa span có ngữ cảnh nấu ăn (`khet_benign_contexts` trên norm, hoặc `khet_benign_contexts_accented` trên văn bản gốc chữ thường NFC) **và không** có `khet_electric_contexts` ⇒ `UNCLEAR`, `rule_id="B-04"`.
5. Tín hiệu Bậc 1 `PRESENT` ⇒ `tier1 += span`. Ghi `RiskSignal(signal_id, status, quote, detected_by=RULE, rule_id)`.
- Ví dụ R2: `Không có khói đen bốc ra từ hộp điện.` ⇒ `co khoi` + `khoi den` gộp `co khoi den` ⇒ một bản ghi `S-04 ABSENT B-02 "Không có khói đen"`.

#### 3.3.1 R7 — đồng tự theo token CÓ dấu, theo pattern
- `homograph_drop(a, b, pattern)`: với mỗi token `t` (`[a-z]+`) của `norm[a:b]`: `forms = homographs.get(t)`; nếu `forms` và `orig = ctx.original(token)` ∈ `forms` và `orig ∉ homograph_intended.get(pattern, {}).get(t, ())` ⇒ **loại cả match**.
- Áp cho: pattern tín hiệu (§3.3); `ambiguous_terms` (§3.6.1, khoá = chuỗi pattern); token nguy hiểm R4 (§3.2.3, không `intended`). KHÔNG áp cho `components` (S-14/T2-05), cue, đệm, hedge, marker.
- Văn bản không dấu ⇒ `orig == t` ∉ `forms` ⇒ **giữ** match (chiều an toàn).
- Ví dụ: `Nước chảy lan ra sảnh…` ⇒ `chay lan` bị loại (`chảy`) ⇒ NONE · `Cư dân có lựa chọn…` ⇒ NONE · `Có người bị chảy máu…` ⇒ `S-09 PRESENT` (`chay mau` intended `chảy`) · `Hành lang … đầy khói` ⇒ `S-04 PRESENT` (`day khoi` intended `đầy`) · `Có tia lừa ở ổ cắm` (gõ sai dấu) ⇒ `S-02 PRESENT` (`tia lua` intended mọi dạng của `lua`).

### 3.4 Thành phần và tổ hợp (`components`, `all_of`, `any_of`) — giữ WP3
- Mỗi `component_id`: trạng thái tốt nhất (max `SEVERITY`) trong các match của nó (`_judge` với `signal_id=""`), kèm quote và rule.
- `all_of` (S-14): **mọi** thành phần `PRESENT` ⇒ `S-14 PRESENT`, `source_quote = " | ".join(quote từng thành phần theo thứ tự all_of)`, `rule_id="S-14"`; coi toàn văn bản là span Bậc 1.
- `any_of` (T2-05): không đủ all_of và có thành phần `PRESENT`/`UNCLEAR` ⇒ `T2-05` status = max, quote thành phần đó, `rule_id` = rule hạ nếu ∈ `DOWNGRADE_RULES`, ngược lại `"T2-05"`.

### 3.5 B-01 lành tính — **R6** + **R7 (A1)**
#### 3.5.1 `b01_ok(c0, p, e)` — ứng viên `[p, e)`, `c0 = ctx.clause(p)[0]`
- (a) **≤ `b01_max_prefix_tokens` (20) token** trong `norm[c0:p]`; đếm bằng mảng vị trí token dựng MỘT lần + `bisect` (O(log n)); vượt ⇒ `False` trước khi tách token.
- (b) **Tập đóng**: các token của `norm[c0:p]` phân rã được (trái → phải) thành dãy phần tử, mỗi phần tử là một cụm (khớp nguyên token) thuộc `benign_lamp_nouns ∪ b01_prefix_words`, hoặc MỘT token khớp `re.fullmatch(b01_code_token_regex, token)`. Kiểm bằng quy hoạch động trên token (O(số token × độ dài cụm dài nhất)); **CẤM** regex lặp có thể backtrack.
- (c) Có **danh từ đèn đã chứng minh** (§3.5.2) trong `norm[c0:e)` (tiền tố hoặc chính ứng viên) HOẶC bắt đầu đúng tại token ngay sau `e`.
- Tiền tố rỗng hợp lệ (ứng viên đứng đầu mệnh đề).
#### 3.5.2 Danh từ đèn đã chứng minh (R7 dạng DƯƠNG — A1)
- Ứng viên danh từ đèn = match regex `\b(?:ALT(benign_lamp_nouns))\b` (`finditer(norm, c0, e)` cho tiền tố + ứng viên; `match(norm, after)` cho token sau, `after = e + 1` nếu `norm[e] == " "`).
- Hợp lệ khi với **mọi** token `t` của match có khoá trong `benign_lamp_noun_forms`: `ctx.original(token) ∈ benign_lamp_noun_forms[t]`. Token không có khoá (vd `led`) luôn hợp lệ.
- Hệ quả (đo): `Cháy đến tầng 3 tòa SIM-A rồi` ⇒ `T2-03 PRESENT B-03` (UNCLEAR, không NONE) · `Cháy đen hết tường…` ⇒ UNCLEAR · `Bông bị cháy ở hành lang` ⇒ UNCLEAR · văn bản **không dấu** `Bong den hanh lang tang 3 bi chay` ⇒ UNCLEAR (vùng cấm P1-11).
#### 3.5.3 Ghi bản ghi
- Span `benign_phrases` thoả `b01_ok` và không nằm trọn trong `tier1` ⇒ `T2-03 ABSENT`, `rule_id="B-01"`, quote = span; mỗi span một lần. Ví dụ `Nổ bóng đèn…` ⇒ quote `"Nổ bóng"`; `Đèn hành lang … chập chờn.` ⇒ `"chập chờn"`.
- `ambiguous_terms` match có `norm[a:b] ∈ benign_with_lamp_noun` và `b01_ok(c0, a, b)` ⇒ `T2-03 ABSENT B-01`, quote = `quote_of(text, index, q0, b)`, `q0 = c0 + (1 if norm[c0] == " " else 0)`. Ví dụ `Bóng đèn hành lang tầng 3 tòa SIM-A bị cháy.` ⇒ `"Bóng đèn hành lang tầng 3 tòa SIM-A bị cháy"`.
- Biên R6 (đo): tiền tố 20 token ⇒ NONE; 21 token ⇒ UNCLEAR (câu cụ thể: TESTING §4.1 `test_b01_closed_prefix_twenty_tokens_and_lamp_accent`).
- `non_lamp_electrical` **XOÁ**: ổ cắm/hộp điện/thùng rác/rèm… tự rơi khỏi tập đóng.

### 3.6 Từ nhiều nghĩa (B-03 → T2-03) và lưới Bậc 2 (R9)
#### 3.6.1 `ambiguous_terms`
Với mỗi pattern (thứ tự khai báo), mỗi match `(a, b)`:
1. Bỏ qua nếu nằm trọn trong `tier1`, `excluded`, `benign`, hoặc bị R7 loại (§3.3.1).
2. B-01 theo §3.5.3 nếu `norm[a:b] ∈ benign_with_lamp_noun` và `b01_ok`.
3. Ngược lại `_judge(lk, a, b)` ⇒ `T2-03` với status/quote, `rule_id` = rule hạ nếu có, ngược lại `"B-03"`.
Hệ quả B-03 của CR-03 ("chỉ lên Bậc 1 khi đi cùng khói/lửa/mùi khét…") tự thoả qua §3.8.
#### 3.6.2 **R9** — lưới Bậc 2
- Với mỗi `(root, forms)` của `tier2_net_roots` (thứ tự khai báo), mỗi match `compile_pattern(root)` `(a, b)` trên `norm`:
  1. Bỏ qua nếu `(a, b)` nằm trọn trong `tier1`, `excluded`, `benign` hoặc `anysig` (= "ngoài span").
  2. Bỏ qua nếu `ctx.original(a, b) ∉ forms` (chỉ dạng CÓ dấu: `lửa`, `khói`, `máu`, `bất động`).
  3. `_judge(lk, a, b)` ⇒ `T2-03` với status/quote, `rule_id` = rule hạ nếu có, ngược lại `"B-03N"`.
- Ví dụ: `… có tiếng nổ lớn và khói` ⇒ `T2-04 PRESENT` + `T2-03 PRESENT B-03N "khói"` (UNCLEAR) · `Thấy máu ở cầu thang bộ…` ⇒ UNCLEAR · `Có người nằm bất động ở sảnh…` ⇒ UNCLEAR · `Không có khói hay lửa gì cả.` ⇒ NONE (R1/R4 phủ định cả lưới) · `Khói thuốc lá ở sảnh tầng 1 tòa SIM-A.` ⇒ NONE (`khoi thuoc` ∈ `ambiguous_exclusions`, A4).

### 3.7 Gộp trùng + hợp biến thể R8
Hợp mọi bản ghi của các biến thể (§3.1), rồi mỗi cặp `(signal_id, status)` giữ **một** bản ghi: trích dẫn dài nhất; thứ tự = lần xuất hiện đầu (biến thể A trước B). `risk_level = derive_risk_level(signals)`.

### 3.8 Suy ra `risk_level` (`derive_risk_level`) — giữ
```
EMERGENCY  nếu ∃ signal tier 1 với status PRESENT                      # PRESENT thắng UNCLEAR (CR-03 §6.2)
UNCLEAR    nếu không, và ∃ signal tier 1 UNCLEAR hoặc ∃ signal tier 2 PRESENT/UNCLEAR
NONE       còn lại (kể cả chỉ có ABSENT)
```

### 3.9 Rỗng — giữ
`text` chỉ gồm khoảng trắng/ký tự vô hình ⇒ `SafetyAssessment(NONE, ())`, không ghi chú.

### 3.10 Ví dụ bắt buộc đúng (đo trên bản thử architect 2026-10-02; mọi quote là chuỗi con nguyên văn)
| Câu | risk_level | signals (signal_id/status/rule_id/quote) |
|---|---|---|
| `Đèn sảnh thang máy tầng 5 tòa SIM-A không sáng, có tia lửa và mùi khét ở hộp đèn.` (TEC-005) | EMERGENCY | `S-01/PRESENT/S-01/"mùi khét"`, `S-02/PRESENT/S-02/"tia lửa"` |
| `Tầng hầm B1 tòa SIM-A có chất lỏng lạ không rõ nguồn gốc, bốc mùi hắc gây khó thở, cần vệ sinh.` (CLN-004) | EMERGENCY | `S-14/PRESENT/S-14/"chất lỏng lạ \| mùi hắc"` |
| `Không có khói nhưng có mùi khét rõ ở hộp đèn tầng 2 tòa SIM-B.` | EMERGENCY | `S-01/PRESENT/S-01/"mùi khét"`, `S-04/ABSENT/B-02/"Không có khói"` |
| `Hình như có mùi khét ở hành lang tầng 3 tòa SIM-A.` | UNCLEAR | `S-01/UNCLEAR/T2-01/"Hình như có mùi khét"` |
| `Hôm qua đèn tầng 2 tòa SIM-B có tia lửa, giờ hết rồi.` | UNCLEAR | `S-02/UNCLEAR/T2-02/"tia lửa, giờ hết rồi"` |
| `Bóng đèn hành lang tầng 3 tòa SIM-A bị cháy.` | NONE | `T2-03/ABSENT/B-01/"Bóng đèn hành lang tầng 3 tòa SIM-A bị cháy"` |
| `Không có dấu hiệu cháy nổ, chỉ là đèn hành lang tầng 3 tòa SIM-A hỏng.` | NONE | `S-05/ABSENT/B-02/"Không có dấu hiệu cháy nổ"`, `T2-03/ABSENT/B-02/"Không có dấu hiệu cháy"` |
| `Hành lang tầng 3 tòa SIM-A không có điện có tia lửa tóe ra từ ổ cắm` (R1, M1) | EMERGENCY | `S-02/PRESENT/S-02/"tia lửa"` |
| `Không thấy khói hay tia lửa gì, đèn hành lang tầng 3 tòa SIM-A chỉ không sáng.` (R4) | NONE | `S-02/ABSENT/B-02/"Không thấy khói hay tia lửa"`, `S-04/ABSENT/B-02/"Không thấy khói"` |
| `Không ai bị thương nhưng kính hành lang tầng 3 tòa SIM-A vỡ.` (R3) | NONE | `S-09/ABSENT/B-02/"Không ai bị thương"` |
| `Có tia lửa tóe ra từ ổ cắm, đèn đã tắt.` (R5 + A2) | EMERGENCY | `S-02/PRESENT/S-02/"tia lửa"` |
| `Thùng rác cạnh đèn hành lang tầng 3 tòa SIM-A bị cháy` (R6, M13) | UNCLEAR | `T2-03/PRESENT/B-03/"cháy"` |
| `Nước chảy lan ra sảnh tầng 1 tòa SIM-A từ ống thoát.` (R7) | NONE | (không bản ghi) |
| `Có\u200bkhói bốc ra từ hộp điện` (R8, M6) | EMERGENCY | `S-04/PRESENT/S-04/"Có\u200bkhói bốc"` |
| `Hành lang tầng 3 tòa SIM-A có tiếng nổ lớn và khói` (R9) | UNCLEAR | `T2-04/PRESENT/T2-04/"tiếng nổ"`, `T2-03/PRESENT/B-03N/"khói"` |
| `Cư dân đề nghị tập huấn phòng cháy chữa cháy cho tòa SIM-A.` (R10) | NONE | (không bản ghi) |
| `Không phải không có khói.` (R1 phủ định kép) | UNCLEAR | `S-04/UNCLEAR/B-02D/"không có khói"` |

### 3.11 Độ phức tạp (R10: 24 KB < 1 s)
- Chuẩn hoá, tách câu/mệnh đề, vị trí token, marker hợp lệ: MỘT lần mỗi biến thể (O(n)).
- Mỗi kiểm cue (R1/R3/R4/R5): regex trên cửa sổ ≤ `scope_max_chars` ký tự. Gap marker A2 ≤ `scope_max_chars`. B-01: đếm token bằng `bisect` trước khi tách; DP ≤ 20 token. Không lát cắt `norm[x:]` đến cuối văn bản trong vòng lặp theo match.
- Đo bản thử (9 văn bản đối kháng 24–26 KB, `perf.py`): chậm nhất **0,283 s** (văn bản có ký tự vô hình — 2 biến thể).

## 4. Guard LLM — `merge_llm` / `assess_with_llm` (Q09, CR-03 §6.1.1, AC-05) — GIỮ NGUYÊN

```
assess_with_llm(text, lexicon, llm, label):
    rule = assess(text, lexicon)
    if llm is None: return rule
    try: result = llm(text)
    except Exception as exc: return replace(rule, notes=rule.notes + (f"LLM lỗi ({type(exc).__name__}); giữ kết quả luật",))
    return merge_llm(rule, result, text, lexicon, model_label=label)

merge_llm — với từng judgement j:
    j.signal_id ∉ {s.signal_id | s ∈ lexicon.signals, s.phase ∈ active_phases}  → bỏ qua + note "ngoài từ vựng P0"
    j.status == ABSENT                                                          → bỏ qua + note (KHÔNG BAO GIỜ hạ)
    quote rỗng                                                                  → bỏ qua + note "không có trích dẫn"
    normalize(quote) ∉ normalize(text)  (so trên văn bản chuẩn hoá, 3.1)         → status := UNCLEAR + note "trích dẫn không có trong phản ánh"
    SEVERITY[status] > max SEVERITY của các bản ghi cùng signal_id trong rule   → thêm RiskSignal(detected_by=LLM, rule_id="LLM", source_quote=quote)
    ngược lại                                                                   → bỏ qua + note "không cao hơn luật"
    kết quả: signals gộp trùng (3.7), risk_level = derive_risk_level, proposer = f"rules+llm:{label}"
```
Bất biến I-12 kiểm bằng test: `merge_llm` không bao giờ trả `risk_level` thấp hơn `rule.risk_level`, không bao giờ bớt bản ghi của luật. **P0 không bật LLM an toàn** (vùng cấm P1-06): hook chỉ dùng với fake client trong test.

Fake client cho test: `lambda text: LLMSafetyAssessment(judgements=[SignalJudgement(signal_id="S-01", status="ABSENT")])` v.v.; `MaintenanceEngine(safety_llm=fake)`.

## 5. Nối vào engine (`engine.py`) — GIỮ (WP3); WP3c không sửa engine

### 5.1 Tuple bước (`_run_pipeline`)
```python
steps = (
    (2, self._step_2b_assess_safety),        # [MỚI WP3] Q08: trước dữ liệu tối thiểu — Bậc 1 > Bậc 2 > MISSING_INFO
    (2, self._step_2_check_required_data),   # giữ nguyên thân hàm
    (3, self._step_3_classify_and_propose_department),
    (4, self._step_4_check_duplicate_ticket),
    (5, self._step_5_check_bptn_review_needed),
    (6, self._step_6_lookup_asset),
    (7, self._step_7_check_material_stock),
    (8, self._step_8_route_to_department),
)
```
Cả hai bước đầu mang số 2 ⇒ `resume_step=2` chạy lại cả 2b lẫn 2 (I-04, D2).

### 5.2 Văn bản 2b đọc — `_safety_scope_text`
```python
def _safety_scope_text(self, work: Case) -> str:
    """Toàn bộ nội dung khi chưa từng xác nhận an toàn; sau khi xác nhận chỉ phần cư dân bổ sung TỪ mốc đó (CR-03 §5.2)."""
    cleared_at = work.ticket.safety_cleared_at
    if cleared_at is None:
        return self._content(work)
    return "\n".join(a.content for a in work.additions if a.submitted_at >= cleared_at)   # `>=` (Q27, N-09)
```

### 5.3 Bước 2b
```python
def _step_2b_assess_safety(self, work: Case, now: datetime) -> bool:
    """CR-03 §5.1 bước 2b. Chạy cho MỌI ticket có nội dung, trước phân loại; Bậc 1 dừng (BQL), Bậc 2 dừng (BPTN)."""
    text = self._safety_scope_text(work)
    if _blank(text):
        return False                                   # không có gì để đánh giá (rỗng, hoặc đã cleared và không có bổ sung mới)
    result = assess_with_llm(text, self.lexicon.safety, self.safety_llm, self.llm_label)
    ticket = work.ticket
    old = ticket.risk_level
    ticket.risk_level, ticket.risk_signals = result.risk_level, list(result.signals)
    present = sorted({s.signal_id for s in result.signals if s.status == SignalStatus.PRESENT})
    self._agent(work, Action.ASSESS_SAFETY, "Ticket", ticket.ticket_id, "risk_level", old,
                {"risk_level": result.risk_level, "signals": list(result.signals), "notes": list(result.notes),
                 "proposer": result.proposer, "scope": "additions_after_clear" if ticket.safety_cleared_at else "full"},
                "Tầng an toàn bước 2b (luật cố định; LLM chỉ nâng mức)", now=now,
                rule_id=next((s.rule_id for s in result.signals if s.status == SignalStatus.PRESENT), None))
    if result.risk_level == RiskLevel.EMERGENCY:
        ticket.related_ticket_ids = self._related_ticket_ids(work)           # Q11: chỉ liên kết, không gộp
        self._stop(work, S.VERIFYING, R.EMERGENCY_PENDING_BQL, now, resume_step=2, note=f"Bậc 1: {', '.join(present)}")
        self._notify(work, "emergency.created", BlockerOwner.BQL, now,
                     {"risk_level": RiskLevel.EMERGENCY, "signal_ids": present, "related_ticket_ids": ticket.related_ticket_ids})
        return True
    if result.risk_level == RiskLevel.UNCLEAR:
        unclear = sorted({s.signal_id for s in result.signals if s.status != SignalStatus.ABSENT})
        return self._stop(work, S.VERIFYING, R.SAFETY_REVIEW_REQUIRED, now, resume_step=2, note="Bậc 2: " + ", ".join(unclear))
    return False
```
- `_stop` dùng `actor_id=AGENT_ID, role=Role.AGENT` mặc định ⇒ T04 bởi AGENT với lý do mới (01 §3.2).
- Không tạo proposal, không `proposed_department_id`, không draft (CR-03 §6.1.4) — pipeline dừng trước bước 3.
- Thứ tự thắng Q08 tự thoả vì 2b đứng trước 2.

### 5.4 Liên kết ticket Bậc 1 (Q11)
```python
def _related_ticket_ids(self, work: Case) -> list[str]:
    """Ticket chưa kết thúc, cùng vị trí (effective_location), tạo trước, trong duplicate_window_hours — KHÔNG lọc category."""
    location, created = self.effective_location(work), _created_at(work.ticket.raw)
    if location is None or created is None:
        return []
    earliest = created - timedelta(hours=self.catalog.sla_config.duplicate_window_hours)
    found = []
    for other in self.cases.values():
        ticket = other.ticket
        if ticket.ticket_id == work.ticket.ticket_id or ticket.status in TERMINAL_STATUSES:
            continue
        other_created = _created_at(ticket.raw)
        if other_created is None or not (earliest <= other_created < created):
            continue
        if self.effective_location(other) == location:
            found.append(ticket.ticket_id)
    return sorted(found)
```
Một chiều (chỉ ticket mới ghi); không đụng `_find_duplicate_ticket_id`.

### 5.5 Blocker an toàn trong `_new_blocker` / `_schedule` / `_cleared` / `_escalate` / `route_blockers`
```python
# _new_blocker: thêm NHÁNH TRƯỚC nhánh `code in BPTN_REASONS`
elif code == R.SAFETY_REVIEW_REQUIRED:
    escalate_at = now + timedelta(hours=sla.safety_review.escalate_after_hours)   # giờ LỊCH (Q10)
elif code == R.EMERGENCY_PENDING_BQL:
    escalate_at = None                                                            # BQL đã được báo ngay (emergency.created)
# _new_blocker: MISSING_INFO nhận kwarg mới safety_context: bool = False (P02 §5.3): 12 h thay cho 72 h
# _schedule: `if code in SAFETY_REASONS: return None` (không tự nhắc)
# _cleared: dòng đầu `if code in SAFETY_REASONS: return False` (I-10)
# _escalate: khi blocker.code == R.SAFETY_REVIEW_REQUIRED ⇒ type "safety.review_escalated" (audience BQL) thay cho "escalation"
# route_blockers: 01 §3.4
```

### 5.6 Audit/outbox
| Sự kiện | Audit (`action`, `field_name`) | StatusEvent | Outbox |
|---|---|---|---|
| 2b NONE | `ASSESS_SAFETY`, `risk_level` | không | không |
| 2b UNCLEAR | `ASSESS_SAFETY` + (T04 ghi qua `_apply_transition`) | `RECEIVED→VERIFYING`, `reason_code=SAFETY_REVIEW_REQUIRED`, public | `ticket.status_changed` (cư dân) |
| 2b EMERGENCY | `ASSESS_SAFETY` | `RECEIVED→VERIFYING`, `EMERGENCY_PENDING_BQL`, public | `ticket.status_changed` + `emergency.created` (BQL) |

## 6. Seed và test hồi quy
- WP3 (D13, giữ): `tickets.yaml` CLN-004, TEC-005 theo SPEC-P04 §6; `test_api.py::test_bql_filters` tập `VERIFYING` = `{"SIM-TKT-TEC-002", "SIM-TKT-TEC-005", "SIM-TKT-CLN-004"}`; `demo.observe` có `risk_level`/`priority` (01 §9).
- WP3c: danh sách test mới, 2 test cũ được phép sửa, bộ dừng — TESTING §4.1, §4.2, §10–§11. Không đổi `tickets.yaml`.

## 7. BẮT BUỘC / CẤM / Vùng cấm

### 7.1 BẮT BUỘC
1. `assess` thuần: không `datetime.now`, không đọc file, không random; `lexicon` là tham số.
2. Mọi `RiskSignal.source_quote` là chuỗi con nguyên văn của `text` (S-14: từng đoạn tách bởi `" | "`), kể cả quote của biến thể B. Test kiểm trên toàn bộ câu có nhãn + bộ dừng.
3. 2b chạy trước `_step_2_check_required_data`; blocker an toàn có `resume_step=2`; sau khi người gỡ, pipeline chạy lại từ 2 (P02 §4) và 2b tự bỏ qua (5.2).
4. Mọi pattern/cue/đệm/tập đóng/đồng tự/gốc R9/số ngưỡng (2, 80, 20) lấy từ `lexicon`; compile một lần (cache theo pattern/tuple) — đúng trước, nhanh sau.
5. Chuỗi ghi vào `Blocker.internal_note`/audit được phép chứa `S-xx`; chuỗi cho cư dân chỉ từ `vi.yaml`.
6. **R1 là MỘT hàm** (`scope_before`) gọi bởi: phủ định safety (R1/R3), hedge (R5), phủ định priority (SPEC-P03 §1.1). Không có bản chép thứ hai của luật cửa sổ.
7. Thứ tự phán cố định B-02 > T2-01 > T2-02 > PRESENT; R4 chỉ chạy khi R1/R3 không khớp; A2 kiểm trước khi chấp nhận marker.
8. R8: hai biến thể dùng CHUNG lexicon và CHUNG trình tự §3.0; `risk_level` của kết quả == max mức từng biến thể (test).
9. R7 dùng `ctx.original` (NFC, chữ thường, gộp khoảng trắng) — không so trên `norm`.
10. Mọi câu trong bộ dừng (TESTING §11) chép NGUYÊN VĂN bằng trích `ast` từ script đo, không gõ tay.

### 7.2 CẤM
1. Gọi LLM thật trong 2b khi `safety_llm is None` (mặc định); tự tạo client an toàn từ `settings` (Q09, Q29).
2. Hạ mức ngoài các nhánh: B-02/B-02D (R1/R3/R4), T2-01/T2-02 (R5 + A2), B-04 (chỉ S-01, ngữ cảnh nấu ăn không có từ điện), B-01 (R6 + A1), loại match đồng tự (R7). Không hạ "sau khi phán" (vd lọc lại bản ghi theo câu).
3. Dùng bare `\bkhoi\b`, `\bno\b`, `\bgiat\b`, `\bngat\b`, `\blua\b`, `\bmau\b` làm **pattern tín hiệu** (đồng tự: khỏi/nó/giặt/ngắt/lựa/màu — R9 chỉ nhận dạng CÓ dấu và chỉ ra Bậc 2).
4. Lọc tín hiệu theo category/scope trong 2b (D12); đọc ảnh (V-06).
5. Sửa `rules.py`, `proposer.py`, `engine.py` (V-10; WP3c không cần); đặt từ vựng trong `.py` (trừ `LEAD`, `SOFT_BREAKS`, `HARD_BREAKS`, `HANGUL_FILLERS` — ký tự/cú pháp, không phải từ vựng nghiệp vụ).
6. Dùng lại cửa sổ "N từ" (`negation_window_words`, `hedge_window_words`, `words_before`) dưới bất kỳ tên nào.
7. Thêm/bớt/sửa câu của bộ dừng hoặc sửa script đo ở scratchpad để "cho xanh"; thêm mục từ vựng nhắm đúng một câu của bộ báo nhầm mà không ghi vào report.
8. Regex lặp có thể backtrack theo số mũ cho tập đóng B-01; lát cắt `norm[x:]` tới cuối văn bản trong vòng lặp theo match.

### 7.3 Vùng cấm (điều đã cân nhắc và quyết định KHÔNG làm)
| # | Không làm | Lý do |
|---|---|---|
| P1-01 | Không hạ T2-02 chỉ vì có mốc quá khứ ("hôm qua") | "hôm qua có tia lửa" không nói đã hết — bỏ sót Bậc 1 là lỗi nặng nhất (D4) |
| P1-02 | Không đọc B-04 theo nghĩa "khét phải có ngữ cảnh điện" | "mùi khét ở hành lang" phải là Bậc 1 (D3, Q-D) |
| P1-03 | **[VIẾT LẠI WP3c]** Không kế thừa phủ định qua **dấu phẩy, "và", xuống dòng, dấu câu** và không qua "hay/hoặc/lẫn" khi vế trước không chứa token nguy hiểm | Q29 R4: phủ định lan qua liên từ là nguồn bỏ sót Bậc 1 (R05 N-01, R07 M1). "hay/hoặc/lẫn" chỉ kế thừa khi vế trước là chính mối nguy (A3) — "không có điện hay tia lửa" vẫn EMERGENCY (`jx_coord` 0/400 lọt). Thay cho P1-03 cũ ("không mở rộng qua liên từ") |
| P1-04 | Không chạy 2b lại khi BPTN đổi category / sau bước 4–8 | nội dung không đổi; chỉ bổ sung cư dân mới làm 2b chạy lại |
| P1-05 | Không ghi tín hiệu "không nhắc tới" là ABSENT | `risk_signals` chỉ chứa bằng chứng văn bản |
| P1-06 | **Không bật LLM an toàn ở P0** (kể cả LLM thật có timeout) | `receive` giữ `engine.lock` (RLock, `engine.py:368`) suốt pipeline tới `assess_with_llm` (`engine.py:2032`) ⇒ mỗi lời gọi LLM (giây) chặn MỌI request khác của engine — lặp lại lớp lỗi DoS R05 N-07. Prompt an toàn = P1 (Q09, Q29) |
| P1-07 | Không xử lý **chữ Cyrillic/Hy Lạp trùng hình** (`khоi` với `о` U+043E) | cần bảng confusables Unicode + đo báo nhầm riêng; giới hạn đã biết Q29 |
| P1-08 | Không xử lý **leet** (`kh0i`, `t1a lửa`) | đổi số↔chữ làm hỏng mã vị trí (`B1`, `SIM-A`, số tầng); giới hạn đã biết Q29 |
| P1-09 | Không ghép **chữ bị tách/dính** (`k h ó i`, `kho.i`, `cókhói` không khoảng trắng) | ghép/tách ký tự đơn tạo match giả trên mọi văn bản; giới hạn đã biết Q29 ("tách chữ") |
| P1-10 | Không xử lý **ligature** ngoài NFKC (ca `c_uni` `ﬁre` ⇒ NFKC `fire` — chữ Anh, ngoài từ vựng) và không gộp **lặp đúng 2 chữ** (`khóii`, `tiaa`) | gộp 2 chữ phá từ hợp lệ có chữ đôi; ligature tiếng Việt hiếm; giới hạn đã biết Q29 (bản thử judge có biến thể "E" gộp 2 chữ — KHÔNG lấy) |
| P1-11 | Không coi danh từ đèn **không dấu** là đã chứng minh trong B-01 | `den` không dấu trùng `đến/đen` ⇒ hạ nhầm (`Chay den tang 3` = cháy đến tầng 3). Chấp nhận: phản ánh đèn gõ không dấu "bị cháy" ⇒ Bậc 2 (báo nhầm, an toàn) |
| P1-12 | Không gộp R9 thành Bậc 1 ("khói" trần ⇒ EMERGENCY) | "khói thuốc/khói hương/khói bếp" là ca thường gặp; Q29 chốt R9 là lưới **Bậc 2** |
| P1-13 | Không áp R7 cho `components` (S-14/T2-05) | thành phần không có đồng tự trong danh sách `homographs`; giữ hành vi WP3 đã đo (CLN-004) |

### 7.4 Quyết định thiết kế bị thay thế (không xoá lịch sử; phát biểu cũ hết hiệu lực từ WP3c)
| Cũ | Thay bởi | Lý do / bằng chứng |
|---|---|---|
| **Cửa sổ phủ định 4 từ** (`negation_window_words: 4`, `hedge_window_words: 5`, `LEAD` nối cửa sổ; WP3, SPEC-P01 §3.2 bản 2026-10-01) và cửa sổ 4 từ trong mệnh đề (WP3b) | R1: cue + ≤ 2 token đệm kết thúc ngay trước span, cửa sổ ≤ 80 ký tự trong mệnh đề | R07 M1: 67/100 tổ hợp phủ định + tín hiệu không dấu câu lọt Bậc 1 trên HEAD `acb82fd`; bản thử architect 0/100 (`f_neg`) |
| **Danh sách đen `non_lamp_electrical`** cho B-01 (WP3b, Q25.3) | R6: tập đóng tiền tố ≤ 20 token + A1 (danh từ đèn có dấu) | R07 M13: 12/20 câu `a_b01` lọt (thùng rác, rèm, xe máy… không có trong danh sách đen); bản thử 0/20 |
| **Bỏ ký tự Cf KHÔNG chèn khoảng trắng** (WP3b, Q25.6 — một biến thể) | R8: hai biến thể (bỏ / thành khoảng trắng), lấy max; tập vô hình mở rộng U+034F, U+FE00–FE0F, filler Hangul | R07 M6: `có\u200bkhói` ⇒ NONE (hồi quy WP3b); `c_uni` 18 lỗi trên HEAD ⇒ 5 (đều thuộc giới hạn đã biết) |
| Marker T2-02 "cùng mệnh đề, đứng trước hoặc sau; 'giờ…' ở mệnh đề sau" (WP3b) | R5 + A2: marker đứng SAU tín hiệu, sau nó chỉ tiểu từ, không chủ ngữ khác chen giữa | `a_split` s15/s16/s17 lọt trên HEAD; bản thử 0/30 |
| Danh sách `benign_lamp_nouns` có mục `re:\bbong\b`… (WP3) | cụm thường `bong`, `den`, `tuyp` + `benign_lamp_noun_forms` | tập đóng R6 cần cụm thường để quy hoạch động |

## 8. Phân loại lỗi (riêng P01; bảng chung 00 §7)
| Tình huống | Lớp | Hành vi bắt buộc |
|---|---|---|
| `lexicon.yaml` thiếu khoá/regex hỏng/`signal_id` trùng/khoá WP3c sai kiểu (01 §5.4) | `pydantic.ValidationError` lúc `load_lexicon` (engine không khởi tạo) | sửa YAML; không fallback sang từ vựng mặc định trong code |
| `homographs`/`homograph_intended`/`tier2_net_roots`/`benign_lamp_noun_forms` có dạng có dấu không bỏ dấu ra đúng khoá; `homograph_intended` trỏ pattern không tồn tại | `ValidationError` (01 §5.4) | sửa YAML. Dạng SAI chính tả nhưng vẫn bỏ dấu ra đúng khoá (vd `chẩy`) KHÔNG bị bắt (01 §5.5) ⇒ R7/R9/A1 im lặng không khớp — test §4.1 phải đỏ |
| `priority` khác phạm vi R1 với `safety` (đệm/ngưỡng/liên từ) | `ValidationError` ở `Lexicon` (01 §5.4) | sửa YAML; R1 là MỘT luật |
| LLM lỗi/timeout/trả schema sai | nuốt trong `assess_with_llm`, note `"LLM lỗi (…)"`, `proposer="rules"` | giữ kết quả luật; audit ghi notes |
| LLM trích dẫn bịa | hạ judgement về `UNCLEAR` + note | không bao giờ `EMERGENCY` chỉ từ LLM không có trích dẫn khớp |
| 2b ném exception khác (bug) | lan ra `_mutate` ⇒ không commit, HTTP 500 | fail closed; không bỏ qua bước 2b |
| Câu Bậc 1 ra thấp hơn kỳ vọng | phân loại theo TESTING §12.2 (cơ chế hạ mức ⇒ chặn; lỗ từ vựng ⇒ ghi + YAML; giới hạn đã biết ⇒ ghi) | không tự sửa SPEC; worker ghi Câu hỏi mở |
| `assess` > 1 s trên văn bản ≤ 24 KB | lỗi cơ chế (R10) | 🔁 chặn — tìm vòng lặp O(n²) (§3.11) |

## 9. Số đo nghiệm thu (THẬT)

### 9.1 Lệnh (root repo, venv 3.11, `PYTHONUTF8=1`, `LLM_MODE=mock`)
| # | Lệnh | Kỳ vọng sau WP3c |
|---|---|---|
| S-02 | `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_safety.py` | 0 fail, 0 skip; có đủ test tên ở TESTING §4.1 |
| S-03 | `python -c "from src.maintenance.engine import MaintenanceEngine as E; e=E(); e.reset(); t=e.get('SIM-TKT-TEC-005').ticket; print(t.status, t.blocker.code, t.risk_level, t.proposed_department_id, [s.signal_id for s in t.risk_signals])"` | `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY None ['S-01', 'S-02']` (giữ) |
| S-04 | như S-03 với `SIM-TKT-CLN-004` | `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY None ['S-14']` (giữ) |
| S-05 | `python -c "from src.maintenance.engine import MaintenanceEngine as E; e=E(); e.reset(with_fixtures=False); c=e.receive('Hình như có mùi khét ở hành lang tầng 3 tòa SIM-A.'); print(c.ticket.status, c.ticket.blocker.code, c.ticket.risk_level, c.ticket.blocker.escalate_at - c.events[-1].created_at)"` | `VERIFYING SAFETY_REVIEW_REQUIRED UNCLEAR 4:00:00` (giữ) |
| S-06 | như S-05 với `'Có mùi khét ở sảnh, không rõ tòa nào'` | `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY` (giữ, Q08) |
| S-07 | `python -m pytest -q -p no:cacheprovider` (toàn bộ) | 0 fail, 0 skip; collected ≥ **1378** = 352 + 1026 (TESTING §4.1) |
| S-08 | bộ dừng TESTING §10–§11 (script đo ở scratchpad, `AUDIT_ROOT=D:\P151`) | đúng bảng TESTING §11.5 cột "kỳ vọng" |

### 9.2 Số đo HEAD `01c3506` (mã safety = `4983020`) — nền để so (đo 2026-10-02 bằng `scratchpad\arch3\ra.sh HEAD <script>`)
`f_neg` 67/100 không-EMERGENCY (dấu phẩy/xuống dòng/"nhưng"/". " 0/100) · `a_sep` 24/40 · `jx_coord` hay 36, hoặc 36, lẫn 36, khoảng trắng 67 (/100) · `a_b01` 12/20 · `b_fp` 12/59 (6 EMERGENCY, 6 UNCLEAR) · `b_fp2` 27/33 (24 EMERGENCY, 3 UNCLEAR) · `jx_negfp` EMERGENCY 3/20 · `i_recall` NONE 19/42 · `a_split` 6/30 · `c_uni` 18/34 · `c_elong` 6/12 · `g_prio` 3/18 · fixture `j_fix` EMERGENCY đúng 2 (CLN-004, TEC-005) · R05 `a_text` BAD 1 (A4), `a_text2` BAD 0, `a_fuzz` 900 tổ hợp 0 vấn đề.

### 9.3 Số đo bản thử architect (cài đúng §1–§3 + 01 §5) — `bash scratchpad/arch3/rb.sh PXQT <script>`
| Bộ | Kết quả | Ghi chú |
|---|---|---|
| `f_neg` | 0/100 (mọi ngăn cách 0/100); 20/20 câu f đúng | judge: 67→0 ✔ |
| `a_sep` | 0/40 | judge: 24→0 ✔ |
| `jx_coord` | 0/100 × 4 cầu nối | R4 chạy thật (A3) |
| `a_b01` | 0/20 | judge: 12→0 ✔ |
| `b_fp` | 4/59, **0 EMERGENCY, 4 UNCLEAR** (cơm khét B-04, nấu ăn khét B-04, kêu ù ù T2-04, khói bếp nướng R9) | ngưỡng ≤1 / ≤5 ✔; không có A4 `khoi thuoc/huong/nhang`: 6 UNCLEAR ✗ (Câu hỏi mở) |
| `b_fp2` | 4/33, **3 EMERGENCY** (gãy chân/tay đồ vật — S-09), 1 UNCLEAR | ngưỡng ≤3 ✔; judge: 27→4 ✔ |
| `jx_negfp` | **0 EMERGENCY**, 1 UNCLEAR /20 | ngưỡng ≤2 ✔ (bản thử judge 2 — R4 chưa chạy) |
| `i_recall` | NONE 2/42 (chỉ 2 câu tín hiệu P1: "nóng đỏ rực" S-07, "mùi gas" S-10 — Q06), UNCLEAR 9, EMERGENCY 31 | 0 NONE trên 40 câu P0 |
| `a_split` | 0/30 | |
| `c_uni` | 5/34 — đúng 5 ca giới hạn đã biết (Cyrillic ×2, dính chữ full-width, ligature, leet) | |
| `c_elong` | 6/12 — đúng 6 ca giới hạn đã biết (lặp 2 chữ ×4, tách chữ ×2) | |
| `g_prio` | 1/18 (g10 "Không có rác chắn lối đi" ⇒ H2 — đánh đổi R1, SPEC-P03 P3-06) | M11 sửa |
| fixture `j_fix` | EMERGENCY đúng CLN-004, TEC-005; 10 NONE | 0 nhầm ✔ |
| R05 `a_text` / `a_text2` / `a_fuzz` | BAD 1 (A4 phủ định kép = UNCLEAR, đúng Q25.2) / BAD 0 / 900 tổ hợp 0 vấn đề | |
| pytest repo trên bản thử | 350 pass, 2 fail = đúng 2 test được phép sửa (TESTING §4.2) | |
| `perf.py` 9 văn bản 24–26 KB | chậm nhất 0,283 s | R10 ✔ |
| Bộ dừng sau khi chép (`stopsets_sim.py`, 988 câu/tổ hợp + `fixture`) | HEAD: 989 test, **251 đỏ** (`fixture` xanh); bản thử: 989, **0 đỏ** | TESTING §11.5 |
