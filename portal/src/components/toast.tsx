"use client";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="toast">
      <span>{message}</span>
      <button type="button" aria-label="Đóng thông báo" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
