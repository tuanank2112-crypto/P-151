"use client";

import { useEffect } from "react";
import { DEPT_LABEL } from "@/lib/constants";
import type { TicketDetail } from "@/lib/dto";

const STAGE_NAMES = ["Tiếp nhận", "Thẩm định", "Phân công", "Đang xử lý", "Nghiệm thu", "Hoàn tất"] as const;

export function TicketDetailModal({
  ticket,
  onClose,
}: {
  ticket: TicketDetail | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (ticket) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ticket, onClose]);

  if (!ticket) return null;

  const currentStage = Math.max(1, Math.min(6, ticket.stage || 1));
  const isCancelled = ticket.cancelled;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-slate-800">#{ticket.code}</span>
              {isCancelled ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                  Đã hủy
                </span>
              ) : currentStage === 6 ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  Hoàn tất
                </span>
              ) : currentStage === 5 ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                  Chờ nghiệm thu
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                  {STAGE_NAMES[currentStage - 1]}
                </span>
              )}
              {ticket.urgent && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500 text-white animate-pulse">
                  Khẩn cấp
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Thời gian gửi: {ticket.createdAt}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            aria-label="Đóng"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 space-y-6 text-sm text-slate-700">
          {/* Status banner */}
          {currentStage === 5 && (
            <div className="rounded-xl p-3 bg-sky-50 border border-sky-200 text-sky-900 text-xs flex gap-2.5 items-start">
              <span className="text-base leading-none">🔔</span>
              <div>
                <strong className="font-semibold">Đã xử lý xong thực địa — Chờ Ban quản lý nghiệm thu.</strong>
                <p className="mt-0.5 text-sky-700">Kỹ thuật/Vệ sinh đã gửi minh chứng sau xử lý. BQL cần đối soát 6 tiêu chí để hoàn tất.</p>
              </div>
            </div>
          )}

          {/* 6-step Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
              <span>Tiến độ xử lý yêu cầu</span>
              <span className="text-sky-600 font-bold">Bước {currentStage}/6</span>
            </div>
            <div className="relative flex items-center justify-between">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-0" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-sky-500 transition-all -z-0"
                style={{ width: `${((currentStage - 1) / 5) * 100}%` }}
              />
              {STAGE_NAMES.map((name, idx) => {
                const stepNum = idx + 1;
                const isPassed = stepNum < currentStage;
                const isCurrent = stepNum === currentStage;
                return (
                  <div key={name} className="flex flex-col items-center z-10">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                        isPassed
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                          ? "bg-sky-600 text-white ring-4 ring-sky-100"
                          : "bg-white text-slate-400 border border-slate-300"
                      }`}
                    >
                      {isPassed ? "✓" : stepNum}
                    </div>
                    <span
                      className={`text-[11px] mt-1.5 whitespace-nowrap hidden sm:block ${
                        isCurrent ? "font-bold text-sky-700" : isPassed ? "font-medium text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Ticket Info Grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-500 block">Phòng ban tiếp nhận</span>
              <span className="font-semibold text-slate-800">
                {ticket.deptName ?? (ticket.dept ? DEPT_LABEL[ticket.dept] : "Đang điều phối phân công")}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Trạng thái</span>
              <span className="font-semibold text-slate-800">{ticket.statusLabel}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Vị trí</span>
              <span className="font-semibold text-slate-800">{ticket.location}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Mức độ</span>
              <span className={`font-semibold ${ticket.urgent ? "text-rose-600" : "text-slate-800"}`}>
                {ticket.urgent ? "Khẩn cấp" : "Thông thường"}
              </span>
            </div>
          </div>

          {/* Original Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 tracking-wide uppercase mb-1.5">Nội dung phản ánh</h4>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
              {ticket.text}
            </div>
          </div>

          {/* Current blocker / public message */}
          {(ticket.blockerLabel || ticket.publicMessage) && (
            <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-100 text-xs">
              {ticket.blockerLabel && <p className="m-0 font-bold text-sky-900">{ticket.blockerLabel}</p>}
              {ticket.publicMessage && <p className="m-0 mt-1 text-slate-700">{ticket.publicMessage}</p>}
            </div>
          )}

          {/* Photos (Before & After) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 tracking-wide uppercase">Hình ảnh minh chứng</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Before photos */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 block mb-2">Ảnh khi tiếp nhận ({ticket.beforePhotos?.length || 0})</span>
                {ticket.beforePhotos && ticket.beforePhotos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {ticket.beforePhotos.map((p) => (
                      <a
                        key={p.id}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-300 hover:scale-105 transition-transform"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Không có hình ảnh tiếp nhận.</p>
                )}
              </div>

              {/* After photos */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 block mb-2">Ảnh sau xử lý ({ticket.afterPhotos?.length || 0})</span>
                {ticket.afterPhotos && ticket.afterPhotos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {ticket.afterPhotos.map((p) => (
                      <a
                        key={p.id}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-16 h-16 rounded-lg overflow-hidden border border-emerald-300 ring-2 ring-emerald-100 hover:scale-105 transition-transform"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Chưa có ảnh hoàn thành hiện trường.</p>
                )}
              </div>
            </div>
          </div>

          {/* Audit Timeline / History */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 tracking-wide uppercase mb-2">Lịch sử xử lý</h4>
            {ticket.history && ticket.history.length > 0 ? (
              <div className="relative pl-5 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {ticket.history.map((h, i) => (
                  <div key={i} className="relative group">
                    <div className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full bg-sky-500 ring-4 ring-white" />
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{h.label}</span>
                        <span className="text-[11px] text-slate-400">{h.time}</span>
                      </div>
                      {h.note && <p className="text-xs text-slate-600 mt-0.5 leading-normal">{h.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Chưa có bản ghi lịch sử.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl shadow-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
