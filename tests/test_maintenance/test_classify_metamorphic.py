"""Metamorphic tests for classification and location (plan 05 Q01, H02).

Every corpus sentence is written the way residents write the problem itself, without any location. It is then
wrapped in location templates (start / end of sentence, "Tòa X / Tầng N / Khu: …", "block", "lầu", "tòa nhà", with
and without diacritics). Adding a location must not change the job type, and `extract_location` must return exactly
the location of the template: the words of the location never pick the job type themselves.

The expected label is the label of the sentence reported in a common area: area-gated words ("bẩn", "đèn"...)
are OUT_OF_SCOPE without any area by design (plan 04), so the sentence alone is not the reference.
"""

import unicodedata

import pytest

from src.maintenance.proposer import LLMAssessment, propose
from src.maintenance.rules import classify, extract_location, missing_location_parts

BUILDINGS = ("S1", "S2")  # catalog site.buildings (Ocean Park pilot)

TEC, CLN, UNCLEAR, OUT = "TEC", "CLN", "UNCLEAR", "OUT"

LIGHTING = [
    "Đèn chập chờn",
    "Đèn nhấp nháy liên tục cả đêm",
    "Đèn tắt hết rồi",
    "Đèn không bật được",
    "Bấm công tắc mà đèn bật không lên",
    "Đèn sáng yếu lắm, nhìn không rõ",
    "Tối om, đèn không sáng",
    "Bóng đèn cháy rồi, nhờ thay giúp",
    "Bóng đèn bị nổ",
    "Đèn rơi xuống sàn",
    "Đèn rớt xuống vỡ tan",
    "Mất đèn từ tối qua",
    "Đèn hỏng cả dãy",
    "Đèn lúc sáng lúc tắt",
    "Đèn cảm ứng không bật khi có người đi qua",
    "Đèn led bị hư",
    "Đèn ốp trần bị vỡ",
    "Đèn mờ quá",
    "Đèn không lên",
    "Cả dãy đèn tắt ngúm",
    "Đèn chớp tắt liên tục",
    "Đèn cứ chớp nháy",
    "Hai bóng đèn bị hư",
    "Đèn chập chờn rồi tắt luôn",
    "Đèn không hoạt động từ hôm qua",
    "Đèn bị tắt cả đêm",
    "Bóng đèn bị đứt",
    "Đèn không sáng nữa",
    "Đèn chết rồi",
    "Đèn hỏng mấy hôm rồi chưa ai thay",
    "Bóng đèn tuýp bị cháy",
    "Đèn cháy bóng",
    "Thay giùm bóng đèn đã hỏng",
    "Đèn kêu rè rè rồi chớp liên tục",
    "Mấy bóng đèn bị vỡ",
    "Đèn exit thoát hiểm không sáng",
    "Đèn tối thui, không thấy đường",
    "Đèn nháy nháy rất khó chịu",
    "Đèn bị lủng lẳng sắp rơi",
    "Đèn sáng lờ mờ",
    "Tôi là Bùi Thị Hoa, báo đèn chập chờn",
    "Tôi đến nơi thì thấy đèn tắt hết",
    "Phan Văn Tài báo đèn không sáng",
    "Tôi bận nên giờ mới báo: đèn không sáng",
    # fluorescent tubes named without "đèn" (SO, plan 05 round 2)
    "Bóng tuýp chết rồi",
    "Tối om, bóng tuýp chết rồi",
    "Tuýp chập chờn cả buổi",
    "Bóng tuýp không sáng",
    "Mấy cây tuýp hỏng hết",
    "Bóng tuýp bị cháy đen",
    "Tuýp nhấp nháy liên tục",
]

CLEANING = [
    "Rác chất đống",
    "Thùng rác đầy tràn ra ngoài",
    "Bẩn quá, lâu rồi không ai lau",
    "Sàn dơ quá",
    "Nước đọng thành vũng",
    "Sàn trơn trượt vì nước đọng",
    "Mùi hôi nồng nặc",
    "Có bãi nôn chưa ai dọn",
    "Có phân chó",
    "Nước tiểu khai nồng ở góc",
    "Lá cây rụng đầy",
    "Kính cửa bẩn, bám bụi",
    "Mạng nhện giăng đầy góc trần",
    "Dầu mỡ đổ loang trên sàn",
    "Sơn đổ ra sàn chưa ai lau",
    "Bụi bám dày",
    "Vỏ chai vỏ lon vứt bừa",
    "Đầu lọc thuốc lá vứt đầy",
    "Giấy vụn vương vãi",
    "Ai đó để túi rác lại",
    "Nước ngọt đổ dính nhớp nháp",
    "Bã kẹo cao su dính đầy sàn",
    "Có chất lỏng lạ chảy ra",
    "Vết bẩn loang lổ trên tường",
    "Cần vệ sinh gấp",
    "Nhờ dọn dẹp giúp",
    "Đất cát vương vãi khắp nơi",
    "Bùn đất dính đầy sàn sau mưa",
    "Lông chó rụng đầy",
    "Phân chim bám đầy lan can",
    "Mùi hôi thối bốc lên",
    "Bốc mùi khó chịu",
    "Nước thải tràn ra",
    "Nước bẩn tràn lênh láng",
    "Rêu bám trơn trượt",
    "Sữa đổ ra sàn",
    "Cà phê đổ loang",
    "Có người nôn ra sàn",
    "Tàn thuốc vứt đầy chậu cây",
    "Thùng carton vứt bừa chưa ai dọn",
    "Bẩn thỉu kinh khủng",
    "Tôi bận nên giờ mới báo: rác chất đống",
    "Tôi là Bùi Văn An, ở đây bụi bẩn quá",
]

OUT_OF_SCOPE = [
    "Thang máy bị kẹt, đứng im không chạy",
    "Thang máy kêu to và rung lắc",
    "Nhà tôi mất điện từ sáng",
    "Căn hộ 1203 bị mất nước",
    "Vòi nước trong căn hộ bị rò rỉ",
    "Đèn trong căn hộ tôi bị hỏng",  # a lamp inside a flat is not a common-area lamp (Playbook §7.1)
    "Bóng đèn phòng ngủ nhà tôi bị cháy",
    "Phí quản lý tháng này tính sai",
    "Cho hỏi phí gửi xe máy tháng này bao nhiêu",
    "Xin thêm thẻ gửi xe ô tô",
    "Hàng xóm hát karaoke ồn quá đến khuya",
    "Có người lạ lảng vảng, bảo vệ không kiểm tra",
    "Camera an ninh bị che",
    "Nhiều gián bò ra từ ống thoát",  # pest control is not cleaning in Playbook §6.1 / §5
    "Muỗi nhiều quá, đề nghị phun thuốc",
    "Chuột chạy khắp nơi",
    "Wifi chung không vào được",
    "Bình chữa cháy hết hạn",
    "Máy lạnh nhà tôi chảy nước",
    "Tường bị nứt, bong tróc sơn",
    "Cửa cuốn bị kẹt không lên",
    "Đề nghị lắp thêm đèn",  # asking for a new lamp is not a lamp that stopped working
    "Khi nào sửa xong thang máy?",
    "Xin hỏi giờ mở cửa hồ bơi",
    "Ống nước bị vỡ, nước phun ra",  # plumbing: no v1.1 playbook
    "Đèn đường ngoài cổng không sáng",  # public street outside the gate is not a common area of the building
    "Xe đạp để bừa bãi chắn đường",
    "Cho em hỏi đến bao giờ có nước lại",
    "Anh Đen bảo vệ ca đêm ngủ gật",
    "Khi đến thì thấy thang máy hỏng",
    "Tối om, không thấy đường",  # darkness without a lamp may be a power cut: left to the LLM (SO round 2)
    "Bóng tuýp trong căn hộ tôi bị hỏng",
    # liquid on electrical equipment / bare wires: never a routine spill or broken lamp, BPTN reads it (H04 d)
    "Nước tràn vào tủ điện",
    "Nước ngập gần tới ổ cắm",
    "Tủ điện bị ngập nước",
    "Nước mưa thấm vào hộp điện",
    "Đèn rơi ra, lòi cả dây điện",
    "Đèn hỏng, dây điện chỗ đèn lòi ra ngoài",
    "Bóng đèn rớt xuống, lộ dây điện",
    "Sàn đầy nước, tràn tới ổ cắm",
]

MIXED = [
    "Vừa có rác vừa có đèn không sáng",
    "Đèn chập chờn, sàn thì đầy rác",
    "Bẩn quá mà đèn cũng tắt",
    "Thùng rác đầy tràn, đèn thì hỏng",
    "Có bãi nôn và bóng đèn bị cháy",
    "Đèn nhấp nháy, nước đọng khắp sàn",
    "Mạng nhện bám đầy, đèn cũng không sáng",
    "Sàn trơn vì nước đọng, đèn lại tối om",
    "Mùi hôi nồng nặc, bóng đèn hỏng",
    "Rác vương vãi và đèn hư",
    "Lá cây rụng đầy, đèn tắt hết",
    "Cần vệ sinh và thay bóng đèn đã cháy",
    "Có phân chó, đèn không sáng",
    "Dầu mỡ đổ ra sàn, đèn thì chập chờn",
    "Đèn rớt xuống vỡ, bụi bặm khắp nơi",
    "Đèn mờ quá, kính cửa thì bẩn",
    "Bóng tuýp chết, rác thì chất đống",
]

CORPUS: list[tuple[str, str]] = (
    [(s, TEC) for s in LIGHTING]
    + [(s, CLN) for s in CLEANING]
    + [(s, OUT) for s in OUT_OF_SCOPE]
    + [(s, UNCLEAR) for s in MIXED]
)

# Sentences the fixed rules cannot settle without a model, with the label the rules give instead (still invariant
# under every template). Kept explicit so nothing is silently skipped.
RESIDUAL: dict[str, tuple[str, str]] = {}

# (template, expected location). "{s}" is the sentence; the first five come from H01/H02.
TEMPLATES: list[tuple[str, str]] = [
    ("Tòa S1 / Tầng 3 / Hành lang: {s}", "Tòa S1 / Tầng 3 / Hành lang"),
    ("{s} ở hành lang tầng 4 tòa S2", "Tòa S2 / Tầng 4 / Hành lang"),
    ("Tòa S2 tầng 2 sảnh thang máy, {s}", "Tòa S2 / Tầng 2 / Sảnh thang máy"),
    ("Block S2 lầu 6 phòng rác: {s}", "Tòa S2 / Tầng 6 / Phòng rác"),
    ("Tầng hầm B1 tòa S1, bãi đỗ xe: {s}", "Tòa S1 / Tầng B1 / Hầm xe"),  # asset label kept (plan 04)
    ("{s}. Tòa nhà S2, tầng 7, cầu thang bộ", "Tòa S2 / Tầng 7 / Cầu thang bộ"),
    ("Em ở tòa S2 tầng 9 hành lang, báo: {s}", "Tòa S2 / Tầng 9 / Hành lang"),
    ("Sảnh chính tòa S1: {s}", "Tòa S1 / Tầng 1 / Sảnh chính"),
    ("Tòa S2 / Tầng trệt / Sân chơi: {s}", "Tòa S2 / Tầng Trệt / Sân chơi"),
    ("{s} - lối đi tầng 5 tòa S2", "Tòa S2 / Tầng 5 / Lối đi"),
    ("Tòa S1 tầng 12 sân thượng: {s}", "Tòa S1 / Tầng 12 / Sân thượng"),
    # H04: the resident's home named first is not where the problem is; spaced codes; "03"; areas added in round 2
    ("Căn 1508 tầng 15 tòa S1, báo giúp hành lang tầng 3: {s}", "Tòa S1 / Tầng 3 / Hành lang"),
    ("Em ở tòa S2, đi qua hành lang tầng 3 tòa S1 thấy {s}", "Tòa S1 / Tầng 3 / Hành lang"),
    ("{s}. Em ở căn 1203 tòa S2, chỗ sảnh thang máy tầng 2", "Tòa S2 / Tầng 2 / Sảnh thang máy"),
    ("Chị Hoa phòng 1208 tòa S2 nhờ báo hành lang tầng 4 tòa S1: {s}", "Tòa S1 / Tầng 4 / Hành lang"),
    ("Hành lang tầng 03 toà S1: {s}", "Tòa S1 / Tầng 3 / Hành lang"),
    ("toa s2 cau thang tang 5, {s}", "Tòa S2 / Tầng 5 / Cầu thang bộ"),
    ("Lối thoát hiểm tầng 9 tòa S2: {s}", "Tòa S2 / Tầng 9 / Lối thoát hiểm"),
]


def strip_accents(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def variants(sentence: str) -> list[tuple[str, str]]:
    """Every (wrapped text, expected location): each template with and without diacritics."""
    body = sentence.rstrip(".?! ")
    out = []
    for template, location in TEMPLATES:
        text = template.format(s=body)
        out += [(text, location), (strip_accents(text), location)]
    return out


def label(description: str) -> str:
    result = classify(description)
    if result.playbook_id == "PB-TEC-01":
        return TEC
    if result.playbook_id == "PB-CLN-01":
        return CLN
    return UNCLEAR if result.reason_code == "CATEGORY_UNCLEAR" else OUT


def expected_label(sentence: str, expected: str) -> str:
    return RESIDUAL[sentence][0] if sentence in RESIDUAL else expected


def violations() -> list[tuple[str, str, str, str]]:
    """(text, kind, expected, got) for every variant that breaks an invariant; used by the tests and the report."""
    found = []
    for sentence, expected in CORPUS:
        want = expected_label(sentence, expected)
        for text, location in variants(sentence):
            if (got := label(text)) != want:
                found.append((text, "type", want, got))
            if (loc := extract_location(text, BUILDINGS)) != location:
                found.append((text, "location", location, str(loc)))
    return found


def test_corpus_size_and_shape():
    assert len(LIGHTING) >= 40 and len(CLEANING) >= 40 and len(OUT_OF_SCOPE) >= 25 and len(MIXED) >= 15
    assert len(CORPUS) >= 120 and len({s for s, _ in CORPUS}) == len(CORPUS)
    assert len(TEMPLATES) * 2 >= 8
    assert set(RESIDUAL) <= {s for s, _ in CORPUS}


@pytest.mark.parametrize(("sentence", "expected"), CORPUS)
def test_corpus_sentences_carry_no_location(sentence, expected):
    """So the location of a variant can only come from its template."""
    assert missing_location_parts(sentence, BUILDINGS) == ["building", "floor", "area"], sentence
    assert missing_location_parts(strip_accents(sentence), BUILDINGS) == ["building", "floor", "area"], sentence


@pytest.mark.parametrize(("sentence", "expected"), CORPUS)
def test_location_never_changes_the_job_type(sentence, expected):
    want = expected_label(sentence, expected)
    wrong = [(text, got) for text, _ in variants(sentence) if (got := label(text)) != want]
    assert not wrong, f"expected {want}: {wrong}"


@pytest.mark.parametrize(("template", "location"), TEMPLATES)
def test_location_is_extracted_from_every_template(template, location):
    wrong = []
    for sentence, _ in CORPUS:
        text = template.format(s=sentence.rstrip(".?! "))
        for variant in (text, strip_accents(text)):
            if (got := extract_location(variant, BUILDINGS)) != location:
                wrong.append((variant, got))
    assert not wrong, wrong


def test_metamorphic_suite_has_no_violation():
    found = violations()
    assert not found, f"{len(found)} violations, first: {found[:5]}"


# ---------------------------------------------------------------------- proposer: rules x fake LLM over the corpus

PAIRS = {
    TEC: ("KY_THUAT", "COMMON_AREA_LIGHTING"),
    CLN: ("VE_SINH", "COMMON_AREA_CLEANING"),
    "UNKNOWN": ("UNKNOWN", "UNKNOWN"),
}
PLAYBOOK = {TEC: "PB-TEC-01", CLN: "PB-CLN-01"}
WRAP = TEMPLATES[0][0]


def llm_says(answer: str):
    service, ticket_type = PAIRS[answer]

    def llm(description):
        return LLMAssessment(service_category=service, ticket_type=ticket_type, reason="Lý do giả lập")

    return llm


def failing_llm(description):
    raise TimeoutError("timeout")


def corpus_with(*labels: str) -> list[str]:
    return [WRAP.format(s=s.rstrip(".?! ")) for s, e in CORPUS if expected_label(s, e) in labels]


@pytest.mark.parametrize("text", corpus_with(TEC, CLN))
def test_rules_match_and_llm_agrees_keeps_the_rules(text):
    rules = classify(text)
    result = propose(text, llm_says(label(text)), "fake")
    assert result.classification == rules and not result.needs_review
    assert result.proposer == "rules+llm:fake"


@pytest.mark.parametrize("text", corpus_with(TEC, CLN))
def test_rules_match_and_llm_unknown_goes_to_bptn(text):
    result = propose(text, llm_says("UNKNOWN"), "fake")
    assert result.classification.playbook_id is None
    assert result.classification.reason_code == "CATEGORY_UNCLEAR" and not result.needs_review


@pytest.mark.parametrize("text", corpus_with(TEC, CLN))
def test_rules_and_llm_disagreeing_goes_to_bptn(text):
    other = CLN if label(text) == TEC else TEC
    result = propose(text, llm_says(other), "fake")
    assert result.classification.playbook_id is None
    assert result.classification.reason_code == "CATEGORY_UNCLEAR"


@pytest.mark.parametrize("text", corpus_with(OUT))
@pytest.mark.parametrize("answer", [TEC, CLN])
def test_llm_alone_proposing_a_playbook_needs_review(text, answer):
    result = propose(text, llm_says(answer), "fake")
    assert result.classification.playbook_id == PLAYBOOK[answer] and result.needs_review


@pytest.mark.parametrize("text", corpus_with(UNCLEAR))
@pytest.mark.parametrize("answer", [TEC, CLN, "UNKNOWN"])
def test_a_mixed_report_stays_unclear_whatever_the_llm_picks(text, answer):
    """The rules saw both playbooks: the LLM picking one must not hide the other part from BPTN."""
    result = propose(text, llm_says(answer), "fake")
    assert result.classification.playbook_id is None
    assert result.classification.reason_code == "CATEGORY_UNCLEAR"


@pytest.mark.parametrize("text", corpus_with(OUT))
def test_llm_unknown_on_out_of_scope_stays_out_of_scope(text):
    result = propose(text, llm_says("UNKNOWN"), "fake")
    assert result.classification.reason_code == "OUT_OF_SCOPE" and not result.needs_review


@pytest.mark.parametrize("text", corpus_with(TEC, CLN, UNCLEAR, OUT))
def test_llm_failure_falls_back_to_the_rules(text):
    result = propose(text, failing_llm, "fake")
    assert result.classification == classify(text)
    assert result.proposer == "rules" and "TimeoutError" in result.notes[0]
