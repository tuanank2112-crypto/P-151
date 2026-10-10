# SPEC-P09 (PROPOSED) — Điều phối & Phân loại theo Ngữ nghĩa (Semantic Coordination & Decision Contract)

| Trường | Giá trị |
|---|---|
| Trạng thái | **PROPOSED (CHƯA CÓ HIỆU LỰC)** — Đang trình duyệt; P01 và P08 vẫn giữ hiệu lực vận hành cho tới khi tài liệu này được duyệt chính thức |
| Ngày cập nhật | 2026-10-07 (Vòng 3: Chốt kiến trúc B1–B4, khắc phục triệt để binding đơn vị, bất biến tách, quyền bước đi, và adapter đọc kép) |
| Người thiết kế | Architect (🔴) — Gói WP16 / H15 |
| Căn cứ & Yêu cầu | Yêu cầu người dùng ngày 2026-10-07: Agent thực hiện điều phối/phân loại theo ngữ nghĩa, không code cứng hoặc dò từng từ khóa (word-by-word); giải quyết mâu thuẫn giữa Q01 và G-1, lỗ hổng vị trí từng phần F3/A1/B1, cơ chế tách hai việc F8/A2/B2, ràng buộc bước đi A3/B3, và kiến trúc tương thích đọc kép A4/B4 |
| Phạm vi áp dụng | Module `src/maintenance/agent/`, `src/maintenance/coordination/`, `src/maintenance/rules.py`, `src/maintenance/engine.py`, `src/config.py` |

---

## 1. Bối cảnh & Ranh giới phân quyền: Danh mục vs Ngữ nghĩa

### 1.1 Vấn đề hiện tại
> ⚠ Bị thay thế bởi SPEC-P10 §2, §7 (Q35) — phần: gạch B1 và gạch B2

- **Mâu thuẫn cốt lõi giữa Q01 và G-1:** Q01 khẳng định Agent là trung tâm điều phối, toàn quyền quyết định ngữ nghĩa. Tuy nhiên, bảng bất đồng hiện hành tại [`SPEC-P01`](SPEC-P01-reasoning-agent.md) §6 và `reconcile.py` lại đặt quy tắc `G-1` là `SERIOUS`: nếu Agent chọn loại việc không nằm trong tập `rv.categories` (tính bằng regex dò từ khóa cố định trong `rules.py`), ticket bị chặn và dừng tại `PENDING_REVIEW`. Điều này biến bộ regex cứng thành "cơ quan kiểm duyệt", tước đoạt năng lực hiểu ngôn ngữ tự nhiên của Agent.
- **Lỗ hổng bằng chứng vị trí theo đơn vị (B1):** Thuật toán so khớp chuỗi con đơn thuần (`_fold(value) in _fold(quote)`) dẫn đến sai lệch nghiêm trọng: tầng 1 bị khớp nhầm vào `"tầng 10"`; tầng 7 bị khớp nhầm vào số căn hộ `"căn hộ 1702"`; tòa S1 bị khớp nhầm vào tòa con `"tòa S1.12"`. Hợp đồng vị trí bắt buộc phải so khớp đúng ranh giới từ (word boundary) và đúng đơn vị định danh thực thể.
- **Tách hai việc & Hai vị trí (B2):** Schema cũ chấp nhận tách khi chỉ có 1 job hoặc 2 jobs cùng loại; đồng thời nếu 2 việc ở 2 vị trí khác biệt (vd rác ở S1 tầng 3, đèn ở S2 tầng 7), việc thiếu `location_override` sẽ khiến cả hai job tự kế thừa vị trí ticket gốc, dẫn tới tách sai nơi. Hợp đồng bắt buộc phải chốt chặt điều kiện tách chỉ dành cho co-located jobs thuộc đúng `SPLIT_PAIR` (`VE_SINH` + `KY_THUAT`).
- **Phân cấp Quyền & An toàn là số 1 (B3):** Trường đã khóa (`locked_fields`) chỉ bảo vệ giá trị của trường đó, TUYỆT ĐỐI KHÔNG bypass tầng an toàn. An toàn (Bậc 1 / Bậc 2) luôn là ưu tiên tối thượng, chặn mọi thao tác giao việc hoặc tách ticket.
- **Kiến trúc Tương thích Đọc kép & Adapter (B4):** Schema P09 phải duy trì 100% tính tương thích với parser P01 và storage JSONB `extra="forbid"`. Dữ liệu ngữ nghĩa mở rộng được lưu trữ an toàn trong trường `semantic_metadata`, có adapter chuyển đổi hai chiều hoàn chỉnh và cơ chế invalidation cache bằng fingerprint chứa policy version.

### 1.2 Bảng phân định ranh giới bất biến (Hard Invariants vs Semantic Discretion)
> ⚠ Bị thay thế bởi SPEC-P10 §2 (Q35) — phần: ý "kiểm tra liên kết giá trị - bằng chứng" (trụ 1) và "kiểm chứng bằng chứng trích dẫn" (trụ 4)

| Trụ cột | Quyền hạn & Trách nhiệm của Engine (Bất biến, Hard Invariants) | Quyền quyết định của Agent (Semantic Discretion) |
|---|---|---|
| **1. Danh mục & Vị trí (Catalog & Site)** | • Định nghĩa danh sách thực thể hợp lệ: các tòa thuộc `catalog.site.buildings`, nhãn khu vực `AREA_PATTERNS`, mã tài sản `AssetCandidate`, mã vật tư `catalog.playbook_materials`.<br>• Thực thi kiểm tra liên kết giá trị - bằng chứng (Value-Evidence Binding) đúng ranh giới từ và đơn vị thực thể.<br>• Từ chối bất kỳ giá trị nào không thuộc danh mục đóng (`rejected`). | • Hiểu mô tả gián tiếp của cư dân để ánh xạ vào đúng thực thể danh mục.<br>• Phân định nơi ở của cư dân vs nơi xảy ra sự cố.<br>• Xác định mức độ đầy đủ của vị trí. |
| **2. Quyền hạn & Giao dịch (Permissions & Transaction)** | • Kiểm soát RBAC nghiêm ngặt (`ActorRole`), chuyển trạng thái theo `TRANSITIONS`.<br>• Đảm bảo tính nguyên tử DB (`repo.transaction()`), khoá lạc quan / concurrency.<br>• Quyền con người là tối thượng (`locked_fields`, `HUMAN_OVERRIDE`), nhưng `locked_fields` không được bypass an toàn. | • Hoàn toàn KHÔNG can thiệp vào quyền hạn hoặc luồng giao dịch.<br>• Đóng vai trò là hàm thuần nhận dữ liệu và trả về cấu trúc quyết định. |
| **3. An toàn lưới sàn (Safety Floor)** | • Luật cố định bảo toàn mức sàn: 0 bỏ sót Bậc 1.<br>• Nguyên tắc bất biến: Mức an toàn cuối = `max(luật, Agent, mức hiện có)`.<br>• Chỉ con người (BPTN/BQL) mới có quyền hạ mức an toàn.<br>• An toàn được xét TRƯỚC phân loại và tách ticket. | • Agent **CHỈ ĐƯỢC PHÉP NÂNG MỨC** khi phát hiện nguy cơ tiềm ẩn ngoài từ khóa (qua `S-00` hoặc nâng Bậc 2 lên Bậc 1).<br>• CẤM Agent hạ mức an toàn dưới mức luật đã nhận diện. |
| **4. Ngữ nghĩa & Điều phối (Semantics & Coordination)** | • Cung cấp đầy đủ bối cảnh ứng viên (`DecisionInput`).<br>• Kiểm chứng bằng chứng trích dẫn của Agent (`validate`).<br>• Cung cấp mạng lưới dự phòng (`FALLBACK_RULE`) khi Agent lỗi. | • **TOÀN QUYỀN PHÂN LOẠI:** Chọn `ServiceCategory` dựa trên bản chất sự việc, không bị regex từ khóa phủ quyết.<br>• **PHÂN TÍCH NHÂN QUẢ:** Tự đánh giá 2 sự việc là độc lập (tách) hay nguyên nhân - kết quả.<br>• **ĐIỀU PHỐI TIẾP THEO:** Quyết định `next_step` (tiến hành, hỏi thêm, hay chuyển BPTN). |

---

## 2. Kiến trúc tối thiểu đáp ứng yêu cầu (Minimum Viable Architecture)

### 2.1 Đánh giá và Lựa chọn Kiến trúc
1. **Mô hình A — Vòng lặp Công cụ (Multi-turn Tool-calling / ReAct Loop):**
   - *Đánh giá lý thuyết:* Tăng số vòng truyền nhận mạng ($3-4 \text{ RTT}$ thay vì $1 \text{ RTT}$), làm tăng nguy cơ timeout SLA (25s) và chi phí token; dễ gây race condition với trạng thái giao dịch DB.
2. **Mô hình B — Quyết định có cấu trúc một lượt kèm Hợp đồng Bằng chứng Đa thành phần (Single-turn Structured Decision with Multi-part Evidence Grounding):**
   - *Đánh giá lý thuyết:* Chỉ 1 lượt gọi LLM ($1 \text{ RTT}$); engine cung cấp sẵn toàn bộ ứng viên trong `DecisionInput`; kiểm soát schema bằng Pydantic; tương thích 100% với nguyên tắc gọi ngoài khoá (I-16).
   - *Ghi chú ước tính (A6 / B4):* Độ trễ và chi phí token thực tế sẽ được benchmark và khẳng định chính thức tại cổng `G-LIVE-6`. Về mặt kiến trúc, Mô hình B là giải pháp tối thiểu đáp ứng đầy đủ yêu cầu nghiệp vụ.

**KẾT LUẬN KIẾN TRÚC:** Chọn **Mô hình B (Single-turn Structured Decision)** làm kiến trúc cốt lõi.

### 2.2 Phân định Rõ ràng: Trách nhiệm của Code vs Trách nhiệm của Model (A6)
> ⚠ Bị thay thế bởi SPEC-P10 §2 (Q35) — phần: Code mục 1 (grounded) và mục 2 (liên kết giá trị với quote)

- **Phần Code (Engine / Validator) kiểm tra tính toàn vẹn cấu trúc:**
  1. Kiểm tra trích dẫn nguyên văn: Chuỗi quote phải có mặt trong văn bản (`grounded`).
  2. Kiểm tra liên kết giá trị: Giá trị `building`, `floor`, `area` phải được phản ánh tường minh trong quote theo đúng ranh giới từ và đơn vị.
  3. Kiểm tra danh mục đóng: Tòa nhà thuộc `site.buildings`, khu vực thuộc `AREA_PATTERNS`, vật tư thuộc playbook.
  4. Bảo toàn an toàn: `max(luật, Agent, hiện có)`, không bao giờ hạ mức.
- **Phần Model (Agent) chịu trách nhiệm diễn giải ngữ nghĩa:**
  1. Hiểu ngữ cảnh diễn đạt: Nhận diện hiện tượng để phân loại đúng `ServiceCategory`.
  2. Phân tích quan hệ nhân quả: Phán đoán 2 sự việc là nguyên nhân - kết quả hay đồng hiện độc lập.
  3. Phân định nơi ở vs nơi sự cố.
- **Cơ chế xử lý khi bất định:** Nếu mô hình không chắc chắn về thông tin hoặc phát hiện mâu thuẫn $\rightarrow$ Mô hình BẮT BUỘC phải chọn `next_step: TO_BPTN` hoặc `ASK_RESIDENT`.

---

## 3. Hợp đồng Chứng minh Vị trí & Value-Evidence Binding Predicates (B1)
> ⚠ Bị thay thế bởi SPEC-P10 §3.2, §5 (Q35)

### 3.1 Nhận diện Lỗ hổng So khớp Chuỗi Con
Việc so khớp chuỗi con không kiểm tra ranh giới từ dẫn tới 3 sai lệch kinh điển:
1. `floor="1"` khớp nhầm chuỗi con `"1"` trong `"tầng 10"`.
2. `floor="7"` khớp nhầm chuỗi con `"7"` trong số căn hộ `"căn hộ 1702"`.
3. `building="S1"` khớp nhầm chuỗi con `"S1"` trong tòa nhà con `"tòa S1.12"`.

Do đó, hợp đồng bắt buộc phải sử dụng **Vị từ Liên kết Giá trị - Bằng chứng theo Đơn vị (Unit-level Value-Evidence Binding)**.

### 3.2 Cấu trúc Dữ liệu `LocationEvidence`
Kế thừa toàn bộ các trường của `LocationDecision` (P01) để giữ tương thích, đồng thời mở rộng các trường bằng chứng độc lập:

```python
class LocationEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    # Tương thích P01
    building: str | None = None
    floor: str | None = None
    area: str | None = None
    quote: str | None = None  # Legacy P01
    reason: str = Field(default="Trích xuất từ phản ánh", min_length=1, max_length=300)

    # Mở rộng P09: Bằng chứng độc lập từng thành phần
    building_quote: str | None = None
    floor_quote: str | None = None
    is_implied_floor: bool = False  # True nếu tầng được suy từ khu vực ngầm định
    area_quote: str | None = None

    # Phân định nơi ở vs nơi sự cố
    residence_mention: str | None = None     # Vd: "P.1504 tòa S1"
    incident_mention: str | None = None      # Vd: "Sảnh tầng 1 tòa S2"
    location_rationale: str = Field(default="Căn cứ trích dẫn ngữ cảnh", min_length=5, max_length=500)
```

### 3.3 Thuật toán Kiểm tra Liên kết Giá trị - Bằng chứng (`validate_location_evidence`)

```python
@dataclass(frozen=True)
class LocationValidationResult:
    location: str | None             # "Tòa X / Tầng Y / Khu Z" khi đủ 3 phần hợp lệ
    building: str | None
    floor: str | None
    area: str | None
    missing_parts: tuple[str, ...]    # ("building", "floor", "area")
    rejected: tuple[str, ...]         # ["location.building", ...]
    is_incident_location: bool        # True nếu xác định đúng nơi sự cố
```

**Các vị từ kiểm tra liên kết (Binding Predicates):**
1. **Phân tách Mệnh đề Sự cố vs Nơi ở:**
   - **Xác định Vùng Sự cố vs Vùng Nơi ở (Offset & Spans):**
     - Mệnh đề nơi ở (`residence_spans`) được xác định qua `rules.RESIDENCE_CUE` và `rules.CLAUSE_END`. Vùng sự cố (`incident_span`) là toàn bộ các khoảng ký tự nằm NGOÀI mọi `residence_spans`.
     - `residence_spans` và các trích dẫn `quote` BẮT BUỘC cùng được định vị trên một hệ tọa độ chuẩn hóa (`norm_text = normalize(text)`).
     - Một trích dẫn vị trí `quote` được coi là hợp lệ nếu tồn tại ít nhất MỘT vị trí xuất hiện (occurrence) `[q_start, q_end)` của `quote` trong toàn văn hoàn toàn KHÔNG giao với bất kỳ khoảng nơi ở `[s, e)` nào (tức là không bị bao trọn, không nằm trong và không giao một phần):
       ```python
       def is_quote_in_incident_span(quote: str, text: str, residence_spans: list[tuple[int, int]]) -> bool:
           norm_quote = normalize(quote)
           norm_text = normalize(text)
           if not norm_quote or norm_quote not in norm_text:
               return False
           for m in re.finditer(re.escape(norm_quote), norm_text):
               q_start, q_end = m.start(), m.end()
               # Kiểm tra giao giữa hai khoảng [q_start, q_end) và [s, e)
               # Hai khoảng giao nhau khi: max(q_start, s) < min(q_end, e)
               # Bao gồm: q bao trọn s-e, q nằm trong s-e, hoặc q giao một phần với s-e
               overlaps_residence = any(max(q_start, s) < min(q_end, e) for s, e in residence_spans)
               if not overlaps_residence:
                   return True
           return False
       ```
     - Nếu cùng một từ khóa (ví dụ `tòa S1`) xuất hiện cả ở nơi ở lẫn nơi sự cố (vd: *"Tôi ở tòa S1 tầng 3, đi qua tòa S1 tầng 7 thấy rác"*), occurrence trong sự cố không giao với residence span đảm bảo trích dẫn `tòa S1` được chấp nhận hợp lệ, không bị loại trừ nhầm.
     - Ngược lại, nếu quote bao trọn khoảng nơi ở (vd `"Tôi ở căn hộ 1702 tòa S1"`), điều kiện `max(q_start, s) < min(q_end, e)` phát hiện giao nhau và từ chối hợp lệ.
2. **Kiểm tra Tòa nhà (`is_building_bound`):**
   - Quote phải grounded trong mệnh đề sự cố (`is_quote_in_incident_span=True`).
   - Trích xuất mã tòa bằng regex phân biệt ranh giới từ:
     `codes = sorted((re.escape(normalize(b)) for b in valid_buildings), key=len, reverse=True)`
     `pat = rf"(?<![a-z0-9-])(?:(?:toa(?: nha)?|block)\s+)?((?:{'|'.join(codes)})(?:\.\d{{1,2}})?)(?![a-z0-9-]|\.\d)"`
   - Mã tòa trích xuất được từ `building_quote` BẮT BUỘC phải trùng khớp hoàn toàn với `building.upper()`.
   - Nếu quote là `"tòa S1.12"` mà `building="S1"` $\rightarrow$ Vị từ trả `False` (không nhận).
   - Nếu quote là `"Hành lang"` mà `building="S2"` $\rightarrow$ Vị từ trả `False` (không nhận).
3. **Kiểm tra Tầng (`is_floor_bound`):**
   - Nếu `is_implied_floor is True`:
     - BẮT BUỘC `area in rules.IMPLIED_FLOOR` và `floor == rules.IMPLIED_FLOOR[area]`. Không cần `floor_quote`.
   - Nếu `is_implied_floor is False`:
     - Quote phải grounded trong mệnh đề sự cố (`is_quote_in_incident_span=True`).
     - Loại trừ số căn hộ: Nếu quote chứa cue căn hộ (`căn hộ`, `phòng`, `apt`, `p.`) kèm số mà không có cue tầng $\rightarrow$ Vị từ trả `False` (loại trừ số căn hộ 1702).
     - Trích xuất tầng bằng regex ranh giới từ hỗ trợ cả tầng hầm, tầng trệt và tầng thường:
       `FLOOR_PATTERN = r"(?i)(?<![a-z0-9-])(?:(?:tang|tầng|lau|lầu|f|fl|floor)(?:\s+(?:ham|hầm))?|(?:ham|hầm))\s+(b?\d{1,2}|tret|trệt|g)(?![a-z0-9-])"`.
     - Tầng trích xuất được BẮT BUỘC phải trùng khớp hoàn toàn với `floor` (chuẩn hóa hoa/thường: `"B1"` $\leftrightarrow$ `"b1"`, `"10"` $\leftrightarrow$ `"10"`).
     - Nếu quote là `"tầng 10"` mà `floor="1"` $\rightarrow$ Vị từ trả `False` (không nhận).
     - Nếu quote là `"tầng 7"` mà `floor="7"` $\rightarrow$ Vị từ trả `True`.
     - Nếu quote là `"tầng hầm B1"` hoặc `"hầm B1"` mà `floor="B1"` $\rightarrow$ Vị từ trả `True`.
4. **Kiểm tra Khu vực (`is_area_bound`):**
   - Quote phải grounded trong mệnh đề sự cố (`is_quote_in_incident_span=True`).
   - `area` phải khớp nhãn chuẩn hoặc mẫu regex trong `rules.AREA_PATTERNS`.
5. **Đối chứng Hợp lệ (Positive & Negative Controls):**
   - *Positive:* `"Hành lang tầng 3 tòa S1 có rác"` $\rightarrow$ building="S1", floor="3", area="Hành lang" $\rightarrow$ ACCEPTED.
   - *Positive:* `"Sảnh chính tòa S1 bị ngập"` $\rightarrow$ building="S1", is_implied_floor=True, floor="1", area="Sảnh chính" $\rightarrow$ ACCEPTED.
   - *Positive:* `"Tòa S2.12 tầng hầm B1 khu vực bãi xe"` $\rightarrow$ building="S2.12", floor="B1", area="Hầm xe" $\rightarrow$ ACCEPTED.
   - *Positive:* `"Tôi ở tòa S1 tầng 3, đi qua tòa S1 tầng 7 thấy hành lang có rác"` $\rightarrow$ building="S1", floor="7", area="Hành lang" $\rightarrow$ ACCEPTED (nhận diện đúng occurrence tại tầng 7).
   - *Negative (Chặn bao trọn nơi ở):* Quote `"Tôi ở tòa S1 tầng 3"` bao trọn residence span `(0, 19)` $\rightarrow$ REJECTED (`is_quote_in_incident_span = False`).
   - *Negative (Chặn trích dẫn nơi ở):* Quote `"tầng 3"` nằm trong residence span `(0, 19)` $\rightarrow$ REJECTED (`is_quote_in_incident_span = False`).

---

## 4. Quyền Quyết định Ngữ nghĩa, Tách Ticket & Điều phối Tiếp theo (B2, B3)

### 4.1 Bãi bỏ Quyền Phủ quyết của G-1 trong Phân loại Nghiệp vụ
- Khi Agent chọn `category` (ví dụ: `KY_THUAT`) mà bộ luật regex `rules.py` không có từ khóa:
  - Nếu `job.quote` của Agent grounded và liên kết ngữ nghĩa hợp lệ $\rightarrow$ Engine **CHẤP NHẬN PHÂN LOẠI CỦA AGENT**.
  - Ghi nhận bất đồng ở mức **`MINOR (ADVISORY)`** vào audit log. **TUYỆT ĐỐI KHÔNG CHẶN TICKET** tại `PENDING_REVIEW`.

### 4.2 Phân tích Nhân quả, Tách Ticket & Bất biến Nhiều Vị trí (B2)
> ⚠ Bị thay thế bởi SPEC-P10 §7, §11 (Q35) — tách giữ P05 §3 + P08 §6 hiện hành

```python
class SplitAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    is_mixed_report: bool
    is_causally_linked: bool
    causality_explanation: str | None = None
    should_split: bool
    split_rationale: str = Field(min_length=5, max_length=500)
    job_locations_identical: bool  # BẮT BUỘC KHAI BÁO, CẤM GIÁ TRỊ MẶC ĐỊNH
    shared_location: LocationEvidence | None = None  # Chứng cứ vị trí chung của cả hai công việc khi tách

    @model_validator(mode="after")
    def validate_split_invariants(self) -> "SplitAnalysis":
        if self.is_causally_linked and self.should_split:
            raise ValueError("Không thể tách khi hai sự việc có quan hệ nhân quả (is_causally_linked=True)")
        if self.should_split:
            if not self.is_mixed_report:
                raise ValueError("should_split=True yêu cầu is_mixed_report=True")
            if not self.job_locations_identical:
                raise ValueError("should_split=True yêu cầu hai công việc cùng vị trí (job_locations_identical=True)")
        return self
```

**Bất biến Tách Ticket & Hai Vị trí (B2):**
1. **Đúng 2 Jobs thuộc `SPLIT_PAIR`:** Tách ticket chỉ được phép khi có đúng 2 jobs với hai loại việc khác nhau: một `VE_SINH` và một `KY_THUAT`. Cấm tách khi có 1 job hoặc 2 jobs cùng loại việc.
2. **Bắt buộc Bằng chứng Vị trí Riêng hoặc Chứng cứ Chung — Cấm Thừa Kế Ngầm Vị trí:**
   - Agent chịu trách nhiệm suy luận quan hệ ngữ nghĩa và vị trí; code engine/schema kiểm tra cấu trúc và tính liên kết ràng buộc (binding), **TUYỆT ĐỐI CẤM dùng regex đoán thay vị trí từ quote rút gọn** (như `"có rác"`, `"đèn hỏng"`).
   - Thiếu `location_override` KHÔNG ĐƯỢC TỰ ĐỘNG SUY ĐOÁN LÀ CÙNG NƠI.
   - Khi `should_split=True`: Cả hai jobs bắt buộc phải chứng minh cùng vị trí theo một trong hai cơ chế cấu trúc sau khi đã vượt qua kiểm chứng liên kết bằng chứng §3.3:
     - **Cơ chế Override riêng:** Cả hai jobs cùng có `location_override: LocationEvidence`. BẮT BUỘC mỗi override phải có đầy đủ cả 3 thành phần (`building`, `floor`, `area` không rỗng). Cấm tuyệt đối override rỗng (`{}`) hoặc thiếu thành phần (chỉ có tòa hoặc chỉ có tầng). Hai override bắt buộc phải trùng khớp hoàn toàn trên cả 3 thành phần sau khi chuẩn hóa (`building`, `floor` và `area`). Nếu khác bất kỳ thành phần nào (kể cả cùng tòa/tầng nhưng khác khu vực, vd `Hành lang` vs `Thang máy`, hoặc khác tòa `S1` vs `S2`) $\rightarrow$ Schema từ chối với `ValueError`. Nếu bất kỳ thành phần vị trí nào của override bị loại do trượt binding §3.3, tuyệt đối cấm lấy lại giá trị từ `root location` để gượng ép tách ticket.
     - **Cơ chế Chứng cứ Vị trí Chung:** Khi các jobs không khai `location_override` riêng, BẮT BUỘC phải cung cấp `split_analysis.shared_location: LocationEvidence` có đủ 3 thành phần (`building`, `floor`, `area`) và khớp hoàn toàn với `self.location`. Nếu thiếu `shared_location` hoặc `shared_location` thiếu thành phần $\rightarrow$ Schema từ chối với `ValueError` (ngăn chặn triệt để việc quote rút gọn mồ côi tự ý thừa kế vị trí).
     - Không chấp nhận tình trạng một job có override và một job không có.
3. **Cơ chế Xử lý Lỗi Nhất Quán (Error Handling Pathway):**
   - **Luồng chuẩn (Happy path):** Khi phát hiện sự cố xảy ra ở hai vị trí khác nhau, mô hình BẮT BUỘC phát ra:
     `should_split=False, job_locations_identical=False, next_step="TO_BPTN", bptn_reason="COMPLEX_CLAIM"`.
     Engine tiếp nhận và chuyển ticket sang BPTN với mã `ReasonCode.COMPLEX_CLAIM`.
   - **Luồng vi phạm hợp đồng (Schema violation):** Nếu mô hình vi phạm hợp đồng (đòi `should_split=True` dù hai vị trí khác nhau, hoặc khai `job_locations_identical=True` mà quote mâu thuẫn vị trí) $\rightarrow$ Schema Pydantic ném `ValueError` $\rightarrow$ Engine bắt `SCHEMA_INVALID` $\rightarrow$ Kích hoạt `FALLBACK_RULE` an toàn, ngăn chặn việc tách ticket sai vị trí.
4. **Ưu tiên An toàn Tuyệt đối:**
   - Bước 2b (An toàn) luôn chạy trước Bước 3 (Tách ticket).
   - Nếu ticket có `risk_level != RiskLevel.NONE` (Bậc 1 hoặc Bậc 2) $\rightarrow$ `_try_split` trả `False` vô điều kiện.

### 4.3 Phân cấp Quyền Ưu tiên & Bất biến Bước Đi Tiếp theo (B3)

**Hệ thống Phân cấp Quyền Ưu tiên Quyết định:**
```text
1. Safety Assessment (Tầng An toàn) -> Ưu tiên tối thượng: Ngăn chặn giao việc và ngăn tách ticket.
2. Locked Fields (Khóa Trường Nhân viên) -> Bảo toàn giá trị trường đã khóa (category, location).
   KHÔNG ĐƯỢC PHÉP bypass an toàn.
3. Agent Decision next_step:
   - TO_BPTN -> Dừng chuyển BPTN theo bảng ánh xạ ReasonCode.
   - ASK_RESIDENT -> Dừng MISSING_INFO, gửi câu hỏi cư dân (khi an toàn NONE).
   - PROCEED -> Tiếp tục Bước 2 (Kiểm tra vị trí đủ) -> Bước 3 (Phân loại / Tách).
```

**Bảng Ánh xạ `bptn_reason` sang `ReasonCode` hiện hành của Engine:**
| Giá trị `bptn_reason` | Trạng thái Ticket | `ReasonCode` (Enums) | Chủ Blocker | Resume Step | Ghi chú Audit / Hành vi |
|---|---|---|---|---|---|
| `OUT_OF_SCOPE` | `VERIFYING` | `OUT_OF_SCOPE` | BPTN | 2 | Phản ánh ngoài phạm vi, không hỏi lại vị trí |
| `CATEGORY_UNCLEAR` | `VERIFYING` | `CATEGORY_UNCLEAR` | BPTN | 4 | Loại việc chưa rõ ràng cần người phân định |
| `SUSPICIOUS` | `VERIFYING` | `PENDING_REVIEW` | BPTN | 6 | Nghi vấn phá hoại/báo khống cần thẩm tra |
| `COMPLEX_CLAIM` | `VERIFYING` | `CATEGORY_UNCLEAR` | BPTN | 4 | Khiếu nại phức tạp / hai việc ở hai vị trí |

**Chuỗi Xử lý Nhiều Lượt (Multi-turn Workflow):**
1. Agent chọn `ASK_RESIDENT` $\rightarrow$ Ticket chuyển `NEED_INFO` (blocker `MISSING_INFO`, chủ BPTN), public message = `ask_resident_message` (cấm chứa nội dung/hướng dẫn nguy hiểm).
2. Cư dân bổ sung thông tin qua `add_resident_info`:
   - Bước 2b chạy lại ngay lập tức (P08 F1). Nếu phát hiện dấu hiệu an toàn $\rightarrow$ chuyển quy trình an toàn ngay lập tức.
   - Nếu an toàn NONE: engine tính lại quyết định Agent ngoài khóa với văn bản cập nhật $\rightarrow$ nếu vị trí đủ và hợp lệ $\rightarrow$ gỡ `MISSING_INFO`, chuyển tiếp sang phân loại.

---

## 5. Hợp đồng Thiết kế Chi tiết & Tính Tương thích Đọc Kép (B4)

### 5.1 Schema `AgentSemanticDecision`
> ⚠ Bị thay thế bởi SPEC-P10 §3.1 (Q35) — phần: khối "# 3. Ràng buộc tách ticket và hai vị trí (B2)" và các trường quote của `LocationEvidence`

```python
class SemanticJobDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    category: Literal["VE_SINH", "KY_THUAT"]
    quote: str = Field(min_length=1, max_length=500)
    reason: str = Field(min_length=1, max_length=500)
    department_id: Literal["DEPT_CLEANING", "DEPT_TECHNICAL"] | None = None
    priority: Literal["HIGH", "MEDIUM", "LOW"]
    priority_rule_id: Literal["PRI-H1", "PRI-H2", "PRI-M1", "PRI-M2", "PRI-L1", "PRI-D0", "PRI-SEMANTIC"] = "PRI-SEMANTIC"
    priority_reason: str = Field(default="Theo mức độ ảnh hưởng nghiệp vụ", min_length=1, max_length=300)
    duplicate_of: str | None = None
    duplicate_reason: str = Field(default="Không phát hiện trùng", min_length=1, max_length=300)
    asset_id: str | None = None
    asset_reason: str = Field(default="Không gắn tài sản cụ thể", min_length=1, max_length=300)
    materials: list[MaterialChoice] = Field(default_factory=list, max_length=5)
    needs_review: bool = False
    review_reason: str | None = None

    location_override: LocationEvidence | None = None

    @model_validator(mode="after")
    def validate_job_fields(self) -> "SemanticJobDecision":
        if self.needs_review and not (self.review_reason or "").strip():
            raise ValueError("needs_review=True yêu cầu có review_reason")
        return self


class AgentSemanticDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: Literal["agent-decision/1", "agent-semantic/1"] = "agent-semantic/1"
    reasoning: list[ReasoningStep] = Field(min_length=1, max_length=10)
    scope: Literal["IN_SCOPE", "OUT_OF_SCOPE", "UNCLEAR"] = "IN_SCOPE"
    safety: SafetyDecision
    location: LocationEvidence
    jobs: list[SemanticJobDecision] = Field(default_factory=list, max_length=2)
    next_step: Literal["PROCEED", "ASK_RESIDENT", "TO_BPTN"] = "PROCEED"
    ask_fields: list[AskField] = Field(default_factory=list, max_length=4)
    bptn_reason: Literal["OUT_OF_SCOPE", "CATEGORY_UNCLEAR", "SUSPICIOUS", "COMPLEX_CLAIM"] | None = None
    note_for_staff: str = Field(default="", max_length=500)

    split_analysis: SplitAnalysis | None = None
    ask_resident_message: str | None = None

    @model_validator(mode="after")
    def validate_semantic_invariants(self) -> "AgentSemanticDecision":
        # 1. Ràng buộc scope và jobs
        if (self.scope == "IN_SCOPE") != (1 <= len(self.jobs) <= 2):
            raise ValueError("scope=IN_SCOPE yêu cầu 1..2 jobs; scope khác yêu cầu 0 jobs")

        # 2. Ràng buộc next_step (B3)
        if self.next_step == "PROCEED":
            if len(self.jobs) == 0:
                raise ValueError("PROCEED yêu cầu có ít nhất 1 job hợp lệ")
            if self.bptn_reason is not None:
                raise ValueError("PROCEED không được có bptn_reason")
            if len(self.ask_fields) > 0:
                raise ValueError("PROCEED yêu cầu ask_fields rỗng")
            if self.ask_resident_message is not None:
                raise ValueError("PROCEED không được có ask_resident_message")

        elif self.next_step == "ASK_RESIDENT":
            if len(self.ask_fields) == 0:
                raise ValueError("ASK_RESIDENT yêu cầu ask_fields không rỗng")
            if not self.ask_resident_message or len(self.ask_resident_message.strip()) < 10:
                raise ValueError("ASK_RESIDENT yêu cầu ask_resident_message tối thiểu 10 ký tự")
            if self.bptn_reason is not None:
                raise ValueError("ASK_RESIDENT không được có bptn_reason")

        elif self.next_step == "TO_BPTN":
            if self.bptn_reason is None:
                raise ValueError("TO_BPTN yêu cầu bptn_reason")
            if len(self.ask_fields) > 0:
                raise ValueError("TO_BPTN yêu cầu ask_fields rỗng")
            if self.ask_resident_message is not None:
                raise ValueError("TO_BPTN không được có ask_resident_message")

        # 3. Ràng buộc tách ticket và hai vị trí (B2)
        if self.split_analysis and self.split_analysis.should_split:
            if not self.split_analysis.job_locations_identical:
                raise ValueError("Tách bắt buộc job_locations_identical=True")
            if len(self.jobs) != 2:
                raise ValueError("Tách yêu cầu đúng 2 jobs")
            cats = {self.jobs[0].category, self.jobs[1].category}
            if cats != {"VE_SINH", "KY_THUAT"}:
                raise ValueError("Tách yêu cầu 2 jobs khác loại thuộc SPLIT_PAIR (VE_SINH + KY_THUAT)")

            # Xác định và so sánh vị trí của hai jobs theo cấu trúc và chứng cứ ràng buộc (CẤM regex đoán mò từ quote rút gọn)
            j0, j1 = self.jobs[0], self.jobs[1]
            if j0.location_override is not None and j1.location_override is not None:
                o0, o1 = j0.location_override, j1.location_override
                if not (o0.building and o0.floor and o0.area):
                    raise ValueError(
                        f"location_override của job 0 ({o0}) thiếu thành phần; bắt buộc có đủ building, floor và area!"
                    )
                if not (o1.building and o1.floor and o1.area):
                    raise ValueError(
                        f"location_override của job 1 ({o1}) thiếu thành phần; bắt buộc có đủ building, floor và area!"
                    )
                loc0 = (o0.building.upper(), o0.floor.upper(), normalize(o0.area))
                loc1 = (o1.building.upper(), o1.floor.upper(), normalize(o1.area))
                if loc0 != loc1:
                    raise ValueError(f"Hai công việc tại hai vị trí khác nhau ({loc0} vs {loc1}); không được tách!")
            elif (j0.location_override is not None) != (j1.location_override is not None):
                raise ValueError("Thiếu chứng cứ vị trí đồng bộ: một job có location_override trong khi job kia không có; không được tách!")
            else:
                if self.split_analysis.shared_location is None:
                    raise ValueError(
                        "Tách ticket yêu cầu chứng cứ vị trí đầy đủ gắn từng job (location_override) "
                        "hoặc chứng cứ vị trí chung (split_analysis.shared_location); "
                        "cấm suy đoán cùng nơi khi thiếu chứng cứ!"
                    )
                sl = self.split_analysis.shared_location
                if not (sl.building and sl.floor and sl.area):
                    raise ValueError("shared_location phải có đầy đủ building, floor và area để chứng minh vị trí chung")
                if self.location.building and sl.building.upper() != self.location.building.upper():
                    raise ValueError(f"shared_location building ({sl.building}) xung đột với location chính ({self.location.building})")
                if self.location.floor and sl.floor.upper() != self.location.floor.upper():
                    raise ValueError(f"shared_location floor ({sl.floor}) xung đột với location chính ({self.location.floor})")
                if self.location.area and normalize(sl.area) != normalize(self.location.area):
                    raise ValueError(f"shared_location area ({sl.area}) xung đột với location chính ({self.location.area})")

        return self
```

### 5.2 Bảng Ánh xạ Toàn diện sang P01 & Dual-read Adapter (B4)

| Field trong `AgentSemanticDecision` | Ánh xạ sang `AgentDecision` (P01) | Quy tắc chuyển đổi (Khớp 100% runtime `PRIORITY_RULES`) |
|---|---|---|
| `schema_version` | `"agent-decision/1"` | Giữ literal chuẩn P01 |
| `reasoning` | `reasoning` | Copy 1-1 danh sách `ReasoningStep` |
| `scope` | `scope` | Giữ nguyên `"IN_SCOPE"`, `"OUT_OF_SCOPE"`, `"UNCLEAR"` |
| `safety` | `safety` | Copy 1-1 `SafetyDecision` |
| `location` | `location` | Sinh `LocationDecision`: `building`, `floor`, `area`, `quote = (quote or building_quote or area_quote)`, `reason = location_rationale` |
| `jobs[i].category` | `jobs[i].category` | Giữ nguyên `VE_SINH` hoặc `KY_THUAT` |
| `jobs[i].department_id` | `jobs[i].department_id` | `KY_THUAT` $\rightarrow$ `DEPT_TECHNICAL`, `VE_SINH` $\rightarrow$ `DEPT_CLEANING` |
| `jobs[i].priority` | `jobs[i].priority` | • `VE_SINH`: Giữ nguyên `HIGH`, `MEDIUM`, `LOW`<br>• `KY_THUAT`: `HIGH` $\rightarrow$ `HIGH`, `MEDIUM` $\rightarrow$ `MEDIUM`.<br>**Quy tắc chuyển mức sàn Kỹ thuật (Floor Promotion Rule):** Nếu Agent chọn `LOW` cho `KY_THUAT`, do hệ sinh thái bảo trì kỹ thuật không có mức LOW trong `PRIORITY_RULES` (mức sàn là MEDIUM), adapter tự động nâng đồng bộ `priority` lên `"MEDIUM"` và gán `priority_rule_id = "PRI-M1"`. |
| `jobs[i].priority_rule_id`| `jobs[i].priority_rule_id` | Khớp 100% `PRIORITY_RULES` (cùng mức với `job.priority`):<br>• `KY_THUAT`: HIGH $\rightarrow$ `PRI-H1` (HIGH), MEDIUM $\rightarrow$ `PRI-M1` (MEDIUM), LOW $\rightarrow$ `PRI-M1` (sau khi nâng lên MEDIUM).<br>• `VE_SINH`: HIGH $\rightarrow$ `PRI-H2` (HIGH), MEDIUM $\rightarrow$ `PRI-M2` (MEDIUM), LOW $\rightarrow$ `PRI-L1` (LOW).<br>• Mặc định/chưa rõ: `PRI-D0` (MEDIUM).<br>*Bất biến kiểm tra:* `PRIORITY_RULES[job.category][job.priority_rule_id] == job.priority` luôn đạt `True` 100%. |
| `jobs[i].priority_reason`| `jobs[i].priority_reason` | Giữ nguyên; nếu là KY_THUAT LOW thì thêm: `"(Tự động nâng từ LOW lên sàn MEDIUM theo đặc tả PRIORITY_RULES của Kỹ thuật)"` |
| `next_step` | `next_step` | Giữ nguyên |
| `ask_fields` | `ask_fields` | Giữ nguyên |
| `bptn_reason` | `bptn_reason` | `OUT_OF_SCOPE` / `CATEGORY_UNCLEAR` giữ nguyên; `SUSPICIOUS` và `COMPLEX_CLAIM` $\rightarrow$ `CATEGORY_UNCLEAR` |
| `note_for_staff` | `note_for_staff` | Giữ nguyên |
| `semantic_metadata` | `semantic_metadata` | Lưu toàn bộ chi tiết ngữ nghĩa vào `SemanticMetadata` |

### 5.3 Ma trận Tương thích Ba Trạng thái & Schema Metadata (B4)

#### A. Định nghĩa Schema Metadata Chuẩn (`SemanticMetadata`)
```python
class JobSemanticEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    category: Literal["VE_SINH", "KY_THUAT"]
    quote: str = Field(min_length=1, max_length=500)
    semantic_reason: str = Field(min_length=1, max_length=500)
    location_override: LocationEvidence | None = None

class SemanticMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    policy_version: Literal["semantic_v1"] = "semantic_v1"
    location_evidence: LocationEvidence
    job_evidences: list[JobSemanticEvidence] = Field(default_factory=list, max_length=2)
    split_analysis: SplitAnalysis | None = None
    ask_resident_message: str | None = None
    original_bptn_reason: str | None = None
    prompt_version: str = ""
```

*Ràng buộc số lượng (Cardinality Invariants):*
- Số phần tử trong `job_evidences` đồng bộ 100% với số lượng `jobs` trong quyết định:
  - Khi `scope` là `OUT_OF_SCOPE` hoặc `UNCLEAR`: `len(jobs) == 0` $\rightarrow$ `job_evidences = []` (0 items). Không bị lỗi `too_short`.
  - Khi `scope` là `IN_SCOPE` đơn lẻ: `len(jobs) == 1` $\rightarrow$ `len(job_evidences) == 1`.
  - Khi `scope` là `IN_SCOPE` tách ticket: `len(jobs) == 2` $\rightarrow$ `len(job_evidences) == 2`.
- Khả năng Round-trip kiểm chứng: Đạt 100% cho cả 3 trường hợp 0, 1 và 2 jobs.

#### B. Ma trận Tương thích Ba Trạng thái Vận hành (Tri-state Compatibility Matrix)
1. **Trạng thái 1: Code MỚI (WP17):**
   - Model `AgentDecisionRecord` được bổ sung `semantic_metadata: dict[str, Any] | None = None`.
   - Đọc Document CŨ (từ P01, không có `semantic_metadata`): nạp bình thường, `semantic_metadata = None`.
   - Đọc Document MỚI (từ P09, có `semantic_metadata`): nạp cả `decision` (P01 compatible) và `semantic_metadata`.
2. **Trạng thái 2: Tắt cờ `mo_agent_semantic_enabled = False` trên Code MỚI:**
   - Hệ thống chuyển sang dùng pipeline P01 chuẩn, lưu record với `semantic_metadata = None`.
   - Đọc bình thường cả document cũ và mới.
   - Invalidation: Hàm `_content_fingerprint` chứa policy key `"p01"` (khi tắt) vs `"semantic_v1"` (khi bật) $\rightarrow$ vô hiệu hóa cache cũ khi đổi cờ, không dùng lẫn quyết định.
3. **Trạng thái 3: Rollback về Code CŨ (Commit Git trước WP17):**
   - Code cũ có `AgentDecisionRecord` với `model_config = ConfigDict(extra="forbid")`, không chứa trường `semantic_metadata`.
   - Cột lưu trữ trong DB Postgres là `doc jsonb not null` tại bảng `maintops.cases` (migration `0001_maintops_initial.py`, `postgres.py`). Toàn bộ Case được lưu trong cột `doc`, trong đó đối tượng quyết định nằm tại đường dẫn JSONB `doc->'agent_decision'`. Tuyệt đối không có cột `agent_decision` độc lập trên bảng `maintops.cases`.
   - Nếu nạp nguyên JSONB có `semantic_metadata` từ DB, code cũ SẼ TỪ CHỐI với lỗi `extra_forbidden`.
   - **Hợp đồng Rollback & Runbook 5 Bước Bắt buộc:**
     - **Bước 1 (Dừng Toàn bộ Writers / Quiesce Hệ thống Bắt buộc):**
       - BẮT BUỘC dừng toàn bộ các tiến trình ghi cơ sở dữ liệu (tất cả API server instances, background workers, scheduled jobs và event consumers).
       - TUYỆT ĐỐI KHÔNG coi việc tắt cờ tính năng (`MO_AGENT_SEMANTIC_ENABLED=false`) là tương đương với dừng writer, vì pipeline P01 vẫn tiếp tục ghi vào cơ sở dữ liệu và có thể ghi xen kẽ giữa lúc backup, strip SQL và kiểm thử reader. Tắt cờ chỉ là cơ chế lùi nghiệp vụ trên nền code mới, không phải khóa ghi DB.
       - Chờ toàn bộ các giao dịch đang thực thi (in-flight transactions) hoàn tất trước khi tiến hành Bước 2.
       - Duy trì trạng thái dừng ghi (quiesce window) xuyên suốt từ khi backup, chạy strip SQL cho đến khi reader cũ kiểm thử thành công ở Bước 4.
     - **Bước 2 (Sao lưu dữ liệu trước rollback):** Tạo bảng sao lưu bảo toàn dữ liệu:
       ```sql
       CREATE TABLE maintops.cases_rollback_backup AS
       SELECT ticket_id, doc, updated_at
       FROM maintops.cases
       WHERE doc->'agent_decision' ? 'semantic_metadata';
       ```
     - **Bước 3 (Thực thi lệnh SQL xóa key JSONB đúng đường dẫn):**
       ```sql
       UPDATE maintops.cases
       SET doc = doc #- '{agent_decision, semantic_metadata}',
           updated_at = NOW()
       WHERE doc->'agent_decision' ? 'semantic_metadata';
       ```
       *(Toán tử `#- '{agent_decision, semantic_metadata}'` tước bỏ chính xác trường `semantic_metadata` trong JSONB `doc->'agent_decision'`, giữ nguyên vẹn toàn bộ phần còn lại của `doc`)*.
     - **Bước 4 (Kiểm tra reader cũ trước khi mở lại hệ thống):**
       - Kiểm tra số lượng bản ghi còn chứa metadata:
         ```sql
         SELECT count(*) FROM maintops.cases WHERE doc->'agent_decision' ? 'semantic_metadata';
         ```
         (Bắt buộc kết quả trả về = 0).
       - Chạy script kiểm chứng reader code cũ nạp thử: `AgentDecisionRecord.model_validate(row['doc']['agent_decision'])` và `Case.model_validate(row['doc'])` thành công 100% với `extra="forbid"`.
     - **Bước 5 (Mở lại Writer):** Khởi động lại dịch vụ với commit code cũ.
     - **Quy trình Phục hồi sự cố (Disaster Recovery):** Nếu rollback gặp sự cố, khôi phục lại từ bảng backup:
       ```sql
       UPDATE maintops.cases c
       SET doc = b.doc, updated_at = b.updated_at
       FROM maintops.cases_rollback_backup b
       WHERE c.ticket_id = b.ticket_id;
       ```

---

## 6. Bất biến Kiến trúc & Ranh giới Kỹ thuật

1. **Bất biến Gọi ngoài khoá (I-16):** Mọi thao tác gọi LLM để thu nhận `AgentSemanticDecision` BẮT BUỘC thực hiện ngoài `engine.lock` và ngoài transaction DB.
2. **Bất biến An toàn Đơn điệu (I-17):** Mức nguy hiểm cuối cùng = $\max(\text{luật}, \text{Agent}, \text{mức đang có})$. Tuyệt đối không để Agent hạ mức an toàn.
3. **Bất biến Quyền Con người (I-19):** Các trường đã được nhân viên khóa (`locked_fields`), quyết định can thiệp thủ công (`HUMAN_OVERRIDE`), hoặc trạng thái đã kiểm tra an toàn (`safety_cleared_*`) KHÔNG BAO GIỜ bị ghi đè bởi Agent. Tuy nhiên, `locked_fields` KHÔNG ĐƯỢC PHÉP bypass kiểm tra an toàn.
4. **Minh bạch Nguồn gốc Quyết định (I-21 / I-23):** Khi Agent gặp sự cố $\rightarrow$ Chuyển sang `FALLBACK_RULE`. Toàn bộ nhật ký audit và `ai_logger` phải ghi rõ `source=FALLBACK_RULE` và `fallback_reason`.

---

## 7. Phân loại Lỗi & Hành vi Caller
> ⚠ Bị thay thế bởi SPEC-P10 §8 (Q35) — phần: dòng `UNBOUND_LOCATION_COMPONENT` và `RESIDENCE_CONTAMINATION`

| Mã lỗi | Tình huống phát sinh | Hành vi bắt buộc của Engine / Caller |
|---|---|---|
| `UNBOUND_LOCATION_COMPONENT` | Thành phần vị trí có quote nhưng quote không chứa biểu diễn của giá trị theo ranh giới từ | Gán thành phần đó là `None`, thêm vào `rejected`. Nếu thiếu thành phần cốt lõi $\rightarrow$ `MISSING_INFO`. |
| `RESIDENCE_CONTAMINATION` | Trích dẫn vị trí sự cố bị lấy nhầm từ mệnh đề nơi ở của cư dân | Loại bỏ trích dẫn và giá trị bị ảnh hưởng (`rejected: ["location.residence_contamination"]`). |
| `MULTI_LOCATION_SPLIT_BLOCKED` | Agent phát hiện hai sự việc xảy ra ở hai vị trí khác nhau trong văn bản | Luồng chuẩn: Mô hình emit `should_split=False, job_locations_identical=False, next_step=TO_BPTN, bptn_reason=COMPLEX_CLAIM`. Engine tiếp nhận và chuyển BPTN.<br>Luồng vi phạm: Nếu mô hình vẫn đòi `should_split=True`, schema reject `ValueError` $\rightarrow$ `SCHEMA_INVALID` $\rightarrow$ `FALLBACK_RULE`. |
| `SAFETY_PREEMPTS_SPLIT` | Đề xuất tách ticket trên phản ánh có nguy cơ an toàn (Bậc 1 / Bậc 2) | Cưỡng chế `should_split = False`, dừng ticket tại quy trình an toàn tương ứng. |
| `MODEL_UNAVAILABLE` | Mô hình gặp lỗi mạng, quá tải (429), timeout (>25s) | Kích hoạt `FALLBACK_RULE` ngay lập tức, ghi cờ `AGENT_FALLBACK`, hoàn tất tiếp nhận ticket bằng luật sàn. |

---

## 8. BẮT BUỘC / CẤM / Vùng Cấm

### BẮT BUỘC
> ⚠ Bị thay thế bởi SPEC-P10 §6 (Q35) — phần: gạch 1 (liên kết giá trị - bằng chứng theo ranh giới từ)

- BẮT BUỘC kiểm tra liên kết giá trị - bằng chứng theo đúng ranh giới từ cho từng thành phần của vị trí.
- BẮT BUỘC giữ nguyên tắc mức an toàn là ưu tiên số 1, chỉ nâng, không bao giờ hạ.
- BẮT BUỘC ghi nhận đầy đủ nguồn gốc và bất đồng vào audit log.
- BẮT BUỘC duy trì tính tương thích đọc kép với parser và schema P01.

### CẤM
- CẤM sử dụng regex từ khóa cố định để phủ quyết quyết định phân loại loại việc của Agent khi trích dẫn của Agent hợp lệ.
- CẤM cho phép tách hai việc khi sự cố xảy ra ở hai vị trí khác nhau hoặc có nguy cơ an toàn.
- CẤM gọi mô hình bên trong khối `engine.lock` hoặc trong giao dịch cơ sở dữ liệu.
- CẤM coi trường văn bản tự do `reasoning` hoặc cấu trúc đồ thị LangGraph là bằng chứng đã đạt yêu cầu năng lực.

### Vùng Cấm
| Không Làm | Lý Do |
|---|---|
| Không tạo thêm từ điển câu cư dân để "vá" test vị trí | Vi phạm nguyên tắc khái quát hóa ngữ nghĩa; gây nợ kỹ thuật và phình to codebase vô ích. |
| Không triển khai Tool-calling nhiều vòng ở giai đoạn này | Gây chậm trễ hệ thống, tăng nguy cơ timeout SLA và chi phí vận hành không cần thiết. |
| Không hạ thấp các ngưỡng an toàn để đạt độ chính xác phân loại | An toàn cư dân là ưu tiên số 1, bất biến kiến trúc không thể đánh đổi. |

---

## 9. Vận hành, Cờ Tính năng & Kế hoạch Rollback

1. **Cờ Tính năng (Feature Flag):**
   - `mo_agent_semantic_enabled: bool = True` trong `src/config.py`.
   - Khi tắt cờ (`False`): Hệ thống tự động lùi về cơ chế phối hợp hiện hành của P01/P08 mà không cần sửa mã nguồn.
2. **Kế hoạch Rollback:**
   - Nếu triển khai P09 gây tăng đột biến tỷ lệ lỗi hoặc thời gian xử lý, chỉ cần chuyển biến môi trường `MO_AGENT_SEMANTIC_ENABLED=false`. Toàn bộ dữ liệu đã ghi nhận vẫn tương thích hoàn toàn nhờ adapter và kiến trúc đọc kép.

---

## 10. Ma trận Kiểm thử & Nghiệm thu (Testing & Acceptance Matrix)

### 10.1 Phân biệt Kiểm thử Cơ chế (Fake Tests) và Đo lường Năng lực (Live Held-out)
- **Kiểm thử Cơ chế (Fake Client Tests - Chạy trong CI):** Sử dụng client giả lập (`ScriptedClient`, `FnClient`) để kiểm tra tính đúng đắn của logic phần mềm, các nhánh rẽ lỗi, cơ chế liên kết giá trị - bằng chứng, và các bất biến giao dịch.
- **Đo lường Năng lực Thực tế (Live Held-out Evaluation):** Chạy trên tập dữ liệu đánh giá độc lập được giữ kín (`cases_audit_a.yaml`, `scenarios_d.py`) kết nối với mô hình LLM thật (DeepSeek) để đo lường độ chính xác ngữ nghĩa thực thụ.

### 10.2 Kế thừa Tường minh 100% Bộ Cổng G-LIVE-1…7
P09 kế thừa nguyên văn các ngưỡng cổng của [`TESTING-ACCEPTANCE.md`](TESTING-ACCEPTANCE.md) §6:
1. **G-LIVE-1 (Schema / Kết nối):** REF `--live --n 20`: `OK = 20/20`, `ERROR = 0`, `p95 <= 20000 ms`.
2. **G-LIVE-2 (An toàn P0+P1):** `--set safety`: **0** câu nhãn EMERGENCY ra mức thấp hơn; nâng sai trên NONE: EMERGENCY $\le 3$, UNCLEAR $\le 10$.
3. **G-LIVE-3 (Phân loại Held-out):** `--set audit_a` + `scenarios_d`: Loại việc đúng $\ge 90.0\%$, Vị trí đúng $\ge 90.0\%$ trên ca có kỳ vọng vị trí.
4. **G-LIVE-4 (Điều phối):** `--set audit_a` + `scenarios_c`: $\ge 90.0\%$ ca đạt; ca EMG $100\%$.
5. **G-LIVE-5 (Tách Ticket):** `--set split`: $\ge 29/32$ ca MUST_SPLIT được tách; **0/18** ca MUST_NOT_SPLIT bị tách (tuyệt đối 0 vi phạm).
6. **G-LIVE-6 (Vận hành & Chi phí):** Fallback kỹ thuật $\le 2.0\%$, `p95 <= 20000 ms`, ghi nhận chi phí token thực tế.
7. **G-LIVE-7 (Ổn định Biến thể):** Đổi mức do biến thể $\le 2.0\%$.

### 10.3 Bảng Chỉ số Đo lường Bổ sung của P09
> ⚠ Bị thay thế bởi SPEC-P10 §5, §9 (Q35) — phần: dòng `P09-GATE-LOC-INV`

| Mã Chỉ số | Định nghĩa / Công thức Đo lường | Ngưỡng Tối thiểu | Môi trường Đo | Trạng thái Hiện tại |
|---|---|---|---|---|
| `P09-GATE-LOC-INV` | Tỷ lệ phát hiện và chặn vị trí bịa đặt trên probe `extra_invented_location.py`: $\frac{\text{Số ca bịa bị chặn}}{4}$ | $100\%$ ($4/4$ ca) | Local Fake | `NOT_RUN` (chờ thi công runtime) |
| `P09-GATE-SPLIT-2LOC` | Tỷ lệ chặn tách khi hai việc ở hai nơi: $\frac{\text{Số ca hai nơi không tách}}{\text{Tổng ca hai nơi}}$ | $100\%$ | Local Fake | `NOT_RUN` |
| `P09-GATE-VETO` | Tỷ lệ quyết định đúng ngữ nghĩa bị G-1 chặn oan: $\frac{\text{Số ca đúng bị G-1 chặn}}{\text{Tổng ca đúng}}$ | $0.0\%$ | Local Fake | `NOT_RUN` |
| `P09-EXEC-AUTONOMY` | Tỷ lệ tự động thực thi không cần fallback: $\frac{\text{Số ca AGENT} \land \text{rejected rỗng} \land \text{PROCEED}}{\text{Tổng ca}}$ | $\ge 85.0\%$ | Live Held-out | `NOT_RUN` (phụ thuộc WP0) |
| `P09-DECISION-CORRECT` | Tỷ lệ quyết định đúng ngữ nghĩa so với nhãn chuẩn: $\frac{\text{Số ca đúng nhãn}}{\text{Tổng ca có nhãn}}$ | $\ge 90.0\%$ | Live Held-out | `NOT_RUN` (phụ thuộc WP0) |

*Ghi chú phụ thuộc:* Các chỉ số Live phụ thuộc vào việc nạp tập dữ liệu eval của WP0 (`agent_eval/`) và cấu hình API key. Hiện tại các số đo live ghi nhận trung thực là `NOT_RUN`, tuyệt đối không dùng số liệu giả định để tuyên bố đạt cổng.
