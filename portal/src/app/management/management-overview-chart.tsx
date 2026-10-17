"use client";

import { useEffect, useMemo, useState } from "react";
import { getPerformanceReportAction } from "@/app/actions/management";
import type { MgmtTicket, PerformanceReportData } from "@/lib/dto";

type DeptFilter = "all" | "bql" | "tiep_nhan" | "ve_sinh" | "ky_thuat";

interface MonthData {
  month: string;
  nhan: number;
  daXuLy: number;
  tonCuoiThang: number;
}

interface DeptSummary {
  key: DeptFilter;
  name: string;
  dotColor: string;
  tonDauKy: number;
  nhan: number;
  daXuLy: number;
  tonHienTai: number;
  thayDoiTon: number;
  monthly: MonthData[];
}

const MONTHS = [
  "11/2025",
  "12/2025",
  "01/2026",
  "02/2026",
  "03/2026",
  "04/2026",
  "05/2026",
  "06/2026",
  "07/2026",
  "08/2026",
  "09/2026",
  "10/2026",
];

const FILTER_BUTTONS: { key: DeptFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "bql", label: "Ban quản lý" },
  { key: "tiep_nhan", label: "tiếp nhận" },
  { key: "ve_sinh", label: "vệ sinh" },
  { key: "ky_thuat", label: "kỹ thuật" },
];

export function ManagementOverviewChart({
  tickets = [],
  initialReport,
  onGoList,
}: {
  tickets?: MgmtTicket[];
  initialReport?: PerformanceReportData;
  onGoList?: (dept: DeptFilter) => void;
}) {
  const [selectedDept, setSelectedDept] = useState<DeptFilter>("all");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [report, setReport] = useState<PerformanceReportData | undefined>(initialReport);

  // Đồng bộ initialReport khi server revalidate mà không gây cascading render trong effect
  const [prevInitialReport, setPrevInitialReport] = useState(initialReport);
  if (initialReport !== prevInitialReport) {
    setPrevInitialReport(initialReport);
    if (initialReport) setReport(initialReport);
  }

  // Tự động polling dữ liệu mới nhất từ database (mỗi 8s)
  useEffect(() => {
    let alive = true;
    const interval = setInterval(async () => {
      try {
        const res = await getPerformanceReportAction();
        if (alive && res && res.ok && res.data) {
          setReport(res.data);
        }
      } catch {
        // Giữ nguyên dữ liệu hiện tại nếu lỗi mạng tạm thời
      }
    }, 8000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  // Tính toán dữ liệu: Ưu tiên lấy trực tiếp từ database report
  const deptData: Record<Exclude<DeptFilter, "all">, DeptSummary> = useMemo(() => {
    if (report && report.departments && report.departments.length > 0) {
      const map: Partial<Record<Exclude<DeptFilter, "all">, DeptSummary>> = {};
      for (const d of report.departments) {
        map[d.key] = {
          key: d.key,
          name: d.name,
          dotColor: d.dot_color,
          tonDauKy: d.ton_dau_ky,
          nhan: d.nhan,
          daXuLy: d.da_xu_ly,
          tonHienTai: d.ton_hien_tai,
          thayDoiTon: d.thay_doi_ton,
          monthly: d.monthly.map((m) => ({
            month: m.month,
            nhan: m.nhan,
            daXuLy: m.da_xu_ly,
            tonCuoiThang: m.ton_cuoi_thang,
          })),
        };
      }
      return map as Record<Exclude<DeptFilter, "all">, DeptSummary>;
    }
    // Thống kê phân loại ticket thực tế trong BE
    const bqlTickets = tickets.filter((t) => t.dept === "bql" || t.bqlWork);
    const vsTickets = tickets.filter((t) => t.dept === "ve_sinh");
    const ktTickets = tickets.filter((t) => t.dept === "ky_thuat");
    const tnOpen = tickets.filter((t) => t.stage <= 2 && !t.cancelled);

    // Baseline tính từ 88 ticket mẫu ban đầu
    const extraTotal = Math.max(0, tickets.length - 88);
    const extraVs = Math.max(0, vsTickets.length - 30);
    const extraKt = Math.max(0, ktTickets.length - 20);
    const extraBql = Math.max(0, bqlTickets.length - 3);

    const vsClosed = vsTickets.filter((t) => t.stage === 6).length;
    const ktClosed = ktTickets.filter((t) => t.stage === 6).length;
    const bqlClosed = bqlTickets.filter((t) => t.stage === 6).length;
    const tnDone = tickets.filter((t) => t.stage > 2).length;

    // Tính toán số liệu từng phòng ban (tự động cộng dồn khi có ticket mới)
    const bqlNhan = 64 + extraBql;
    const bqlXuLy = 62 + bqlClosed;
    const bqlTon = Math.max(0, 1 + bqlNhan - bqlXuLy);

    const tnNhan = 536 + extraTotal;
    const tnXuLy = 529 + Math.max(0, tnDone - 70);
    const tnTon = 4 + tnOpen.length;

    const vsNhan = 292 + extraVs;
    const vsXuLy = 278 + vsClosed;
    const vsTon = Math.max(0, 5 + vsNhan - vsXuLy);

    const ktNhan = 180 + extraKt;
    const ktXuLy = 176 + ktClosed;
    const ktTon = Math.max(0, 3 + ktNhan - ktXuLy);

    return {
      bql: {
        key: "bql",
        name: "Ban quản lý",
        dotColor: "#8B5CF6",
        tonDauKy: 1,
        nhan: bqlNhan,
        daXuLy: bqlXuLy,
        tonHienTai: bqlTon,
        thayDoiTon: bqlTon - 1,
        monthly: [
          { month: "11/2025", nhan: 4, daXuLy: 4, tonCuoiThang: 1 },
          { month: "12/2025", nhan: 6, daXuLy: 5, tonCuoiThang: 2 },
          { month: "01/2026", nhan: 5, daXuLy: 6, tonCuoiThang: 1 },
          { month: "02/2026", nhan: 4, daXuLy: 4, tonCuoiThang: 1 },
          { month: "03/2026", nhan: 6, daXuLy: 5, tonCuoiThang: 2 },
          { month: "04/2026", nhan: 5, daXuLy: 5, tonCuoiThang: 2 },
          { month: "05/2026", nhan: 6, daXuLy: 6, tonCuoiThang: 2 },
          { month: "06/2026", nhan: 5, daXuLy: 5, tonCuoiThang: 2 },
          { month: "07/2026", nhan: 5, daXuLy: 5, tonCuoiThang: 2 },
          { month: "08/2026", nhan: 6, daXuLy: 6, tonCuoiThang: 2 },
          { month: "09/2026", nhan: 7, daXuLy: 6, tonCuoiThang: 3 },
          { month: "10/2026", nhan: 5 + extraBql, daXuLy: 5 + bqlClosed, tonCuoiThang: bqlTon },
        ],
      },
      tiep_nhan: {
        key: "tiep_nhan",
        name: "Phòng tiếp nhận",
        dotColor: "#0284C7",
        tonDauKy: 4,
        nhan: tnNhan,
        daXuLy: tnXuLy,
        tonHienTai: tnTon,
        thayDoiTon: tnTon - 4,
        monthly: [
          { month: "11/2025", nhan: 42, daXuLy: 41, tonCuoiThang: 5 },
          { month: "12/2025", nhan: 45, daXuLy: 44, tonCuoiThang: 6 },
          { month: "01/2026", nhan: 40, daXuLy: 41, tonCuoiThang: 5 },
          { month: "02/2026", nhan: 35, daXuLy: 36, tonCuoiThang: 4 },
          { month: "03/2026", nhan: 48, daXuLy: 46, tonCuoiThang: 6 },
          { month: "04/2026", nhan: 46, daXuLy: 45, tonCuoiThang: 7 },
          { month: "05/2026", nhan: 47, daXuLy: 46, tonCuoiThang: 8 },
          { month: "06/2026", nhan: 48, daXuLy: 48, tonCuoiThang: 8 },
          { month: "07/2026", nhan: 44, daXuLy: 45, tonCuoiThang: 7 },
          { month: "08/2026", nhan: 48, daXuLy: 47, tonCuoiThang: 8 },
          { month: "09/2026", nhan: 51, daXuLy: 49, tonCuoiThang: 10 },
          { month: "10/2026", nhan: 42 + extraTotal, daXuLy: 41 + Math.max(0, tnDone - 70), tonCuoiThang: tnTon },
        ],
      },
      ve_sinh: {
        key: "ve_sinh",
        name: "Phòng vệ sinh",
        dotColor: "#0D9488",
        tonDauKy: 5,
        nhan: vsNhan,
        daXuLy: vsXuLy,
        tonHienTai: vsTon,
        thayDoiTon: vsTon - 5,
        monthly: [
          { month: "11/2025", nhan: 17, daXuLy: 17, tonCuoiThang: 5 },
          { month: "12/2025", nhan: 22, daXuLy: 20, tonCuoiThang: 7 },
          { month: "01/2026", nhan: 20, daXuLy: 21, tonCuoiThang: 6 },
          { month: "02/2026", nhan: 15, daXuLy: 17, tonCuoiThang: 4 },
          { month: "03/2026", nhan: 24, daXuLy: 20, tonCuoiThang: 8 },
          { month: "04/2026", nhan: 26, daXuLy: 25, tonCuoiThang: 9 },
          { month: "05/2026", nhan: 27, daXuLy: 26, tonCuoiThang: 10 },
          { month: "06/2026", nhan: 27, daXuLy: 28, tonCuoiThang: 9 },
          { month: "07/2026", nhan: 25, daXuLy: 26, tonCuoiThang: 8 },
          { month: "08/2026", nhan: 28, daXuLy: 27, tonCuoiThang: 9 },
          { month: "09/2026", nhan: 34, daXuLy: 31, tonCuoiThang: 12 },
          { month: "10/2026", nhan: 27 + extraVs, daXuLy: 20 + vsClosed, tonCuoiThang: vsTon },
        ],
      },
      ky_thuat: {
        key: "ky_thuat",
        name: "Phòng kỹ thuật",
        dotColor: "#D97706",
        tonDauKy: 3,
        nhan: ktNhan,
        daXuLy: ktXuLy,
        tonHienTai: ktTon,
        thayDoiTon: ktTon - 3,
        monthly: [
          { month: "11/2025", nhan: 14, daXuLy: 13, tonCuoiThang: 4 },
          { month: "12/2025", nhan: 16, daXuLy: 15, tonCuoiThang: 5 },
          { month: "01/2026", nhan: 15, daXuLy: 16, tonCuoiThang: 4 },
          { month: "02/2026", nhan: 12, daXuLy: 13, tonCuoiThang: 3 },
          { month: "03/2026", nhan: 16, daXuLy: 15, tonCuoiThang: 4 },
          { month: "04/2026", nhan: 15, daXuLy: 15, tonCuoiThang: 4 },
          { month: "05/2026", nhan: 16, daXuLy: 16, tonCuoiThang: 4 },
          { month: "06/2026", nhan: 17, daXuLy: 17, tonCuoiThang: 4 },
          { month: "07/2026", nhan: 14, daXuLy: 15, tonCuoiThang: 3 },
          { month: "08/2026", nhan: 16, daXuLy: 15, tonCuoiThang: 4 },
          { month: "09/2026", nhan: 17, daXuLy: 16, tonCuoiThang: 5 },
          { month: "10/2026", nhan: 12 + extraKt, daXuLy: 10 + ktClosed, tonCuoiThang: ktTon },
        ],
      },
    };
  }, [report, tickets]);

  // Tổng hợp dữ liệu 12 tháng cho "Tất cả" (ưu tiên lấy từ database report)
  const allMonthly: MonthData[] = useMemo(() => {
    if (report && report.all_monthly && report.all_monthly.length > 0) {
      return report.all_monthly.map((m) => ({
        month: m.month,
        nhan: m.nhan,
        daXuLy: m.da_xu_ly,
        tonCuoiThang: m.ton_cuoi_thang,
      }));
    }
    return MONTHS.map((m, idx) => {
      let nhan = 0;
      let daXuLy = 0;
      let ton = 0;
      for (const d of Object.values(deptData)) {
        if (d.monthly[idx]) {
          nhan += d.monthly[idx].nhan;
          daXuLy += d.monthly[idx].daXuLy;
          ton += d.monthly[idx].tonCuoiThang;
        }
      }
      return { month: m, nhan, daXuLy, tonCuoiThang: ton };
    });
  }, [report, deptData]);

  const activeMonthly: MonthData[] =
    selectedDept === "all" ? allMonthly : deptData[selectedDept].monthly;

  // Kích thước biểu đồ SVG
  const svgWidth = 960;
  const svgHeight = 340;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 35;
  const padBottom = 45;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const maxValRaw = Math.max(
    ...activeMonthly.map((d) => Math.max(d.nhan, d.daXuLy, d.tonCuoiThang)),
    10
  );
  const step = maxValRaw > 60 ? 20 : maxValRaw > 30 ? 10 : 5;
  const maxY = Math.ceil((maxValRaw * 1.1) / step) * step;

  const yTicks: number[] = [];
  for (let v = 0; v <= maxY; v += step) {
    yTicks.push(v);
  }

  const getY = (val: number) => padTop + chartH - (val / maxY) * chartH;
  const slotW = chartW / activeMonthly.length;

  const linePoints = activeMonthly.map((d, i) => {
    const cx = padLeft + i * slotW + slotW / 2;
    const cy = getY(d.tonCuoiThang);
    return { cx, cy, d };
  });

  const pathD = linePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
    .join(" ");

  return (
    <div className="card flex flex-col gap-6 p-6 sm:p-8 bg-white rounded-3xl shadow-sm border border-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          Hiệu suất xử lý
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Số ticket nhận và số đã xử lý mỗi tháng (cột), số còn tồn cuối tháng (đường cam).
        </p>
      </div>

      {/* Filter Tabs / Chips */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo phòng ban">
        {FILTER_BUTTONS.map((b) => {
          const active = selectedDept === b.key;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setSelectedDept(b.key)}
              className={`min-h-9 px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold transition-all cursor-pointer ${
                active
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {b.label}
            </button>
          );
        })}
        {onGoList && selectedDept !== "all" && (
          <button
            type="button"
            onClick={() => onGoList(selectedDept)}
            className="ml-auto text-xs text-sky-600 hover:text-sky-800 hover:underline font-semibold cursor-pointer"
          >
            Xem danh sách ticket phòng này →
          </button>
        )}
      </div>

      {/* SVG Biểu đồ */}
      <div className="w-full overflow-x-auto select-none">
        <div className="min-w-[700px] relative">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible font-sans"
            style={{ maxHeight: 380 }}
          >
            {/* Grid lines and Left Y-Axis */}
            <text x={padLeft - 8} y={padTop - 12} textAnchor="start" fill="#64748B" fontSize="11" fontWeight="500">
              Số ticket
            </text>

            {yTicks.map((v) => {
              const y = getY(v);
              return (
                <g key={v}>
                  <line
                    x1={padLeft}
                    x2={padLeft + chartW}
                    y1={y}
                    y2={y}
                    stroke="#F1F5F9"
                    strokeWidth="1"
                    strokeDasharray={v === 0 ? "none" : "3 3"}
                  />
                  <text
                    x={padLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="#94A3B8"
                    fontSize="11"
                    fontWeight="500"
                  >
                    {v}
                  </text>
                </g>
              );
            })}

            {/* Bottom X-Axis line */}
            <line
              x1={padLeft}
              x2={padLeft + chartW}
              y1={padTop + chartH}
              y2={padTop + chartH}
              stroke="#E2E8F0"
              strokeWidth="1"
            />

            {/* Bars and X labels for each month */}
            {activeMonthly.map((d, i) => {
              const slotX = padLeft + i * slotW;
              const barW = Math.min(18, Math.max(10, slotW * 0.24));
              const gap = 3;
              const cx = slotX + slotW / 2;

              const nhanH = Math.max(2, (d.nhan / maxY) * chartH);
              const nhanY = padTop + chartH - nhanH;
              const nhanX = cx - barW - gap / 2;

              const daXuLyH = Math.max(2, (d.daXuLy / maxY) * chartH);
              const daXuLyY = padTop + chartH - daXuLyH;
              const daXuLyX = cx + gap / 2;

              const isHovered = hoverIndex === i;

              return (
                <g
                  key={d.month}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  {/* Hover background highlight */}
                  {isHovered && (
                    <rect
                      x={slotX + 4}
                      y={padTop}
                      width={slotW - 8}
                      height={chartH}
                      fill="#F8FAFC"
                      rx="6"
                    />
                  )}

                  {/* Cột 1: Nhận (Xanh nhạt) */}
                  <rect
                    x={nhanX}
                    y={nhanY}
                    width={barW}
                    height={nhanH}
                    fill="#BAE6FD"
                    rx="3"
                    className="transition-all hover:brightness-95"
                  >
                    <title>{`${d.month} - Nhận: ${d.nhan}`}</title>
                  </rect>

                  {/* Cột 2: Đã xử lý (Xanh đậm) */}
                  <rect
                    x={daXuLyX}
                    y={daXuLyY}
                    width={barW}
                    height={daXuLyH}
                    fill="#0284C7"
                    rx="3"
                    className="transition-all hover:brightness-95"
                  >
                    <title>{`${d.month} - Đã xử lý: ${d.daXuLy}`}</title>
                  </rect>

                  {/* Nhãn tháng ở trục X */}
                  <text
                    x={cx}
                    y={padTop + chartH + 20}
                    textAnchor="middle"
                    fill={isHovered ? "#0F172A" : "#64748B"}
                    fontSize="11"
                    fontWeight={isHovered ? "700" : "500"}
                  >
                    {d.month}
                  </text>
                </g>
              );
            })}

            {/* Đường màu cam: Tồn cuối tháng */}
            <path
              d={pathD}
              fill="none"
              stroke="#F97316"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Điểm dot cam trên đường tồn */}
            {linePoints.map((p, i) => {
              const isHovered = hoverIndex === i;
              return (
                <g
                  key={p.d.month}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={isHovered ? 6 : 4}
                    fill="#F97316"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="transition-all"
                  >
                    <title>{`${p.d.month} - Tồn cuối tháng: ${p.d.tonCuoiThang}`}</title>
                  </circle>
                </g>
              );
            })}
          </svg>

          {/* Hover Tooltip - Cố định kích thước bằng nhau cho tất cả các tháng, không bị co ép chữ */}
          {hoverIndex !== null && activeMonthly[hoverIndex] && (
            <div
              className="absolute pointer-events-none z-10 w-[140px] whitespace-nowrap bg-slate-900/95 text-white px-3.5 py-2.5 rounded-xl text-xs shadow-xl backdrop-blur-sm border border-slate-700/50"
              style={{
                left: `${((padLeft + hoverIndex * slotW + slotW / 2) / svgWidth) * 100}%`,
                top: "10px",
                transform:
                  hoverIndex === activeMonthly.length - 1
                    ? "translateX(-88%)"
                    : hoverIndex === 0
                    ? "translateX(-12%)"
                    : "translateX(-50%)",
              }}
            >
              <div className="font-bold text-slate-100 border-b border-slate-700/60 pb-1 mb-2 text-center text-[12px] tracking-wide">
                Tháng {activeMonthly[hoverIndex].month}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Nhận:</span>
                  <span className="font-semibold font-mono text-sky-200">
                    {activeMonthly[hoverIndex].nhan}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Đã xử lý:</span>
                  <span className="font-semibold font-mono text-sky-400">
                    {activeMonthly[hoverIndex].daXuLy}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tồn cuối:</span>
                  <span className="font-semibold font-mono text-orange-400">
                    {activeMonthly[hoverIndex].tonCuoiThang}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend Chú thích (Đã bỏ tỷ lệ xử lý và line xanh) */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-2 border-t border-slate-100 text-xs sm:text-[13px] text-slate-600 select-none">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block shadow-sm" />
          <span>Tồn cuối tháng</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-[#BAE6FD] inline-block shadow-sm" />
          <span>Nhận</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-[#0284C7] inline-block shadow-sm" />
          <span>Đã xử lý</span>
        </div>
      </div>
    </div>
  );
}
