# SPEC-P05 — LỚP HÀNH ĐỘNG: ĐỌC CHÍNH SÁCH, ĐẶT CHỖ, BIÊN NHẬN, HOÀN TÁC

> Tầng 🟠 · Ngày D6 · **CỔNG BẮT BUỘC (Đ03 / BB-12): P01–P04 phải xanh toàn bộ
> Exit Gate `local` trước khi có commit đầu tiên chạm `lib/simbackend/`.**
> Phụ thuộc đọc: [`00-ARCHITECTURE.md`](00-ARCHITECTURE.md) §4 BB-01/BB-02/BB-03;
> [`01-CONTRACTS.md`](01-CONTRACTS.md) §2.3, §8.4.
> **Không phủ gạch rubric nào.** Đây là tầng 2 — điểm khác biệt khi demo, và là gói
> **duy nhất được cắt khi trễ hạn**. Cắt nó không đụng một dòng nào của R1–R10.

---

## 0. Tuyên bố bắt buộc, lặp lại ở đầu mọi file mã của gói

> `lib/simbackend/` là **backend cư dân mô phỏng do chúng ta tự viết** (Đ02). Mọi tên
> endpoint, tên trường, mã lỗi trong file này là **hợp đồng chúng ta tự định nghĩa**.
> Đây **không** phải mô tả API có thật của Vinhomes, và không có lời gọi mạng nào ra
> ngoài. Ba ảnh trong `docs/assets/` là tư liệu tham chiếu giao diện, không phải
> đặc tả kỹ thuật phải tuân theo.

---

## 1. Phạm vi: 9 capability, cắt từ bản đồ 46

Bản đồ gốc `H02_capability_map.md` §b có **46 capability** rút từ ảnh app thật
(28 đọc / 18 ghi, 9 lệnh không hoàn tác được). Vòng này **chỉ lấy nhóm `amenity`,
phần liên quan đặt chỗ tiện ích**.

Danh sách chốt ở [`01-CONTRACTS.md`](01-CONTRACTS.md) §8.4 — 7 lệnh đọc, 2 lệnh ghi.

**37 capability bị loại và lý do** cũng ở `01-CONTRACTS.md` §8.4. Tóm tắt điều quan
trọng nhất: **thanh toán / hoá đơn là vùng cấm vòng này** (NG-03). `billing.pay_invoice`
là lệnh nguy hiểm nhất toàn bản đồ — không hoàn tác được, thiếu `idempotency_key` là
trả tiền hai lần — và rubric không có dòng nào về thanh toán.

---

## 2. Ba bất biến chi phối cả gói

### 2.1 — BB-03 · Đọc chính sách trước khi ghi `[Đ10]`

Mọi lệnh ghi có `precheck_capability_id` khác `null`, và **backend từ chối lệnh ghi
nếu precheck chưa từng được gọi trong phiên hiện tại**. Không phải quy ước lập trình
— là ràng buộc backend kiểm được.

```ts
// lib/simbackend/guard.ts
export function assertPrechecked(
  session_id: string, capability_id: string, params_fingerprint: string
): void;   // ném SimBackendError.PrecheckMissing
```

`params_fingerprint` = SHA-256 của `(facility_id, slot_start, slot_end, property_id)`.
Precheck cho một khung giờ khác **không** tính là đã precheck cho khung giờ này.

Lý do: agent không được học luật bằng cách thử và hỏng — mỗi lần thử là một lệnh ghi
thật. Bằng chứng gốc: `H02` §c.2, sáu lý do, mỗi lý do độc lập đủ để hỏng.

### 2.2 — BB-02 · Hai trục thời gian, tuyệt đối không gộp

`intake_window` ràng buộc `t_submit` (lúc **gửi** yêu cầu).
`operating_hours` ràng buộc `t_slot` (lúc **dùng** tiện ích).

Vi phạm sinh ra bốn kiểu sai khác nhau, không phải một (`H02` §c.1): âm tính giả ·
dương tính giả · vòng lặp thử lại vô nghĩa · phát ngôn sai thông tin thuần.

**Ví dụ chuẩn, giữ nguyên từ `ref-01.jpg`:** *"BQL chỉ **nhận đăng ký** Sân bóng bàn
từ 08:30 đến 17:30"*. Câu này nói về **cửa nhận đăng ký**. Nó **không** cho biết sân
mở cửa lúc nào. Suy ra giờ hoạt động từ câu này là hallucination.

### 2.3 — BB-01 · Đặt được chỗ ≠ được phép giải thích luật `[Đ09]`

Backend mô phỏng **cho phép** đặt `FAC-PICKLEBALL`. Nhưng
`has_authoritative_rules = false` cho tiện ích đó (`SPEC-P00` §4), nên agent **bị chặn**
khỏi phát biểu về nội quy/giờ giấc/điều kiện của nó.

Hai quyền tách rời. Kết quả của một lệnh hành động **CẤM** dùng làm evidence cho một
phát biểu quy định. Cụ thể: `create_booking` thất bại lúc 23:39 ⇒ **CẤM** kết luận
"sân đóng cửa sau 17:30".

---

## 3. `amenity.get_booking_policy` — hợp đồng đọc-thuần

Lệnh quan trọng nhất của gói. Mục tiêu thiết kế: **sau đúng một lần gọi, agent lập
được kế hoạch đầy đủ mà không cần thử-và-sai lần nào.**

```ts
export interface BookingPolicy {
  // — Nhóm 1: định danh & truy vết —
  facility_id: string;
  facility_name_vi: string;                 // tên ĐẦY ĐỦ, không cắt '...'
  zone: string;
  policy_version: string;
  source_document_id: string | null;        // null khi không có nguồn nội quy
  source_section_id: string | null;
  has_authoritative_rules: boolean;         // ← cờ khoá của BB-01

  // — Nhóm 2: thời gian máy chủ (chống lệch đồng hồ) —
  server_time: string;                      // ISO-8601 có offset
  timezone: "Asia/Ho_Chi_Minh";

  // — Nhóm 3: cửa NHẬN ĐĂNG KÝ (t_submit) —
  intake_windows: Array<{ days_of_week: number[]; start_time: string; end_time: string }>;
  intake_open_now: boolean;
  next_intake_open_at: string | null;       // trường QUAN TRỌNG NHẤT: biến lỗi thành lịch hẹn
  next_intake_close_at: string | null;

  // — Nhóm 4: giờ HOẠT ĐỘNG (t_slot) — TUYỆT ĐỐI không gộp với nhóm 3 —
  operating_hours: Array<{ days_of_week: number[]; open_time: string; close_time: string }>;
  operating_now: boolean;
  closure_dates: string[];

  // — Nhóm 5: cấu trúc slot —
  is_bookable: boolean;                     // false ⇒ chỉ đọc nội quy, không đặt được
  slot_granularity_minutes: number;
  slot_calendar: Array<{
    slot_start: string; slot_end: string;
    capacity_total: number; capacity_remaining: number;
    status: "open" | "full" | "closed" | "maintenance";
  }>;

  // — Nhóm 6: ràng buộc đặt trước —
  min_lead_time_minutes: number;
  max_advance_days: number;

  // — Nhóm 7: hạn mức của CHÍNH cư dân này —
  max_active_bookings: number;
  max_bookings_per_week: number;
  quota_used: number;
  quota_remaining: number;
  quota_resets_at: string;

  // — Nhóm 8 (rút gọn): điều kiện đối tượng —
  min_age: number | null;
  requires_adult_supervision_under_age: number | null;

  // — Nhóm 10: huỷ —
  is_cancellable: boolean;
  cancel_deadline_before_slot_minutes: number;

  // — Nhóm 13: lỗi, giải thích, hành động khả dụng —
  blocking_reasons: Array<{
    code: BlockingCode; human_message_vi: string;
    is_permanent: boolean; next_valid_at: string | null; remediation_hint_vi: string;
  }>;
  allowed_actions_now: string[];            // capability_id được gọi NGAY bây giờ

  // — Nhóm 14: an toàn khi gọi lặp —
  idempotency_supported: true;
  idempotency_key_ttl_seconds: number;
  duplicate_booking_behavior: "reject";
}

export type BlockingCode =
  | "intake_closed" | "outside_operating_hours" | "slot_full"
  | "quota_exceeded" | "too_early" | "too_late" | "under_age"
  | "not_bookable" | "maintenance";
```

### 3.1 — `blocking_reasons` là MẢNG, và đó là chủ ý

Trả về **hết mọi ràng buộc đang bị vi phạm cùng lúc**, không dừng ở cái đầu tiên.
Trả một lỗi mỗi lần buộc agent gọi lại nhiều vòng — mỗi vòng là một cơ hội để nó
chuyển sang lệnh ghi. Mảng rỗng ⇒ gọi `create_booking` được.

`allowed_actions_now` là trường biến endpoint này từ *mô tả luật* thành *chỉ dẫn hành
động*. Agent đọc trường này thay vì tự suy luận từ các trường khác.

### 3.2 — Bốn nhóm trường CỐ Ý bị lược, và vì sao

`H02` §c.3 đề xuất 14 nhóm cho một hợp đồng production. Vòng này giữ 11, lược 3+:

| Nhóm bị lược | Vì sao |
| :-- | :-- |
| Nhóm 9 — phí, thanh toán, đặt cọc, hoàn tiền | NG-03. Không tiền thật trong vòng này. Mọi tiện ích đặt `is_free = true` ngầm định |
| Nhóm 11 — `confirmation_mode`, SLA duyệt, `hold_expiry` | Cố định `confirmation_mode = "auto"`. `manual_bql` cần một hàng đợi duyệt đặt chỗ riêng — hạ tầng mới, không được chấm |
| Nhóm 12 — hồ sơ phải nộp, giấy tờ, điều khoản phải chấp nhận | Không có hồ sơ thật để nộp |
| Nhóm 8 (một phần) — `requires_no_outstanding_fee`, `eligible_resident_types`, `guest_policy` | Ràng buộc chéo sang `billing` — vùng cấm. Giữ lại đúng phần tuổi vì bể bơi/kayak có ràng buộc tuổi thật trong nội quy |

CẤM thêm lại các nhóm này "cho đầy đủ". Chúng bị lược **có lý do**, không phải quên.

---

## 4. Schema của gói — bảng RIÊNG `[VC-09]`

```sql
CREATE TYPE booking_state AS ENUM ('confirmed','cancelled');

CREATE TABLE bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      text NOT NULL,
  property_id      text NOT NULL,
  resident_id      text NOT NULL,
  slot_start       timestamptz NOT NULL,
  slot_end         timestamptz NOT NULL,
  party_size       int  NOT NULL CHECK (party_size > 0),
  state            booking_state NOT NULL DEFAULT 'confirmed',
  idempotency_key  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  cancelled_at     timestamptz,
  CONSTRAINT bookings_idem_uniq UNIQUE (idempotency_key),
  CONSTRAINT bookings_slot_uniq
    EXCLUDE USING btree (facility_id WITH =, property_id WITH =, slot_start WITH =)
    WHERE (state = 'confirmed')
);

CREATE TABLE receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid NOT NULL REFERENCES bookings(id),
  receipt_code   text NOT NULL UNIQUE,      -- 'RC-' || 8 ký tự hoa
  action         text NOT NULL CHECK (action IN ('create','cancel')),
  capability_id  text NOT NULL,
  params_json    jsonb NOT NULL,
  result_json    jsonb NOT NULL,
  actor_user_id  uuid NOT NULL REFERENCES users(id),
  undo_capability_id text,                  -- null ⇒ không hoàn tác được
  undone_by      uuid REFERENCES receipts(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

Hai ràng buộc DB là **tuyến phòng thủ cuối**, không phải trang trí:

- `bookings_idem_uniq` — chặn `create_booking` chạy hai lần cùng key ở tầng DB, kể cả
  khi mã ứng dụng có lỗi chạy đua.
- `bookings_slot_uniq` — chặn cùng một căn đặt hai lần cùng một khung giờ cùng tiện
  ích. Đây là `action_duplicate_suspected` ở mức dữ liệu.

**Bảng của gói này tách hoàn toàn khỏi bảng của P02.** Trộn thì log lượt hỏi và log
hành động lẫn nhau, dashboard R10 sai, và cắt P05 sẽ phải sửa contract lõi.

---

## 5. Hai lệnh ghi

### 5.1 — `amenity.create_booking`

```ts
export async function createBooking(input: {
  session_id: string;
  facility_id: string; property_id: string;
  slot_start: string; slot_end: string; party_size: number;
  idempotency_key: string;                  // BẮT BUỘC, CẤM để server tự sinh
}): Promise<
  | { ok: true; booking_id: string; receipt_code: string; undo_capability_id: "amenity.cancel_booking" }
  | { ok: false; reason_code: ReasonCode; blocking_reasons: BookingPolicy["blocking_reasons"] }
>;
```

Thứ tự bắt buộc bên trong, **không đảo**:

1. `assertPrechecked()` — chưa precheck ⇒ `action_authorization_missing`.
2. Tra `idempotency_key`. Đã có ⇒ trả **biên nhận cũ**, `reason_code = action_duplicate_suspected`,
   **không** tạo bản ghi mới.
3. Tính lại policy **ở thời điểm hiện tại**. Policy đọc lúc precheck có thể đã cũ —
   slot có thể vừa bị người khác lấy. `blocking_reasons` không rỗng ⇒ từ chối, trả
   nguyên mảng.
4. `INSERT bookings` + `INSERT receipts` trong **một** transaction. Rớt giữa chừng thì
   không có biên nhận mồ côi.
5. Trả `receipt_code` và `undo_capability_id`.

**`idempotency_key` do caller sinh, CẤM server tự sinh.** Server tự sinh thì mỗi lần
gọi là một key mới và cơ chế chống trùng vô tác dụng — đúng lỗi mà `H02` §b.3 cảnh báo.

### 5.2 — `amenity.cancel_booking`

```ts
export async function cancelBooking(input: {
  session_id: string; booking_id: string; reason_vi: string;
}): Promise<
  | { ok: true; receipt_code: string; undo_capability_id: null }
  | { ok: false; reason_code: ReasonCode }
>;
```

- Precheck bắt buộc: `amenity.get_booking_detail`.
- Quá `cancel_deadline_before_slot_minutes` ⇒ `action_quota_exceeded`? **Không** —
  dùng `action_irreversible_requires_confirmation` nếu chưa xác nhận, và từ chối
  thẳng nếu đã quá hạn chót, kèm `blocking_reasons` giải thích.
- **`undo_capability_id = null`** — huỷ **không** hoàn tác được. Slot có thể bị người
  khác lấy ngay. Đặt lại là một hành động mới, không phải hoàn tác. Ghi đúng như vậy
  vào biên nhận. Nguồn: `H02` §b.3, cột "Hoàn tác được?".

---

## 6. Sổ biên nhận & hoàn tác

Mỗi lệnh ghi thành công ⇒ đúng một dòng `receipts`. Mã `RC-XXXXXXXX`, hiện cho cư dân.

| Hành động | `undo_capability_id` | Hoàn tác thật sự? |
| :-- | :-- | :-- |
| `create_booking` | `amenity.cancel_booking` | ✅ có |
| `cancel_booking` | `null` | ❌ không — xem §5.2 |

Route `/chat/receipts` (vai `resident`): danh sách biên nhận của **chính mình**, mỗi
dòng có nút *Hoàn tác* chỉ khi `undo_capability_id ≠ null` **và** `undone_by IS NULL`.
Hoàn tác xong thì ghi `undone_by` trỏ sang biên nhận huỷ. **CẤM** xoá biên nhận cũ.

---

## 7. Bảng phân loại lỗi & hành vi caller

Ánh xạ sang 5 mã nhóm hành động (`01-CONTRACTS.md` §2.3).

| `SimBackendError` | Khi nào | `reason_code` | Caller BẮT BUỘC làm gì |
| :-- | :-- | :-- | :-- |
| `PrecheckMissing` | gọi ghi mà chưa precheck đúng fingerprint | `action_authorization_missing` | Gọi `get_booking_policy` rồi mới thử lại. **CẤM** bỏ qua guard |
| `QuotaExceeded` | `quota_remaining = 0` | `action_quota_exceeded` | Dừng. Nói rõ hạn mức và `quota_resets_at`. **CẤM thử lại** |
| `DuplicateKey` | trùng `idempotency_key` | `action_duplicate_suspected` | Trả biên nhận **đã có**. **CẤM** tạo mới |
| `SlotTaken` | vi phạm `bookings_slot_uniq` | `action_duplicate_suspected` | Như trên |
| `IrreversibleUnconfirmed` | lệnh không hoàn tác được, chưa xác nhận tường minh | `action_irreversible_requires_confirmation` | Hỏi cư dân. **CẤM tự xác nhận hộ** |
| `WriteTimeout` | lệnh đã gửi, không rõ kết quả | `action_partial_execution_unknown` | **CẤM RETRY.** Gọi `list_my_bookings` để xem thực trạng, báo cư dân, `audit_log` mức `warn` |
| `IntakeClosed` | ngoài `intake_window` | *(không phải lỗi)* | Trả `next_intake_open_at`. **CẤM** suy ra giờ hoạt động từ đây (BB-02) |
| `NotBookable` | `is_bookable = false` | `unsupported_intent` | `FAC-PLAYGROUND`, `FAC-OUTDOOR-GYM`: trả lời nội quy được, **CẤM hứa đặt chỗ** |

`WriteTimeout` là dòng nguy hiểm nhất bảng. `system_error` cũ **không** phân biệt
"chưa chạm" với "đã chạm một phần", trong khi UI lại cho Retry tự do — đúng lỗ hổng
`H01` §b.2 chỉ ra. Mã B3 tồn tại để đóng lỗ hổng đó.

---

## 8. Vùng cấm của gói P05

| # | CẤM | Lý do |
| :-- | :-- | :-- |
| P05-C1 | CẤM chạm P05 khi P01–P04 chưa xanh hết | Đ03, BB-12. Hàng rào chống trễ hạn |
| P05-C2 | CẤM thêm `billing.*` hay bất kỳ lệnh chạm tiền | NG-03. Rubric không chấm; rủi ro cao nhất bản đồ |
| P05-C3 | CẤM thêm `partner.*` (VinWonders/Aquafield) | NG-08. Khác pháp nhân, trắng nguồn tuyệt đối |
| P05-C4 | CẤM `identity.switch_active_property` | Idempotent nhưng đổi ngữ cảnh mọi lệnh sau ⇒ đặt nhầm căn mà vẫn báo "thành công" |
| P05-C5 | CẤM bộ lập lịch, ý định sống qua phiên, hẹn giờ gửi lại | `plan.md` §2 "Quyết định bị thay thế" mục 3 — đã rút lại theo chỉ đạo. Tiết kiệm ~1 ngày công |
| P05-C6 | CẤM gộp `intake_window` và `operating_hours` | BB-02 |
| P05-C7 | CẤM để agent thử lệnh ghi để dò luật | BB-03, VC-10, Đ10 |
| P05-C8 | CẤM dùng kết quả lệnh hành động làm evidence cho phát biểu quy định | BB-01, Đ09 |
| P05-C9 | CẤM server tự sinh `idempotency_key` | §5.1 — vô hiệu hoá chống trùng |
| P05-C10 | CẤM retry lệnh ghi khi `WriteTimeout` | §7 — đặt chỗ hai lần |
| P05-C11 | CẤM cho `FAC-PLAYGROUND` / `FAC-OUTDOOR-GYM` vào danh sách đặt chỗ | `H02` §d.2 — có nội quy, không có mục đặt chỗ |
| P05-C12 | CẤM P05 ghi vào bảng của P02 | VC-09 |

---

## 9. Kịch bản demo P05 (dùng cho P06)

Bối cảnh cố định giờ máy chủ về **23:39** để tái hiện đúng `ref-01.jpg`:

1. Cư dân: *"Đặt giúp tôi sân bóng bàn 9 giờ sáng mai."*
2. Agent gọi `get_booking_policy` — **một lần**, không thử lệnh ghi nào.
3. Policy trả `intake_open_now: false`, `next_intake_open_at: "2026-09-21T08:30:00+07:00"`,
   `blocking_reasons: [{ code: "intake_closed", … }]`, `allowed_actions_now: []`.
4. Agent trả lời: *"Bây giờ 23:39, Ban quản lý chỉ nhận đăng ký từ 08:30 đến 17:30.
   Slot 09:00 sáng mai còn chỗ. Anh/chị gửi lại sau 08:30 sáng mai là đặt được."*
5. **Agent KHÔNG nói sân mở cửa lúc nào** — chính sách nhận đăng ký không cho biết
   điều đó (BB-02).
6. Chuyển đồng hồ sang 09:00 hôm sau → đặt lại → có `receipt_code` → bấm *Hoàn tác* →
   biên nhận huỷ xuất hiện, biên nhận gốc **vẫn còn** với `undone_by` đã trỏ.

Cảnh này cho thấy **không có lệnh ghi nào bị lãng phí** — điểm khác biệt của P05.

---

## 10. Số đo nghiệm thu

| # | Lệnh | Kết quả PASS |
| :-- | :-- | :-- |
| P05-M1 | `node scripts/validate_capabilities.mjs` | `capabilities: 9 · write: 2 · write_without_precheck: 0`; exit 0 |
| P05-M2 | `node scripts/validate_policy.mjs` | `intake_windows: ok · operating_hours: ok · separated: true`; exit 0 |
| P05-M3 | `npm run test -- precheck-guard` | Gọi `createBooking` không precheck ⇒ `action_authorization_missing`; 0 dòng `bookings` được tạo |
| P05-M4 | `npm run test -- idempotency` | Gọi `createBooking` 2 lần cùng key ⇒ 1 dòng `bookings`, 1 dòng `receipts`, lần 2 trả `action_duplicate_suspected` |
| P05-M5 | `node scripts/sql.mjs "select count(*) from bookings"` sau `P05-M4` | **1** |
| P05-M6 | `npm run test -- quota` | `quota_remaining=0` ⇒ `action_quota_exceeded`, không có retry nào trong log |
| P05-M7 | `npm run test -- bb01-pickleball` | Đặt `FAC-PICKLEBALL` **thành công**, nhưng hỏi nội quy của nó ⇒ `no_eligible_source`. Hai quyền tách rời |
| P05-M8 | `node scripts/demo_2339.mjs` | In đúng 6 bước §9; bước 2 có **đúng 1** lời gọi `get_booking_policy`, **0** lời gọi ghi |
| P05-M9 | `node scripts/sql.mjs "select count(*) from receipts where action='cancel' and undo_capability_id is not null"` | **0** (§5.2) |
| P05-M10 | `npm run test -- write-timeout` | `WriteTimeout` ⇒ `action_partial_execution_unknown`, **0** lần retry, có dòng `audit_log` mức `warn` |
