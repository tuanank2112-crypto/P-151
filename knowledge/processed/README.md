# Generated Retrieval Artifacts

Thư mục này dành cho output được sinh bởi ingestion, ví dụ:

- `chunks.jsonl`: các section canonical đã được chuyển thành chunk có
  metadata.
- `index_manifest.json`: checksum, embedding model và thời điểm build index.

Không chỉnh sửa thủ công dữ liệu trong thư mục này. Nguồn sự thật nằm ở
`../raw/`, `../canonical/` và `../manifest.yaml`.

Ingestion chỉ được sinh chunk cho tài liệu có `status: Approved`,
`effective_status: Current` và `allowed_for_rag: true`. Mỗi chunk phải có
ít nhất `chunk_id`, `document_id`, `section_id`, `property_id`, `intent_ids`,
`answer_policy`, `text`, `status` và thông tin hiệu lực.

