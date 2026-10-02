# SPEC-P02 — Ảnh trên Supabase Storage

> CHÍNH THỨC — chốt 2026-10-02 12:25:56 +07:00, HEAD `3e7b70b`. Gói WP3. Số dòng theo `413aebc`
> (`src/api/photos.py` không đổi từ `f2da6cb`; `routers/maintenance.py` lệch +5 dòng sau `L51`).

Phạm vi file: `src/maintenance/store/photos.py` (mới), `src/api/photos.py`, `src/api/routers/maintenance.py` (chỉ
`_photo_file`, 2 decorator `read_photo`/`resident_read_photo`, import), `src/main.py` (chỉ 1 dòng gọi `check_photo_store`),
`src/config.py` (field §1 của `01-CONTRACTS`, nếu WP2 chưa thêm), test mới `tests/test_maintenance/test_photo_store.py`.

## 1. Hiện trạng đo được

| Thứ | Vị trí | Ghi chú |
|---|---|---|
| `read_photos(files) -> list[tuple[bytes, str]]` | `photos.py:L43-58` | kiểm cả lô trước (422/413/415); trả `(data, extension)` |
| `save(data, extension) -> str` | `L61-64` | sinh `uuid4().hex.<ext>`, ghi `upload_dir()/ref` |
| `discard(ref)`, `locate(ref) -> (Path, media_type)` | `L67-78` | `locate` ném `HTTPException(404, "Không tìm thấy ảnh")` |
| `_attach_photos(files, room, limit, attach)` | `routers/maintenance.py:L158-171` | `save` → `_call(attach, ref)` → lỗi ⇒ `discard(ref)` rồi raise |
| `_photo_file(case, evidence_id, allowed) -> FileResponse` | `L174-179` | header `Cache-Control: private, max-age=3600` |
| `read_photo` / `resident_read_photo` | `L508-514`, `L624-627` | `response_class=FileResponse` |
| UI tải ảnh | `src/web/app.js:L360-370` | `fetch` có Bearer → `blob` → object URL (không dùng `<img src>` trực tiếp) |
| Test monkeypatch thư mục | `tests/test_maintenance/test_api.py:L37` | `monkeypatch.setattr(photos, "upload_dir", lambda: tmp_path)` |

## 2. Hai bản `PhotoStore` (`src/maintenance/store/photos.py`)

**`LocalPhotoStore(directory: Path)`** — `put`: `directory.mkdir(parents=True, exist_ok=True)` rồi `write_bytes`; `get`: không
phải file ⇒ `PhotoNotFoundError`; `delete`: `unlink(missing_ok=True)`.

**`SupabasePhotoStore(url, key: SecretStr, bucket, *, client=None, sleep=time.sleep)`** — `client` mặc định
`httpx.Client(timeout=httpx.Timeout(30.0, connect=5.0))`; `client`/`sleep` tiêm được để test (MockTransport, không mạng thật).
URL gốc `base = url.rstrip("/") + "/storage/v1"`.

| Thao tác | Lời gọi (theo storage-js; **chưa đo trên Supabase — M-SB2**) | Thành công | Coi như |
|---|---|---|---|
| `put(ref, data, media_type)` | `POST {base}/object/{bucket}/{ref}`, body = bytes, header `Content-Type: <media_type>`, `x-upsert: false` | 200 | 409 hoặc 400 có `Duplicate`/`already exists` trong body **ở lần thử lại** ⇒ thành công (lần trước đã ghi; `ref` 128-bit ngẫu nhiên nên không ai khác ghi trùng) |
| `get(ref)` | `GET {base}/object/{bucket}/{ref}` | 200, body = bytes | 404, hoặc 400 có `not_found`/`Object not found` trong body ⇒ `PhotoNotFoundError` |
| `delete(ref)` | `DELETE {base}/object/{bucket}`, JSON `{"prefixes": [ref]}` | 200 (body là danh sách, có thể rỗng) | 404 / 400 not found ⇒ xong (idempotent) |

`build_photo_store(settings)`: `mo_photo_store == "supabase"` ⇒ thiếu `supabase_url` hoặc key rỗng ⇒
`RuntimeError("MO_PHOTO_STORE=supabase cần SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY")` (không in giá trị); ngược lại
`SupabasePhotoStore(...)`. `local` ⇒ `LocalPhotoStore(Path(settings.mo_upload_dir))`.

## 3. `src/api/photos.py` — hợp đồng ở `01-CONTRACTS §6.2`

- `photo_store()`: `supabase` ⇒ một instance/process (hàm có `functools.lru_cache(maxsize=1)` bọc `build_photo_store`);
  `local` ⇒ `LocalPhotoStore(upload_dir())` **tạo mới mỗi lần** — nhờ đó `monkeypatch.setattr(photos, "upload_dir", …)` của test cũ
  vẫn đổi được thư mục.
- Luồng upload giữ thứ tự `_attach_photos` (router KHÔNG đổi hàm này): `read_photos` kiểm cả lô → mỗi ảnh `ref = photos.save(data,
  ext)` → `_call(attach, ref)` (tx DB) → lỗi bất kỳ ⇒ `photos.discard(ref)` (không raise) → raise lỗi gốc.
- `photos.locate` bị xoá; thay bằng `photos.load(ref) -> (bytes, media_type)`.

## 4. Header xác thực Storage — một hàm duy nhất

```python
def _headers(self) -> dict[str, str]:
    key = self._key.get_secret_value()
    headers = {"apikey": key}
    if key.startswith("eyJ"):                      # key JWT kiểu cũ (service_role)
        headers["Authorization"] = f"Bearer {key}"
    return headers
```

Key mới `sb_secret_…` (`.env.example:L40-42`) không phải JWT ⇒ chỉ `apikey`. **Chưa đo** (Q2, probe bị chặn): `M-SB2`
(`OPERATIONS §5`) gọi `GET {base}/bucket/{bucket}` với hai kiểu header; nếu `sb_secret_…` cần `Authorization` thì chỉ sửa hàm này + T15c.

## 5. Retry

`httpx.TransportError` (gồm timeout) và HTTP 5xx ⇒ thử lại tối đa **2 lần**, `sleep(0.5)` rồi `sleep(1.0)`. 4xx không retry
(trừ quy tắc “Duplicate ở lần thử lại” của `put`). Hết lượt ⇒ `PhotoStoreError(status hoặc None, ref, lý do ngắn)`.

## 6. Router (`src/api/routers/maintenance.py`)

```python
def _photo_file(case: Case, evidence_id: str, allowed) -> Response:
    record = next((e for e in allowed(case) if e.evidence_id == evidence_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
    data, media_type = photos.load(record.content_or_metadata)
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, max-age=3600"})
```

Decorator `read_photo` và `resident_read_photo`: `response_class=Response`; kiểu trả về `Response`; bỏ import `FileResponse`
(`L18`) nếu không còn dùng. Đường dẫn, quyền xem (`_staff_case`/`_own_case`, `allowed`), header: **không đổi**.

## 7. Luật

- **CẤM** signed URL / public URL Supabase ra client (vùng cấm `00 §5`).
- **CẤM** key trong exception, log, `repr`: lưu `SecretStr`; `PhotoStoreError` chỉ có status + ref + lý do ≤ 200 ký tự từ body.
- **CẤM** đổi định dạng `ref` / regex `_REF` (`photos.py:L25`); object path trong bucket = đúng `ref` (không thư mục con).
- **CẤM** `_attach_photos` ghi evidence khi `put` chưa thành công (`save` raise 502 trước `_call`).
- **BẮT BUỘC** `local` giữ hành vi v0.5 byte-cho-byte (cùng tên file, cùng thư mục).

## 8. Vùng cấm

| Không làm | Lý do |
|---|---|
| `supabase-py` | 3 lời gọi REST; `httpx` có sẵn (`requirements.txt`). |
| Kiểm mạng Storage lúc startup | Startup phụ thuộc mạng ngoài ⇒ dễ chết oan; chỉ kiểm cấu hình (I-5). |
| `x-upsert: true` để “đỡ lỗi trùng” | Có thể ghi đè ảnh khác nếu bug sinh `ref` trùng; quy tắc Duplicate-ở-lần-retry đủ an toàn. |
| Stream ảnh (`StreamingResponse`) | Ảnh ≤ 5 MB (`MAX_BYTES`); proxy bytes đơn giản hơn. |
| Dọn ảnh mồ côi | Non-goal (`00 §3`). |

## 9. Phân loại lỗi

| Tình huống | Hành vi | HTTP |
|---|---|---|
| Storage 5xx/timeout rồi thành công khi retry | bình thường | 200 |
| `put` hết lượt retry | không ghi evidence | 502 `PHOTO_STORE_FAILED` |
| 401/403 (sai key, sai header) | không retry | 502 `PHOTO_STORE_FAILED` |
| 413 (bucket giới hạn) | không xảy ra nếu `read_photos` đúng (≤ 5 MB); vẫn 502 | 502 |
| `get` không thấy / `ref` sai mẫu | `PhotoNotFoundError` / không gọi store | 404 `Không tìm thấy ảnh` |
| `put` OK nhưng tx DB lỗi | `discard(ref)`; `delete` lỗi ⇒ WARNING `photo discard failed ref=<ref>`, ảnh mồ côi | lỗi gốc (409/403/503/500) |
| `MO_PHOTO_STORE=supabase` thiếu URL/key | `check_photo_store()` lúc startup raise | uvicorn exit 3 |

## 10. Nghiệm thu

| ID | Đạt khi |
|---|---|
| T15 | MockTransport: (a) `put` gửi đúng `POST …/object/maintenance-photos/<ref>`, `x-upsert: false`, `Content-Type`; (b) `get` 200 ⇒ đúng bytes; 404 và 400 `{"statusCode":"404","error":"not_found"}` ⇒ `PhotoNotFoundError`; (c) key `sb_secret_x` ⇒ chỉ `apikey`; key `eyJx` ⇒ thêm `Authorization: Bearer`; (d) 503, 503, 200 ⇒ thành công, `sleep` nhận `[0.5, 1.0]`; 503 ×3 ⇒ `PhotoStoreError(status=503)`; (e) 401 ⇒ đúng 1 request, `PhotoStoreError`; (f) key không có trong `str(exc)` lẫn `repr(store)`; (g) `put` timeout rồi 400 `Duplicate` ⇒ thành công; (h) `delete` gửi `DELETE …/object/maintenance-photos` JSON `{"prefixes":[ref]}`; 404 ⇒ không raise |
| T16 | Store giả ghi lại lời gọi: `attach` raise ⇒ `delete(ref)` được gọi đúng 1 lần và client nhận lỗi gốc; `delete` raise `PhotoStoreError` ⇒ log WARNING chứa `ref` (caplog), client vẫn nhận lỗi gốc |
| T17 | `GET /api/v1/resident/tickets/{id}/photos/{evd}` và `/mo/…`: đúng bytes, `content-type`, `cache-control == "private, max-age=3600"`; `ref` sai mẫu ⇒ 404 |
| T18 | 4 test có ảnh trong `test_api.py` (`L88`, `L131`, `L148`, `L160`) xanh, file không sửa |
