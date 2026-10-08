"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  acceptTicketAction,
  addExtraAction,
  cancelTicketAction,
  rateTicketAction,
  rejectTicketAction,
  submitTicketAction,
} from "@/app/actions/resident";
import {
  IconBell,
  IconBuilding,
  IconCheck,
  IconClipboard,
  IconInbox,
  IconInfo,
  IconLayers,
  IconLift,
  IconPen,
  IconPin,
  IconStar,
  IconUpload,
  IconWarning,
} from "@/components/icons";
import { PhotoStrip } from "@/components/photo-strip";
import { Body, Header, NavTiles } from "@/components/shell";
import { Toast } from "@/components/toast";
import { useAction } from "@/components/use-action";
import { classify } from "@/lib/agent";
import {
  BAD_TAGS,
  DEPT_LABEL,
  GOOD_TAGS,
  MAX_PHOTOS,
  MIN_DESCRIPTION,
  PLACE_DEFS,
  STAGES,
  STAR_LABEL,
  placeLocation,
  type Place,
} from "@/lib/constants";
import type { ResidentData, ResidentTicket } from "@/lib/dto";

type Tab = "compose" | "mine" | "notice";
type Filter = "all" | "run" | "accept" | "rate" | "done";

const PLACE_ICON: Record<Place, React.ReactNode> = {
  floor: <IconLayers />,
  lobby: <IconBuilding />,
  lift: <IconLift />,
  common: <IconPin />,
};

const EXAMPLES: [string, string][] = [
  ["Đèn hỏng", "Bóng đèn hành lang chập chờn, không sáng"],
  ["Rác chưa thu gom", "Rác chưa được thu gom, có mùi hôi"],
  ["Mất nước", "Căn hộ mất nước từ sáng, vòi nước yếu"],
  ["Thang máy kẹt", "Thang máy dừng giữa tầng, cửa không mở"],
];

const OVERVIEW: [Exclude<Filter, "all">, string, string, string][] = [
  ["run", "Đang xử lý", "#2563EB", "Tiếp nhận đến đang xử lý"],
  ["accept", "Chờ nghiệm thu", "#6D5BD0", "Phòng ban báo đã xong"],
  ["rate", "Chờ đánh giá", "#D99A00", "Đã hoàn tất, chưa chấm sao"],
  ["done", "Đã xong", "#16A34A", "Hoàn tất hoặc đã hủy"],
];

function status(t: ResidentTicket): [string, string] {
  if (t.cancelled) return ["pill s-cancel", "Đã hủy"];
  if (t.paused) return ["pill s-pause", "Tạm hoãn"];
  if (t.stage === 5) return ["pill s-wait", "Chờ nghiệm thu"];
  if (t.stage === 6) return ["pill s-done", "Hoàn tất"];
  return ["pill s-run", STAGES[t.stage - 1]];
}

function inFilter(t: ResidentTicket, f: Filter): boolean {
  if (f === "run") return !t.cancelled && t.stage < 5;
  if (f === "accept") return !t.cancelled && t.stage === 5;
  if (f === "rate") return !t.cancelled && t.stage === 6 && !t.rating;
  if (f === "done") return t.cancelled || t.stage === 6;
  return true;
}

type LocalPhoto = { file: File; url: string };

export function ResidentApp({ data }: { data: ResidentData }) {
  const { user, tickets: all, notices, rules } = data;
  const home = { tower: user.tower, floor: user.floor, apartment: user.apartment };
  const { pending, error, setError, run } = useAction();

  const [tab, setTab] = useState<Tab>("compose");
  // Compose
  const [urgentPick, setUrgentPick] = useState<boolean | null>(null);
  const [place, setPlace] = useState<Place>("floor");
  const [sub, setSub] = useState("");
  const [drag, setDrag] = useState(false);
  const [draft, setDraft] = useState("");
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState<{ code: string; text: string } | null>(null);
  // Mine
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<number | null>(all[0]?.id ?? null);
  const [extra, setExtra] = useState("");
  const [rStars, setRStars] = useState(0);
  const [rTags, setRTags] = useState<string[]>([]);
  const [rComment, setRComment] = useState("");

  // Revoke preview URLs still held when the page unmounts
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const pick = (t: Tab) => {
    setTab(t);
    setDone(null);
  };

  // ---------- Gửi phản ánh ----------
  const ai = useMemo(() => classify(draft, rules, home), [draft, rules, home.tower, home.floor]); // eslint-disable-line react-hooks/exhaustive-deps
  const dept = ai.dept;
  const urgent = urgentPick === null ? ai.urgent : urgentPick;
  const baseLoc = placeLocation(place, sub, home);
  const finalLoc = ai.locationFromText ? `${ai.locationFromText} (theo mô tả)` : baseLoc;
  const descOk = draft.trim().length >= MIN_DESCRIPTION;

  const addFiles = (files: FileList | null) => {
    setDrag(false);
    if (!files) return;
    const cur = photos.slice();
    for (let k = 0; k < files.length && cur.length < MAX_PHOTOS; k++) {
      const f = files[k];
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) continue;
      cur.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPhotos(cur);
    setFormError("");
  };
  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photos[idx].url);
    setPhotos(photos.filter((_, j) => j !== idx));
  };

  const submit = () => {
    if (!descOk) {
      setFormError("Vui lòng mô tả vấn đề (ít nhất 10 ký tự).");
      return;
    }
    const fd = new FormData();
    fd.set("description", draft);
    fd.set("place", place);
    fd.set("placeDetail", sub);
    fd.set("urgent", urgentPick === null ? "auto" : String(urgentPick));
    photos.forEach((p) => fd.append("photos", p.file, p.file.name));
    setFormError("");
    run(
      () => submitTicketAction(fd),
      (res) => {
        photos.forEach((p) => URL.revokeObjectURL(p.url));
        setPhotos([]);
        setDraft("");
        setUrgentPick(null);
        setPlace("floor");
        setSub("");
        setSel(res.id);
        setFilter("all");
        setDone({
          code: res.code,
          text: `Dự kiến chuyển đến ${res.dept ? DEPT_LABEL[res.dept] : "Ban tiếp nhận"}, xử lý trong ${res.urgent ? "4 giờ" : "48 giờ"}.`,
        });
      },
      (r) => {
        if (r.code !== "INVALID_INPUT") return false;
        setFormError(r.message);
        return true;
      },
    );
  };

  // ---------- Phản ánh của tôi ----------
  const list = all.filter((t) => inFilter(t, filter));
  const cur = all.find((t) => t.id === sel) ?? list[0] ?? null;
  const selectTicket = (id: number) => {
    setSel(id);
    setExtra("");
    setRStars(0);
    setRTags([]);
    setRComment("");
  };
  const mineCount = all.filter((t) => !t.cancelled && t.stage < 6).length;

  return (
    <div className="scr-resident min-h-screen bg-page">
      <Header
        avatar={user.avatar}
        name={user.name}
        rolePill={`Cư dân · ${user.tower}-${user.apartment}`}
        bellLabel="Thông báo & Cảnh báo"
        bellCount={notices.length + all.filter((t) => t.stage === 5 || (t.stage === 6 && !t.rating) || t.urgent).length}
        notices={[
          ...all
            .filter((t) => t.stage === 5 || (t.stage === 6 && !t.rating) || t.urgent)
            .map((t) => ({
              id: `t-${t.id}`,
              title: `${t.code}: ${t.title}`,
              time: t.sentAt,
              body:
                t.stage === 5
                  ? "Kỹ thuật đã xử lý xong · Cần bạn nghiệm thu"
                  : t.stage === 6 && !t.rating
                    ? "Đã hoàn thành · Mời bạn đánh giá chất lượng"
                    : `Trạng thái: Bước ${t.stage}/6 · Khẩn cấp`,
              urgent: t.urgent,
              tag: "Phản ánh của bạn",
            })),
          ...notices.map((n) => ({
            id: `n-${n.id}`,
            title: n.title,
            time: n.date,
            body: n.body,
            tag: "Ban quản lý",
          })),
        ]}
      />
      <Body>
        <NavTiles<Tab>
          label="Chức năng cư dân"
          active={tab}
          onPick={pick}
          items={[
            { key: "compose", label: "Gửi phản ánh", icon: <IconPen /> },
            { key: "mine", label: "Phản ánh của tôi", icon: <IconClipboard />, count: mineCount },
          ]}
        />

        {/* ===================== GỬI PHẢN ÁNH ===================== */}
        {tab === "compose" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h1 className="mt-2 mb-0 text-[28px] font-bold tracking-[-0.01em]">Gửi phản ánh mới</h1>
              <p className="m-0 text-[15px] text-muted">
                Mô tả vấn đề, chọn vị trí và thêm ảnh nếu có. Agent sẽ tự phân loại và chuyển đúng phòng ban.
              </p>
            </div>

            {done && (
              <div role="status" className="card flex flex-wrap items-center gap-4 px-6 py-5" style={{ border: "2px solid #16A34A" }}>
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-white" style={{ background: "#16A34A" }}>
                  <IconCheck />
                </span>
                <div className="flex flex-col gap-0.5" style={{ flex: "1 1 300px" }}>
                  <span className="text-[17px] font-bold">Đã gửi {done.code}</span>
                  <span className="text-sm text-muted">{done.text}</span>
                </div>
                <button type="button" className="btn" onClick={() => pick("mine")}>
                  Theo dõi tiến độ
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-start gap-5">
              <div className="flex min-w-0 flex-col gap-5" style={{ flex: "999 1 600px" }}>
                {/* 1. Mô tả */}
                <section className="card flex flex-col gap-3.5 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="num">1</span>
                      <label htmlFor="draft" className="text-lg font-bold">
                        Mô tả vấn đề
                      </label>
                    </div>
                  </div>
                  <textarea
                    id="draft"
                    className="field"
                    rows={4}
                    placeholder="Ví dụ: Bóng đèn hành lang chập chờn, không sáng. Nếu sự cố ở tầng khác, ghi rõ: tầng 15, cạnh thang máy."
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setFormError("");
                    }}
                    style={{ resize: "vertical", minHeight: 120 }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-muted">Câu mẫu:</span>
                    {EXAMPLES.map(([label, text]) => (
                      <button key={label} type="button" className="chip sm" onClick={() => setDraft(text)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {draft.trim().length > 2 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-soft px-3.5 py-3 text-[13px]">
                      <span className="font-bold text-brand">Agent nhận diện:</span>
                      <span className={`pill cat-${dept ?? "none"}`}>
                        <span className="dot" />
                        {dept ? DEPT_LABEL[dept] : "Chưa rõ, Ban tiếp nhận sẽ xem"}
                      </span>
                      <span className="text-body">
                        {dept ? `Từ khóa: ${ai.keywords.join(", ")} · ${ai.confidence}%` : "Mô tả thêm để Agent nhận diện."}
                      </span>
                    </div>
                  )}
                </section>

                {/* 2. Vị trí */}
                <section className="card flex flex-col gap-3.5 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="num">2</span>
                      <h2 className="m-0 text-lg font-bold">Vị trí</h2>
                    </div>
                    <span className="text-[13px] text-muted">
                      Tòa {home.tower} · Căn {home.apartment}
                    </span>
                  </div>
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    {data.places.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={place === k ? "place on" : "place"}
                        aria-pressed={place === k}
                        onClick={() => {
                          if (place !== k) {
                            setPlace(k);
                            setSub("");
                          }
                        }}
                      >
                        <span className="ic">{PLACE_ICON[k]}</span>
                        <span className="flex flex-col">
                          <span className="text-[15px] font-semibold">{PLACE_DEFS[k].title}</span>
                          <span className="text-xs text-muted">{PLACE_DEFS[k].hint(home)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-0.5 text-[13px] text-muted">Chi tiết (không bắt buộc):</span>
                    {PLACE_DEFS[place].opts.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={sub === o ? "chip sm on" : "chip sm"}
                        aria-pressed={sub === o}
                        onClick={() => setSub(sub === o ? "" : o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                  {ai.locationFromText && (
                    <div role="status" className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-3 text-sm" style={{ background: "#FFF7E0", color: "#5C4200" }}>
                      <IconInfo />
                      <span>
                        Mô tả có nhắc <b>{ai.locationFromText}</b>. Agent sẽ ưu tiên vị trí này.
                      </span>
                    </div>
                  )}
                </section>

                {/* 3. Ảnh */}
                <section className="card flex flex-col gap-3.5 p-6">
                  <div className="flex items-center gap-3">
                    <span className="num">3</span>
                    <h2 className="m-0 text-lg font-bold">
                      Ảnh hiện trường <span className="text-sm font-normal text-muted">(không bắt buộc)</span>
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-stretch gap-2.5">
                    {photos.map((p, idx) => (
                      <div key={p.url} className="thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                        <img src={p.url} alt={p.file.name} />
                        <button type="button" className="x" aria-label={`Xóa ảnh ${p.file.name}`} onClick={() => removePhoto(idx)}>
                          ×
                        </button>
                      </div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <label
                        className={drag ? "drop over" : "drop"}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!drag) setDrag(true);
                        }}
                        onDragLeave={() => setDrag(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          addFiles(e.dataTransfer?.files ?? null);
                        }}
                        style={{ flex: "1 1 260px" }}
                      >
                        <span className="text-brand-mid">
                          <IconUpload />
                        </span>
                        <span className="text-[15px] font-semibold text-brand">Chọn ảnh từ máy tính</span>
                        <span className="text-[13px] text-muted">
                          hoặc kéo thả vào đây · còn {MAX_PHOTOS - photos.length} ảnh · JPG, PNG, WEBP
                        </span>
                        <input
                          className="sr"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(e) => {
                            addFiles(e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </section>
              </div>

              {/* Tóm tắt */}
              <aside className="card sticky top-4 flex min-w-0 flex-col gap-4 p-6" style={{ flex: "1 1 320px" }}>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h2 className="m-0 text-lg font-bold text-body">Tóm tắt phiếu gửi</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-soft text-brand">Xem trước</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Mô tả vấn đề</span>
                  {draft.trim() ? (
                    <div className="border-l-2 border-brand/70 pl-3 py-1 text-[14px] leading-relaxed font-medium text-body break-words bg-soft/40 rounded-r-lg">
                      {draft}
                    </div>
                  ) : (
                    <span className="text-[13px] italic text-muted">Chưa nhập nội dung</span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Vị trí phản ánh</span>
                  <span className="text-[14px] font-semibold text-body flex items-center gap-1.5">
                    📍 {finalLoc}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Đơn vị tiếp nhận dự kiến</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`pill cat-${dept ?? "none"}`}>
                      <span className="dot" />
                      {dept ? DEPT_LABEL[dept] : "Ban tiếp nhận sẽ phân loại"}
                    </span>
                    {urgent && <span className="pill urgent">Khẩn cấp</span>}
                  </div>
                  <span className="text-[13px] text-muted">Dự kiến xử lý trong {urgent ? "4 giờ" : "48 giờ"}.</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Hình ảnh đính kèm</span>
                  <span className="text-[14px] font-semibold text-body">
                    {photos.length ? `📷 Đã chọn ${photos.length} ảnh` : "Chưa có ảnh"}
                  </span>
                </div>

                <div className="flex flex-col gap-2 border-t border-line pt-3.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted mb-0.5">Điều kiện gửi</span>
                  {[
                    { label: "Mô tả ít nhất 10 ký tự", ok: descOk },
                    { label: "Vị trí hợp lệ", ok: true },
                  ].map((c) => (
                    <div key={c.label} className={c.ok ? "chk ok" : "chk"}>
                      <span className="bx">
                        <IconCheck size={12} width={3.5} />
                      </span>
                      {c.label}
                    </div>
                  ))}
                </div>

                {formError && (
                  <div role="alert" className="rounded-xl px-3.5 py-2.5 text-sm" style={{ background: "#FDE2DF", color: "#8A1C12" }}>
                    {formError}
                  </div>
                )}

                <button type="button" className="btn primary big mt-1" onClick={submit} disabled={pending}>
                  {pending ? "Đang gửi…" : "Gửi phản ánh"}
                </button>
              </aside>
            </div>
          </div>
        )}

        {/* ===================== PHẢN ÁNH CỦA TÔI ===================== */}
        {tab === "mine" && (
          <div className="anim-fade flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h1 className="mt-2 mb-0 text-[28px] font-bold tracking-[-0.01em]">Phản ánh của tôi</h1>
              <p className="m-0 text-[15px] text-muted">
                Xem ticket đang ở bước nào, bổ sung thông tin, nghiệm thu và đánh giá sau khi hoàn tất.
              </p>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
              {OVERVIEW.map(([key, label, color, hint]) => (
                <button
                  key={key}
                  type="button"
                  className={filter === key ? "ov on card-hover" : "ov card-hover"}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(filter === key ? "all" : key)}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm text-muted">{label}</span>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  </span>
                  <span className="text-[30px] font-bold">{all.filter((t) => inFilter(t, key)).length}</span>
                  <span className="text-xs text-muted">{hint}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-start gap-5">
              <section className="flex min-w-0 flex-col gap-3" style={{ flex: "1 1 340px" }}>
                {list.length === 0 && (
                  <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-soft text-brand">
                      <IconInbox size={24} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[15px] font-semibold text-body">Không có phản ánh nào</span>
                      <span className="text-xs text-muted">
                        Chưa có ticket nào phù hợp với bộ lọc này.
                      </span>
                    </div>
                    {filter !== "all" && (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => setFilter("all")}
                      >
                        Xem tất cả ({all.length})
                      </button>
                    )}
                  </div>
                )}
                {list.map((t) => {
                  const [stCls, stLabel] = status(t);
                  const needRate = t.stage === 6 && !t.rating && !t.cancelled;
                  const needAccept = t.stage === 5 && !t.cancelled;
                  const needInfo = t.needInfo && !t.cancelled;
                  return (
                    <button key={t.id} type="button" className={cur?.id === t.id ? "titem on card-hover" : "titem card-hover"} onClick={() => selectTicket(t.id)}>
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="idb">{t.code}</span>
                        <span className={stCls}>
                          <span className="dot" />
                          {stLabel}
                        </span>
                      </span>
                      <span className="text-[15px] leading-[1.4] font-semibold">{t.title}</span>
                      <span className="flex w-full gap-1" aria-label={`Tiến độ bước ${t.stage} trên 6`}>
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <span
                            key={n}
                            className={
                              t.cancelled
                                ? "seg"
                                : n < t.stage || t.stage === 6
                                  ? "seg done"
                                  : n === t.stage
                                    ? t.paused
                                      ? "seg pause"
                                      : "seg cur"
                                    : "seg"
                            }
                          />
                        ))}
                      </span>
                      <span className="text-[13px] text-muted">
                        Bước {t.stage}/6 · {t.history[0] ? `${t.history[0].label} · ${t.history[0].time}` : ""}
                      </span>
                      {(needRate || needAccept || needInfo) && (
                        <span className="pill need">
                          {needRate ? "Cần bạn đánh giá" : needAccept ? "Cần bạn nghiệm thu" : "Cần bạn bổ sung thông tin"}
                        </span>
                      )}
                      {t.rating && <span className="text-[13px] text-muted">Bạn đã đánh giá {t.rating.stars}/5 sao</span>}
                    </button>
                  );
                })}
              </section>

              {cur && (
                <TicketDetail
                  key={cur.id}
                  t={cur}
                  pending={pending}
                  extra={extra}
                  setExtra={setExtra}
                  rStars={rStars}
                  rTags={rTags}
                  rComment={rComment}
                  setRStars={(n) => {
                    setRStars(n);
                    setRTags([]);
                  }}
                  setRTags={setRTags}
                  setRComment={setRComment}
                  onAccept={() => run(() => acceptTicketAction(cur.id))}
                  onReject={() => run(() => rejectTicketAction(cur.id))}
                  onCancel={() => run(() => cancelTicketAction(cur.id))}
                  onAddExtra={() => {
                    const txt = extra.trim();
                    if (!txt) return;
                    run(() => addExtraAction(cur.id, txt), () => setExtra(""));
                  }}
                  onRate={() => {
                    if (!rStars) return;
                    run(
                      () => rateTicketAction(cur.id, { stars: rStars, tags: rTags, comment: rComment.trim() }),
                      () => {
                        setRStars(0);
                        setRTags([]);
                        setRComment("");
                      },
                    );
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* ===================== THÔNG BÁO ===================== */}
        {tab === "notice" && (
          <section className="flex max-w-[900px] flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="mt-2 mb-0 text-[28px] font-bold tracking-[-0.01em]">Thông báo & Hoạt động</h1>
              <p className="m-0 text-[15px] text-muted">
                Cập nhật trạng thái xử lý các phản ánh của bạn và thông báo chung từ Ban quản lý tòa nhà.
              </p>
            </div>

            {/* Cập nhật phản ánh của cư dân */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="m-0 text-[18px] font-bold">Trạng thái phản ánh của bạn ({all.length})</h2>
                {all.length > 0 && (
                  <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => pick("mine")}>
                    Xem danh sách phản ánh →
                  </button>
                )}
              </div>

              {all.length === 0 && (
                <div className="card p-7 text-center text-sm text-muted">
                  Bạn chưa có phản ánh nào. Khi bạn gửi phản ánh, tiến độ xử lý và cập nhật sẽ hiển thị tại đây.
                </div>
              )}

              {all.map((t) => {
                const [stCls, stLabel] = status(t);
                const latestHistory = t.history[0];
                return (
                  <article key={t.id} className="card flex items-start gap-4 px-6 py-4.5 transition-colors hover:border-brand-mid">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-soft text-brand">
                      {t.stage === 6 ? <IconCheck size={20} /> : t.urgent ? <IconWarning size={20} /> : <IconBell size={20} />}
                    </span>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="idb">#{t.code}</span>
                        <span className={stCls}>
                          <span className="dot" />
                          {stLabel}
                        </span>
                        {t.urgent && <span className="pill urgent">Khẩn cấp</span>}
                        <span className="ml-auto text-xs text-muted">{latestHistory?.time ?? t.sentAt}</span>
                      </div>
                      <h3 className="m-0 text-[16px] font-semibold text-body">{t.title}</h3>
                      <p className="m-0 text-sm text-muted">
                        {latestHistory ? `${latestHistory.label}: ${latestHistory.note || "Đang được xử lý"}` : `Gửi lúc: ${t.sentAt}`}
                      </p>
                      {t.stage === 5 && !t.cancelled && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="pill need">Kỹ thuật đã xử lý xong · Cần bạn nghiệm thu</span>
                          <button
                            type="button"
                            className="btn sm primary"
                            onClick={() => {
                              selectTicket(t.id);
                              pick("mine");
                            }}
                          >
                            Nghiệm thu ngay
                          </button>
                        </div>
                      )}
                      {t.stage === 6 && !t.rating && !t.cancelled && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="pill need">Đã hoàn thành · Mời bạn đánh giá chất lượng</span>
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => {
                              selectTicket(t.id);
                              pick("mine");
                            }}
                          >
                            Đánh giá sao
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Thông báo chung từ Ban quản lý */}
            <div className="flex flex-col gap-3 pt-2">
              <h2 className="m-0 text-[18px] font-bold">Thông báo chung từ Ban quản lý</h2>
              {notices.length === 0 && <div className="card p-7 text-center text-sm text-muted">Chưa có thông báo chung nào.</div>}
              {notices.map((n) => (
                <article key={n.id} className="card flex items-start gap-4 px-6 py-[22px]">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-line-soft text-brand-mid">
                    <IconBuilding size={20} />
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-brand">BAN QUẢN LÝ · {n.date}</span>
                    <h2 className="m-0 text-[16px] font-bold">{n.title}</h2>
                    <p className="m-0 text-sm leading-[1.55] text-body">{n.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </Body>
      <Toast message={error} onClose={() => setError("")} />
    </div>
  );
}

function TicketDetail(props: {
  t: ResidentTicket;
  pending: boolean;
  extra: string;
  setExtra: (v: string) => void;
  rStars: number;
  rTags: string[];
  rComment: string;
  setRStars: (n: number) => void;
  setRTags: (v: string[]) => void;
  setRComment: (v: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onAddExtra: () => void;
  onRate: () => void;
}) {
  const { t, rStars, rTags } = props;
  const [stCls, stLabel] = status(t);
  const canAccept = t.stage === 5 && !t.cancelled;
  const canRate = t.stage === 6 && !t.rating && !t.cancelled;
  const canAdd = !t.cancelled && t.stage < 6;
  const canCancel = !t.cancelled && t.stage <= 2;
  const info = [
    { k: "Phòng ban tiếp nhận", v: t.dept ? DEPT_LABEL[t.dept] : "Đang điều phối phân công" },
    { k: "Người phụ trách", v: t.staffName ?? (t.dept === "bql" && t.stage >= 4 ? DEPT_LABEL.bql : "Chưa phân công") },
    { k: "Vị trí", v: t.location },
    { k: "Mức độ", v: t.urgent ? "Khẩn cấp · xử lý trong 4 giờ" : "Thông thường · xử lý trong 48 giờ" },
  ];

  return (
    <section className="card flex min-w-0 flex-col gap-5 p-7" style={{ flex: "999 1 560px" }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="idb">#{t.code}</span>
        <span className="text-[13px] text-muted">Thời gian gửi: {t.sentAt}</span>
        <span className={`${stCls} ml-auto`}>
          <span className="dot" />
          {stLabel}
        </span>
      </div>
      <h2 className="-mt-2 mb-0 text-[22px] leading-[1.35] font-bold">{t.title}</h2>

      {t.paused && !t.cancelled && (
        <div role="status" className="rounded-2xl px-[18px] py-4 text-[15px] leading-[1.55]" style={{ background: "#FFF7E0", border: "1px solid #F3D27A", color: "#5C4200" }}>
          {t.pauseText}
        </div>
      )}
      {t.needInfo && !t.cancelled && (
        <div role="status" className="rounded-2xl px-[18px] py-4 text-[15px] leading-[1.55]" style={{ background: "#FFF7E0", border: "1px solid #F3D27A", color: "#5C4200" }}>
          Ban tiếp nhận cần thêm thông tin để phân loại. Vui lòng bổ sung chi tiết ở mục bên dưới.
        </div>
      )}
      {t.cancelled && (
        <div role="status" className="rounded-2xl px-[18px] py-4 text-[15px]" style={{ background: "#E9EDF3", color: "#2A3447" }}>
          {t.mergedInto
            ? `Phản ánh này trùng với ${t.mergedInto} nên đã được gộp và xử lý chung.`
            : "Bạn đã hủy phản ánh này."}
        </div>
      )}

      <div className="flex flex-col gap-4 overflow-x-auto rounded-[18px] border border-line bg-field px-5 py-[18px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold">Tiến độ xử lý yêu cầu</span>
          <span className="text-[13px] font-bold text-brand">Bước {t.stage}/6</span>
        </div>
        <div className="grid min-w-[520px]" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
          {STAGES.map((label, i) => {
            const n = i + 1;
            const isDone = n < t.stage || t.stage === 6;
            const isCur = n === t.stage && t.stage < 6;
            return (
              <div key={label} className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 pr-1.5">
                  <span className={`sd${isDone ? " done" : isCur ? (t.paused ? " pause" : " cur") : ""}`}>{isDone ? "✓" : n}</span>
                  {n < 6 && <span className={n < t.stage || t.stage === 6 ? "sl done" : "sl"} />}
                </div>
                <span className={isDone || isCur ? "slab done" : "slab"}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {info.map((i) => (
          <div key={i.k} className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">{i.k}</span>
            <span className="text-[15px] font-medium">{i.v}</span>
          </div>
        ))}
      </div>

      {t.photos.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted">Ảnh hiện trường</span>
          <PhotoStrip photos={t.photos} />
        </div>
      )}

      {canAccept && (
        <div className="flex flex-col gap-3 rounded-2xl p-[18px]" style={{ background: "#EEF4FF", border: "1px solid #C9DAFF" }}>
          <span className="text-[15px] font-semibold">Phòng ban báo đã xử lý xong. Bạn kiểm tra và nghiệm thu giúp nhé.</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn primary" onClick={props.onAccept} disabled={props.pending}>
              Xác nhận đã xử lý xong
            </button>
            <button type="button" className="btn" onClick={props.onReject} disabled={props.pending}>
              Chưa đạt, yêu cầu làm lại
            </button>
          </div>
        </div>
      )}

      {canRate && (
        <div className="flex flex-col gap-3.5 rounded-[18px] p-5" style={{ background: "#FFFBEB", border: "1px solid #F6DE8D" }}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px] font-bold">Đánh giá kết quả xử lý</span>
            <span className="text-sm text-muted">
              {(t.dept ? DEPT_LABEL[t.dept] : "Phòng ban") + (t.staffName ? ` · ${t.staffName}` : "")} đã hoàn tất. Đánh giá giúp Ban quản lý cải
              thiện chất lượng.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Số sao" className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={n === rStars}
                  aria-label={`${n} sao, ${STAR_LABEL[n]}`}
                  className={n <= rStars ? "star on" : "star"}
                  onClick={() => props.setRStars(n)}
                >
                  <IconStar />
                </button>
              ))}
            </div>
            <span className="text-[15px] font-semibold">{rStars ? STAR_LABEL[rStars] : "Chọn số sao"}</span>
          </div>
          {rStars > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {(rStars >= 4 ? GOOD_TAGS : BAD_TAGS).map((g) => {
                  const on = rTags.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      className={on ? "chip sm on" : "chip sm"}
                      aria-pressed={on}
                      onClick={() => props.setRTags(on ? rTags.filter((x) => x !== g) : [...rTags, g])}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              <label htmlFor="rcomment" className="sr">
                Nhận xét thêm
              </label>
              <textarea
                id="rcomment"
                className="field"
                rows={2}
                placeholder="Nhận xét thêm (không bắt buộc)"
                value={props.rComment}
                onChange={(e) => props.setRComment(e.target.value)}
                style={{ resize: "vertical", background: "#FFFFFF" }}
              />
              {rStars < 3 && (
                <span className="text-[13px]" style={{ color: "#8A1C12" }}>
                  Đánh giá dưới 3 sao sẽ được chuyển Ban quản lý xem xét và liên hệ lại với bạn.
                </span>
              )}
              <div>
                <button type="button" className="btn primary" onClick={props.onRate} disabled={props.pending}>
                  Gửi đánh giá
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {t.rating && (
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-line px-5 py-[18px]">
          <span className="text-xs font-bold tracking-[.06em] text-muted">ĐÁNH GIÁ CỦA BẠN</span>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex gap-0.5" aria-label={`${t.rating.stars} trên 5 sao`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={n <= t.rating!.stars ? "rs on" : "rs"}>
                  <IconStar size={22} />
                </span>
              ))}
            </span>
            <span className="text-[15px] font-semibold">
              {t.rating.stars}/5 · {STAR_LABEL[t.rating.stars]}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {t.rating.tags.map((g) => (
              <span key={g} className="pill s-run">
                {g}
              </span>
            ))}
          </div>
          {t.rating.comment && <p className="m-0 text-sm leading-[1.55] text-body">“{t.rating.comment}”</p>}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-[18px] border border-line px-5 py-[18px]">
        <span className="text-xs font-bold tracking-[.06em] text-muted">THÔNG TIN BỔ SUNG TỪ BẠN</span>
        {t.extras.length === 0 && <span className="text-sm text-muted">Chưa có thông tin bổ sung.</span>}
        {t.extras.length > 0 && (
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-normal">
            {t.extras.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
        {canAdd && (
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor="extra" className="sr">
              Bổ sung thông tin
            </label>
            <input
              id="extra"
              className="field"
              style={{ flex: "1 1 260px", width: "auto" }}
              type="text"
              placeholder="Thêm chi tiết, ví dụ: đèn tắt hẳn từ tối nay"
              value={props.extra}
              onChange={(e) => props.setExtra(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") props.onAddExtra();
              }}
            />
            <button type="button" className="btn primary" onClick={props.onAddExtra} disabled={props.pending}>
              Gửi bổ sung
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 pt-1">
        <h3 className="mt-0 mb-2.5 text-[17px] font-bold">Lịch sử xử lý</h3>
        {t.history.map((h, i) => (
          <div key={i} className="flex gap-3.5">
            <div className="flex w-3 flex-col items-center">
              <span className={i === 0 ? "hd first" : "hd"} />
              {i < t.history.length - 1 && <span className="my-1 w-0.5 flex-1 bg-line" />}
            </div>
            <div className="flex flex-col gap-0.5 pb-4">
              <span className="text-[15px] font-semibold">{h.label}</span>
              <span className="text-sm leading-normal text-body">{h.note}</span>
              <span className="text-xs text-muted">{h.time}</span>
            </div>
          </div>
        ))}
      </div>

      {canCancel && (
        <div className="flex justify-end border-t border-line pt-4">
          <button type="button" className="btn danger" onClick={props.onCancel} disabled={props.pending}>
            Hủy phản ánh
          </button>
        </div>
      )}
    </section>
  );
}
