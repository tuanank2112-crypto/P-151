"use client";
// app/(resident)/chat/receipts/ReceiptsTable.tsx — W2 (handoff H21, SPEC-P05
// §6): bảng biên nhận + nút *Hoàn tác*. Nút chỉ hiện khi
// `undo_capability_id !== null && undone_by === null` (đúng luật spec) — route
// `POST /api/actions/undo` (W2) canh lại chính điều kiện này ở tầng máy chủ,
// đây chỉ là hiện/ẩn ở tầng UI, không phải nơi quyết định cuối cùng.
import { useState, useTransition } from "react";
import type { ReceiptRecord } from "../../../../lib/simbackend/contract.ts";
import { formatViDateTime } from "../action-view";
import { revalidateReceipts } from "./actions";

interface Props {
  receipts: ReceiptRecord[];
  actionLabelVi: Record<ReceiptRecord["action"], string>;
}

export function ReceiptsTable({ receipts: initialReceipts, actionLabelVi }: Props) {
  const [receipts, setReceipts] = useState(initialReceipts);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [errorByCode, setErrorByCode] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  async function handleUndo(receiptCode: string) {
    setBusyCode(receiptCode);
    setErrorByCode((prev) => ({ ...prev, [receiptCode]: "" }));
    try {
      const res = await fetch("/api/actions/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receipt_code: receiptCode }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        receipt_code?: string;
        message_vi?: string;
      };
      if (res.ok && data.ok) {
        setReceipts((prev) =>
          prev.map((r) =>
            r.receipt_code === receiptCode ? { ...r, undone_by: data.receipt_code ?? "—" } : r
          )
        );
        startTransition(() => {
          void revalidateReceipts();
        });
      } else {
        setErrorByCode((prev) => ({
          ...prev,
          [receiptCode]: data.message_vi ?? "Không hoàn tác được. Anh/chị thử lại giúp.",
        }));
      }
    } catch {
      setErrorByCode((prev) => ({
        ...prev,
        [receiptCode]: "Không gửi được yêu cầu. Anh/chị kiểm tra kết nối rồi thử lại.",
      }));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <table className="bql-table">
      <thead>
        <tr>
          <th>Mã biên nhận</th>
          <th>Hành động</th>
          <th>Thời điểm</th>
          <th>Trạng thái</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {receipts.map((r) => {
          const canUndo = r.undo_capability_id !== null && r.undone_by === null;
          const err = errorByCode[r.receipt_code];
          return (
            <tr key={r.receipt_code}>
              <td>
                <code>{r.receipt_code}</code>
              </td>
              <td>{actionLabelVi[r.action]}</td>
              <td>{formatViDateTime(r.created_at) ?? r.created_at}</td>
              <td>
                {r.undone_by ? (
                  <>
                    Đã hoàn tác (<code>{r.undone_by}</code>)
                  </>
                ) : r.action === "cancel" ? (
                  "Đã huỷ, không hoàn tác được"
                ) : (
                  "Còn hiệu lực"
                )}
                {err && <p className="bql-cell-error">{err}</p>}
              </td>
              <td>
                {canUndo && (
                  <button
                    type="button"
                    className="btn"
                    disabled={busyCode === r.receipt_code}
                    onClick={() => handleUndo(r.receipt_code)}
                  >
                    {busyCode === r.receipt_code ? "Đang hoàn tác…" : "Hoàn tác"}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
