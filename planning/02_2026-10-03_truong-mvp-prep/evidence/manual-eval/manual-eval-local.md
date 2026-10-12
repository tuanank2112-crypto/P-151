# Manual Eval — MaintenanceOps Agent

> Output máy sinh bởi `scripts/manual_eval.py`. KHÔNG sửa tay — muốn đổi thì chạy lại.

- **Observed at:** 2026-10-04T21:30:44+07:00
- **Branch:** develop
- **Commit:** cb517626fdcb14c35bb1c965f900fc885a28de75
- **Working tree:** dirty
- **Environment:** local (LLM_MODE=mock, MO_STORE=memory)
- **Result:** 6/6 PASS

## Tổng hợp

| # | Kịch bản | Kỳ vọng | Kết quả |
| :--- | :--- | :--- | :--- |
| TC-01 | Vệ sinh bình thường | `http=201, status=ROUTED, reason_code=None, category=VE_SINH` | ✅ PASS |
| TC-02 | Đèn hỏng, thiết bị không có trong sổ tài sản | `http=201, status=VERIFYING, reason_code=ASSET_UNCLEAR, category=KY_THUAT` | ✅ PASS |
| TC-03 | An toàn Bậc 1 (tia lửa, mùi khét) | `http=201, status=VERIFYING, reason_code=EMERGENCY_PENDING_BQL, risk_level=EMERGENCY` | ✅ PASS |
| TC-04 | Thiếu vị trí | `http=201, status=NEED_INFO, reason_code=MISSING_INFO` | ✅ PASS |
| TC-05 | Trùng với TC-01 | `http=201, status=VERIFYING, reason_code=DUPLICATE, category=VE_SINH` | ✅ PASS |
| TC-06 | Phân quyền: cư dân tự đóng ticket | `http=403, code=ACTION_DENIED` | ✅ PASS |

## TC-01 — Vệ sinh bình thường

**Request**

```http
POST /api/v1/resident/tickets (cudan01)
{"original_description": "Hành lang tầng 4 tòa SIM-B có nhiều rác và vết bẩn, cần vệ sinh."}
```

**Kỳ vọng**

```json
{
  "http": 201,
  "status": "ROUTED",
  "reason_code": null,
  "category": "VE_SINH"
}
```

**Response (API trả về)**

```json
{
  "ticket_id": "SIM-TKT-0001",
  "created_at": "2026-10-04T21:30:44+07:00",
  "description": "Hành lang tầng 4 tòa SIM-B có nhiều rác và vết bẩn, cần vệ sinh.",
  "additions": [],
  "photos": [],
  "status": "ROUTED",
  "status_label": "Đã chuyển phòng ban",
  "department_name": "Phòng Vệ sinh",
  "public_message": "Phản ánh đã được chuyển tới Phòng Vệ sinh.",
  "eta": null,
  "timeline": [
    {
      "status": "RECEIVED",
      "status_label": "Đã tiếp nhận",
      "public_message": "Phản ánh của bạn đã được tiếp nhận.",
      "created_at": "2026-10-04T21:30:44.340904+07:00"
    },
    {
      "status": "ROUTED",
      "status_label": "Đã chuyển phòng ban",
      "public_message": "Phản ánh đã được chuyển tới Phòng Vệ sinh.",
      "created_at": "2026-10-04T21:30:44.340904+07:00"
    }
  ],
  "allowed_actions": [],
  "merged_into": null
}
```

**Trạng thái nội bộ (đọc lại bằng qa01)**

```json
{
  "reason_code": null,
  "risk_level": "NONE",
  "category": "VE_SINH",
  "playbook_id": "PB-CLN-01",
  "checklist_items": 3
}
```

**Kết quả:** PASS

## TC-02 — Đèn hỏng, thiết bị không có trong sổ tài sản

**Request**

```http
POST /api/v1/resident/tickets (cudan01)
{"original_description": "Đèn hành lang tầng 8 tòa SIM-B không sáng từ tối qua."}
```

**Kỳ vọng**

```json
{
  "http": 201,
  "status": "VERIFYING",
  "reason_code": "ASSET_UNCLEAR",
  "category": "KY_THUAT"
}
```

**Response (API trả về)**

```json
{
  "ticket_id": "SIM-TKT-0002",
  "created_at": "2026-10-04T21:30:44+07:00",
  "description": "Đèn hành lang tầng 8 tòa SIM-B không sáng từ tối qua.",
  "additions": [],
  "photos": [],
  "status": "VERIFYING",
  "status_label": "Đang xác minh",
  "department_name": null,
  "public_message": "Đang xác minh thiết bị tại vị trí phản ánh.",
  "eta": null,
  "timeline": [
    {
      "status": "RECEIVED",
      "status_label": "Đã tiếp nhận",
      "public_message": "Phản ánh của bạn đã được tiếp nhận.",
      "created_at": "2026-10-04T21:30:44.345833+07:00"
    },
    {
      "status": "VERIFYING",
      "status_label": "Đang xác minh",
      "public_message": "Đang xác minh thiết bị tại vị trí phản ánh.",
      "created_at": "2026-10-04T21:30:44.345833+07:00"
    }
  ],
  "allowed_actions": [],
  "merged_into": null
}
```

**Trạng thái nội bộ (đọc lại bằng qa01)**

```json
{
  "reason_code": "ASSET_UNCLEAR",
  "risk_level": "NONE",
  "category": "KY_THUAT",
  "playbook_id": "PB-TEC-01",
  "checklist_items": 0
}
```

**Kết quả:** PASS

## TC-03 — An toàn Bậc 1 (tia lửa, mùi khét)

**Request**

```http
POST /api/v1/resident/tickets (cudan01)
{"original_description": "Đèn sảnh thang máy tầng 4 tòa SIM-B có tia lửa và mùi khét ở hộp đèn."}
```

**Kỳ vọng**

```json
{
  "http": 201,
  "status": "VERIFYING",
  "reason_code": "EMERGENCY_PENDING_BQL",
  "risk_level": "EMERGENCY"
}
```

**Response (API trả về)**

```json
{
  "ticket_id": "SIM-TKT-0003",
  "created_at": "2026-10-04T21:30:44+07:00",
  "description": "Đèn sảnh thang máy tầng 4 tòa SIM-B có tia lửa và mùi khét ở hộp đèn.",
  "additions": [],
  "photos": [],
  "status": "VERIFYING",
  "status_label": "Đang được kiểm tra",
  "department_name": null,
  "public_message": "Phản ánh đang được kiểm tra.",
  "eta": null,
  "timeline": [
    {
      "status": "RECEIVED",
      "status_label": "Đã tiếp nhận",
      "public_message": "Phản ánh của bạn đã được tiếp nhận.",
      "created_at": "2026-10-04T21:30:44.349661+07:00"
    },
    {
      "status": "VERIFYING",
      "status_label": "Đang xác minh",
      "public_message": "Phản ánh đang được kiểm tra.",
      "created_at": "2026-10-04T21:30:44.349661+07:00"
    }
  ],
  "allowed_actions": [],
  "merged_into": null
}
```

**Trạng thái nội bộ (đọc lại bằng qa01)**

```json
{
  "reason_code": "EMERGENCY_PENDING_BQL",
  "risk_level": "EMERGENCY",
  "category": null,
  "playbook_id": null,
  "checklist_items": 0
}
```

**Kết quả:** PASS

## TC-04 — Thiếu vị trí

**Request**

```http
POST /api/v1/resident/tickets (cudan01)
{"original_description": "Có rác, cần dọn."}
```

**Kỳ vọng**

```json
{
  "http": 201,
  "status": "NEED_INFO",
  "reason_code": "MISSING_INFO"
}
```

**Response (API trả về)**

```json
{
  "ticket_id": "SIM-TKT-0004",
  "created_at": "2026-10-04T21:30:44+07:00",
  "description": "Có rác, cần dọn.",
  "additions": [],
  "photos": [],
  "status": "NEED_INFO",
  "status_label": "Chờ bổ sung thông tin",
  "department_name": null,
  "public_message": "Ban tiếp nhận thông tin sẽ liên hệ bạn để bổ sung: vị trí (tòa, tầng, khu vực). Bạn cũng có thể bổ sung ngay tại đây.",
  "eta": null,
  "timeline": [
    {
      "status": "RECEIVED",
      "status_label": "Đã tiếp nhận",
      "public_message": "Phản ánh của bạn đã được tiếp nhận.",
      "created_at": "2026-10-04T21:30:44.354662+07:00"
    },
    {
      "status": "NEED_INFO",
      "status_label": "Chờ bổ sung thông tin",
      "public_message": "Ban tiếp nhận thông tin sẽ liên hệ bạn để bổ sung: vị trí (tòa, tầng, khu vực). Bạn cũng có thể bổ sung ngay tại đây.",
      "created_at": "2026-10-04T21:30:44.354662+07:00"
    }
  ],
  "allowed_actions": [
    "ADD_INFO"
  ],
  "merged_into": null
}
```

**Trạng thái nội bộ (đọc lại bằng qa01)**

```json
{
  "reason_code": "MISSING_INFO",
  "risk_level": "NONE",
  "category": null,
  "playbook_id": null,
  "checklist_items": 0
}
```

**Kết quả:** PASS

## TC-05 — Trùng với TC-01

**Request**

```http
POST /api/v1/resident/tickets (cudan01)
{"original_description": "Hành lang tầng 4 tòa SIM-B nhiều rác bẩn, nhờ dọn giúp."}
```

**Kỳ vọng**

```json
{
  "http": 201,
  "status": "VERIFYING",
  "reason_code": "DUPLICATE",
  "category": "VE_SINH"
}
```

**Response (API trả về)**

```json
{
  "ticket_id": "SIM-TKT-0005",
  "created_at": "2026-10-04T21:30:44+07:00",
  "description": "Hành lang tầng 4 tòa SIM-B nhiều rác bẩn, nhờ dọn giúp.",
  "additions": [],
  "photos": [],
  "status": "VERIFYING",
  "status_label": "Đang xác minh",
  "department_name": null,
  "public_message": "Đang kiểm tra phản ánh có trùng với phản ánh khác không.",
  "eta": null,
  "timeline": [
    {
      "status": "RECEIVED",
      "status_label": "Đã tiếp nhận",
      "public_message": "Phản ánh của bạn đã được tiếp nhận.",
      "created_at": "2026-10-04T21:30:44.357662+07:00"
    },
    {
      "status": "VERIFYING",
      "status_label": "Đang xác minh",
      "public_message": "Đang kiểm tra phản ánh có trùng với phản ánh khác không.",
      "created_at": "2026-10-04T21:30:44.357662+07:00"
    }
  ],
  "allowed_actions": [],
  "merged_into": null
}
```

**Trạng thái nội bộ (đọc lại bằng qa01)**

```json
{
  "reason_code": "DUPLICATE",
  "risk_level": "NONE",
  "category": "VE_SINH",
  "playbook_id": "PB-CLN-01",
  "checklist_items": 0
}
```

**Kết quả:** PASS

## TC-06 — Phân quyền: cư dân tự đóng ticket

**Request**

```http
POST /api/v1/mo/tickets/SIM-TKT-0001/transition (cudan01)
{"to": "CLOSED"}
```

**Kỳ vọng**

```json
{
  "http": 403,
  "code": "ACTION_DENIED"
}
```

**Response (API trả về)**

```json
{
  "detail": {
    "message": "RESIDENT không được chuyển sang CLOSED",
    "decision": "DENY",
    "code": "ACTION_DENIED",
    "requested_action": "TRANSITION",
    "actor_id": "SIM-ACTOR-RESIDENT-01",
    "actor_role": "RESIDENT",
    "target_field": "status",
    "unchanged_status": "ROUTED",
    "audit_event_id": "SIM-AUD-0001-0009"
  }
}
```

**Kết quả:** PASS
