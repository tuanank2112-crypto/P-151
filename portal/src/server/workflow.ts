/**
 * Every ticket mutation of the portal. Contract: planning/06_2026-10-07_resident-portal-next/specs/01-CONTRACTS.md §2, §4–5.
 * Each function: checks permission → locks the ticket row (FOR UPDATE) → checks scope and stage → writes → history.
 * Pure of Next.js so it runs in tests against a real Postgres.
 */
import { and, eq, gt, lt, lte, ne } from "drizzle-orm";
import type { Db } from "@/db/client";
import { history, keywords, materials, photos, ratings, staff, tickets, PLACES, type TicketRow } from "@/db/schema";
import { classify, type KeywordRules } from "@/lib/agent";
import { DUP_WINDOW_HOURS, findDuplicates, type DupMatch, type DupTicket } from "@/lib/duplicates";
import {
  BAD_TAGS,
  DEPT_LABEL,
  DEPT_ORDER,
  GOOD_TAGS,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  MIN_DESCRIPTION,
  PLACE_DEFS,
  ROLE_DEPT,
  STAR_LABEL,
  placeLocation,
  ticketCode,
  type Dept,
  type Place,
  type Role,
} from "@/lib/constants";
import { can, type Permission } from "@/lib/permissions";
import { sniffImage } from "@/lib/photos";
import { fail, ok, type ActionResult } from "@/lib/result";

export type Actor = {
  id: number;
  role: Role;
  tower?: string | null;
  floor?: string | null;
  apartment?: string | null;
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Failure = ReturnType<typeof fail>;

class Abort extends Error {
  constructor(readonly result: Failure) {
    super(result.message);
  }
}
const abort = (...args: Parameters<typeof fail>): never => {
  throw new Abort(fail(...args));
};

async function run<T>(db: Db, body: (tx: Tx) => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await db.transaction(body));
  } catch (e) {
    if (e instanceof Abort) return e.result;
    throw e;
  }
}

function need(actor: Actor, perm: Permission, onlyRole?: Role) {
  if (!can(actor.role, perm) || (onlyRole && actor.role !== onlyRole)) abort("FORBIDDEN");
}

/** Whether the actor may see this ticket at all (SPEC-P01 §5). Outside scope ⇒ NOT_FOUND, never FORBIDDEN. */
export function inScope(actor: Actor, t: Pick<TicketRow, "residentId" | "dept" | "cancelled">): boolean {
  switch (actor.role) {
    case "resident":
      return t.residentId === actor.id;
    case "reception":
    case "management":
      return true;
    default:
      return !t.cancelled && t.dept === ROLE_DEPT[actor.role];
  }
}

async function lock(tx: Tx, actor: Actor, id: number): Promise<TicketRow> {
  if (!Number.isInteger(id) || id <= 0) abort("NOT_FOUND");
  const [t] = await tx.select().from(tickets).where(eq(tickets.id, id)).for("update");
  if (!t || !inScope(actor, t)) abort("NOT_FOUND");
  return t;
}

async function write(tx: Tx, actor: Actor, t: TicketRow, patch: Partial<typeof tickets.$inferInsert>, label: string, note: string) {
  const rows = await tx
    .update(tickets)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(tickets.id, t.id), eq(tickets.stage, t.stage)))
    .returning({ id: tickets.id });
  if (rows.length !== 1) abort("CONFLICT");
  await tx.insert(history).values({ ticketId: t.id, label, note, actorId: actor.id });
}

const expect = (cond: boolean) => {
  if (!cond) abort("CONFLICT");
};

export async function loadRules(db: Db | Tx): Promise<KeywordRules> {
  const rows = await db.select().from(keywords).orderBy(keywords.id);
  const rules = { ve_sinh: [], ky_thuat: [], bql: [] } as KeywordRules;
  for (const r of rows) rules[r.dept].push(r.word);
  return rules;
}

const isDept = (v: unknown): v is Dept => typeof v === "string" && (DEPT_ORDER as string[]).includes(v);

// ───────────────────────────── Cư dân ─────────────────────────────

export type SubmitInput = {
  description: string;
  place: string;
  placeDetail: string;
  urgent: boolean | null; // null = let the Agent decide
  photos: { name: string; data: Uint8Array }[];
};

export async function submitTicket(db: Db, actor: Actor, input: SubmitInput) {
  return run(db, async (tx) => {
    need(actor, "submit_ticket");
    const description = (input.description ?? "").trim();
    if (description.length < MIN_DESCRIPTION) abort("INVALID_INPUT", "Vui lòng mô tả vấn đề (ít nhất 10 ký tự).");
    if (description.length > 2000) abort("INVALID_INPUT", "Mô tả quá dài (tối đa 2000 ký tự).");
    if (!(PLACES as readonly string[]).includes(input.place)) abort("INVALID_INPUT", "Vị trí không hợp lệ.");
    const place = input.place as Place;
    const placeDetail = input.placeDetail ?? "";
    if (placeDetail && !PLACE_DEFS[place].opts.includes(placeDetail)) abort("INVALID_INPUT", "Chi tiết vị trí không hợp lệ.");
    if (input.photos.length > MAX_PHOTOS) abort("INVALID_INPUT", `Tối đa ${MAX_PHOTOS} ảnh.`);
    const files = input.photos.map((p) => {
      if (p.data.byteLength > MAX_PHOTO_BYTES) abort("INVALID_INPUT", `Ảnh "${p.name}" lớn hơn 5 MB.`);
      const mime = sniffImage(p.data);
      if (!mime) abort("INVALID_INPUT", `Ảnh "${p.name}" không phải JPG, PNG hoặc WEBP.`);
      return { name: p.name.slice(0, 200) || "anh", mime: mime as string, data: Buffer.from(p.data) };
    });

    const home = { tower: actor.tower ?? "", floor: actor.floor ?? "", apartment: actor.apartment ?? "" };
    const ai = classify(description, await loadRules(tx), home);
    const urgent = input.urgent ?? ai.urgent;
    const location = ai.locationFromText ? `${ai.locationFromText} (theo mô tả)` : placeLocation(place, placeDetail, home);

    const [t] = await tx
      .insert(tickets)
      .values({
        residentId: actor.id,
        description,
        location,
        place,
        placeDetail: placeDetail || null,
        urgent,
        aiDept: ai.dept,
        aiConfidence: ai.confidence,
        aiKeywords: ai.keywords,
      })
      .returning({ id: tickets.id, createdAt: tickets.createdAt });
    if (files.length) await tx.insert(photos).values(files.map((f) => ({ ...f, ticketId: t.id, size: f.data.byteLength })));
    const suggest = ai.dept ? `${DEPT_LABEL[ai.dept]} (${ai.confidence}%)` : "Ban tiếp nhận xem xét";
    await tx.insert(history).values([
      { ticketId: t.id, label: "Đã gửi", note: "Bạn gửi phản ánh.", actorId: actor.id, createdAt: t.createdAt },
      {
        ticketId: t.id,
        label: "Tiếp nhận",
        note: `Agent gợi ý ${suggest}${urgent ? ", khẩn cấp" : ""}${files.length ? ` · kèm ${files.length} ảnh` : ""}.`,
        actorId: actor.id,
        createdAt: t.createdAt,
      },
    ]);
    return { id: t.id, code: ticketCode(t.id), dept: ai.dept, urgent };
  });
}

export async function cancelTicket(db: Db, actor: Actor, id: number) {
  return run(db, async (tx) => {
    need(actor, "submit_ticket");
    const t = await lock(tx, actor, id);
    expect(!t.cancelled && t.stage <= 2);
    await write(tx, actor, t, { cancelled: true, paused: false }, "Đã hủy", "Bạn hủy phản ánh.");
    return null;
  });
}

export async function addExtra(db: Db, actor: Actor, id: number, text: string) {
  return run(db, async (tx) => {
    need(actor, "submit_ticket");
    const txt = (text ?? "").trim();
    if (!txt) abort("INVALID_INPUT", "Vui lòng nhập nội dung bổ sung.");
    if (txt.length > 500) abort("INVALID_INPUT", "Nội dung bổ sung tối đa 500 ký tự.");
    const t = await lock(tx, actor, id);
    expect(!t.cancelled && t.stage < 6);
    await write(tx, actor, t, { extras: [...t.extras, txt], needInfo: false }, "Bạn bổ sung thông tin", txt);
    return null;
  });
}

export async function acceptTicket(db: Db, actor: Actor, id: number) {
  return run(db, async (tx) => {
    need(actor, "submit_ticket");
    const t = await lock(tx, actor, id);
    expect(!t.cancelled && t.stage === 5);
    await write(tx, actor, t, { stage: 6 }, "Hoàn tất", "Bạn xác nhận đã xử lý xong.");
    return null;
  });
}

export async function rejectTicket(db: Db, actor: Actor, id: number) {
  return run(db, async (tx) => {
    need(actor, "submit_ticket");
    const t = await lock(tx, actor, id);
    expect(!t.cancelled && t.stage === 5);
    await write(
      tx,
      actor,
      t,
      { stage: 4, doneAt: null },
      "Yêu cầu làm lại",
      "Bạn báo kết quả chưa đạt, ticket quay lại bước Đang xử lý.",
    );
    return null;
  });
}

export async function rateTicket(db: Db, actor: Actor, id: number, input: { stars: number; tags: string[]; comment: string }) {
  return run(db, async (tx) => {
    need(actor, "submit_ticket");
    const stars = input.stars;
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) abort("INVALID_INPUT", "Vui lòng chọn số sao.");
    const allowed = stars >= 4 ? GOOD_TAGS : BAD_TAGS;
    const tags = [...new Set(input.tags ?? [])];
    if (tags.some((g) => !allowed.includes(g))) abort("INVALID_INPUT", "Nhận xét nhanh không hợp lệ.");
    const comment = (input.comment ?? "").trim();
    if (comment.length > 500) abort("INVALID_INPUT", "Nhận xét tối đa 500 ký tự.");
    const t = await lock(tx, actor, id);
    expect(!t.cancelled && t.stage === 6);
    const [existing] = await tx.select({ id: ratings.ticketId }).from(ratings).where(eq(ratings.ticketId, t.id));
    expect(!existing);
    await tx.insert(ratings).values({ ticketId: t.id, stars, tags, comment });
    await write(
      tx,
      actor,
      t,
      {},
      `Bạn đánh giá ${stars} sao`,
      STAR_LABEL[stars] + (stars < 3 ? " · đã chuyển Ban quản lý xem xét." : "."),
    );
    return null;
  });
}

/** Agent view of a ticket for duplicate matching: live suggestion while new, routed department afterwards */
function dupView(t: TicketRow, rules: KeywordRules): DupTicket {
  const ai = t.stage === 1 ? classify(t.description, rules, { tower: "", floor: "" }) : null;
  return {
    id: t.id,
    dept: ai ? ai.dept : (t.dept ?? t.aiDept),
    keywords: ai ? ai.keywords : t.aiKeywords,
    location: t.location,
    createdAt: t.createdAt,
    stage: t.stage,
    cancelled: t.cancelled,
  };
}

/** Older open tickets the Agent proposes as duplicates of `t` (plan 06 Q13); reception only approves or rejects */
export async function duplicatesFor(db: Db | Tx, t: TicketRow, rules?: KeywordRules): Promise<DupMatch[]> {
  const r = rules ?? (await loadRules(db));
  const since = new Date(t.createdAt.getTime() - DUP_WINDOW_HOURS * 3_600_000);
  const others = await db
    .select()
    .from(tickets)
    .where(
      and(
        ne(tickets.id, t.id),
        eq(tickets.cancelled, false),
        lte(tickets.stage, 4),
        lt(tickets.createdAt, t.createdAt),
        gt(tickets.createdAt, since),
      ),
    );
  return findDuplicates(dupView(t, r), others.map((o) => dupView(o, r)), t.dupDismissed);
}

// ───────────────────────────── Ban tiếp nhận ─────────────────────────────

export async function routeTicket(db: Db, actor: Actor, id: number, dept: string) {
  return run(db, async (tx) => {
    need(actor, "route_ticket");
    if (!isDept(dept)) abort("INVALID_INPUT", "Phòng ban không hợp lệ.");
    const t = await lock(tx, actor, id);
    expect(!t.cancelled && t.stage === 1);
    const ai = classify(t.description, await loadRules(tx), { tower: "", floor: "" });
    await write(
      tx,
      actor,
      t,
      { stage: 2, dept: dept as Dept, needInfo: false, aiDept: ai.dept, aiConfidence: ai.confidence, aiKeywords: ai.keywords },
      "Thẩm định",
      `Ban tiếp nhận xác nhận, chuyển ${DEPT_LABEL[dept as Dept]}.`,
    );
    return null;
  });
}

export async function setUrgent(db: Db, actor: Actor, id: number, urgent: boolean) {
  return run(db, async (tx) => {
    need(actor, "route_ticket", "reception");
    const t = await lock(tx, actor, id);
    expect(!t.cancelled && t.stage === 1 && t.urgent !== urgent);
    await write(
      tx,
      actor,
      t,
      { urgent },
      "Cập nhật mức độ",
      urgent ? "Ban tiếp nhận đánh dấu khẩn cấp · xử lý trong 4 giờ." : "Ban tiếp nhận bỏ đánh dấu khẩn cấp.",
    );
    return null;
  });
}

export async function askMoreInfo(db: Db, actor: Actor, id: number) {
  return run(db, async (tx) => {
    need(actor, "route_ticket", "reception");
    const t = await lock(tx, actor, id);
    expect(!t.cancelled && t.stage === 1 && !t.needInfo);
    await write(
      tx,
      actor,
      t,
      { needInfo: true },
      "Yêu cầu bổ sung",
      "Ban tiếp nhận cần thêm thông tin, vui lòng bổ sung chi tiết.",
    );
    return null;
  });
}

export async function mergeTicket(db: Db, actor: Actor, sourceId: number, targetId: number) {
  return run(db, async (tx) => {
    need(actor, "route_ticket", "reception");
    if (sourceId === targetId) abort("INVALID_INPUT", "Không thể gộp ticket vào chính nó.");
    // Lock in id order to avoid deadlocks between two merges
    const [a, b] = sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
    const first = await lock(tx, actor, a);
    const second = await lock(tx, actor, b);
    const src = first.id === sourceId ? first : second;
    const dst = first.id === targetId ? first : second;
    expect(!src.cancelled && src.stage === 1);
    expect(!dst.cancelled && dst.stage <= 4);
    // Reception only approves what the Agent proposed
    if (!(await duplicatesFor(tx, src)).some((m) => m.id === dst.id))
      abort("INVALID_INPUT", "Agent không đề xuất hai ticket này là trùng.");
    await write(
      tx,
      actor,
      src,
      { cancelled: true, mergedInto: dst.id },
      "Đã gộp",
      `Phản ánh trùng với ${ticketCode(dst.id)}, được theo dõi chung tại đó.`,
    );
    await write(
      tx,
      actor,
      dst,
      { extras: [...dst.extras, `[Gộp từ ${ticketCode(src.id)}] ${src.description}`], mergedFrom: [...dst.mergedFrom, src.id] },
      "Gộp phản ánh trùng",
      `Gộp ${ticketCode(src.id)} vào phản ánh này.`,
    );
    return null;
  });
}

export async function dismissDuplicate(db: Db, actor: Actor, id: number, otherId: number) {
  return run(db, async (tx) => {
    need(actor, "route_ticket", "reception");
    const t = await lock(tx, actor, id);
    expect(!t.cancelled && t.stage === 1);
    if (!(await duplicatesFor(tx, t)).some((m) => m.id === otherId)) abort("CONFLICT");
    await write(
      tx,
      actor,
      t,
      { dupDismissed: [...t.dupDismissed, otherId] },
      "Xác nhận không trùng",
      `Ban tiếp nhận xác nhận phản ánh này khác với ${ticketCode(otherId)}.`,
    );
    return null;
  });
}

// ───────────────────────────── Phòng ban ─────────────────────────────

function ownDept(actor: Actor, t: TicketRow) {
  if (t.dept !== ROLE_DEPT[actor.role]) abort("NOT_FOUND");
}

export async function assignStaff(db: Db, actor: Actor, id: number, staffId: number) {
  return run(db, async (tx) => {
    need(actor, "assign_staff");
    const t = await lock(tx, actor, id);
    ownDept(actor, t);
    const [s] = await tx
      .select()
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.dept, ROLE_DEPT[actor.role]!)));
    if (!s) abort("INVALID_INPUT", "Nhân viên không thuộc phòng của bạn.");
    expect(!t.cancelled && t.stage === 2);
    await write(
      tx,
      actor,
      t,
      { stage: 4, assigneeId: s.id, paused: false, pausedUntil: null },
      "Phân công",
      `Giao ${s.name}${s.skill ? ` (${s.skill.toLowerCase()})` : ""}.`,
    );
    return null;
  });
}

export async function finishTicket(db: Db, actor: Actor, id: number) {
  return run(db, async (tx) => {
    need(actor, "update_progress");
    const t = await lock(tx, actor, id);
    ownDept(actor, t);
    expect(!t.cancelled && (t.stage === 3 || t.stage === 4));
    let who = DEPT_LABEL[t.dept!];
    if (t.assigneeId) {
      const [s] = await tx.select({ name: staff.name }).from(staff).where(eq(staff.id, t.assigneeId));
      if (s) who = s.name;
    }
    await write(
      tx,
      actor,
      t,
      { stage: 5, doneAt: new Date(), paused: false, pausedUntil: null },
      "Nghiệm thu",
      `${who} báo đã xử lý xong, chờ bạn xác nhận.`,
    );
    return null;
  });
}

export async function startTicket(db: Db, actor: Actor, id: number) {
  return run(db, async (tx) => {
    need(actor, "update_progress", "management");
    const t = await lock(tx, actor, id);
    if (t.dept !== "bql") abort("NOT_FOUND");
    expect(!t.cancelled && t.stage === 2);
    await write(tx, actor, t, { stage: 4, paused: false, pausedUntil: null }, "Phân công", "Ban quản lý nhận xử lý.");
    return null;
  });
}

export async function reassignTicket(db: Db, actor: Actor, id: number, dept: string) {
  return run(db, async (tx) => {
    need(actor, "update_progress", "management");
    if (dept !== "ve_sinh" && dept !== "ky_thuat") abort("INVALID_INPUT", "Chỉ chuyển được cho Phòng vệ sinh hoặc Phòng kỹ thuật.");
    const t = await lock(tx, actor, id);
    if (t.dept !== "bql") abort("NOT_FOUND");
    expect(!t.cancelled && t.stage >= 2 && t.stage <= 4);
    await write(
      tx,
      actor,
      t,
      { stage: 2, dept: dept as Dept, assigneeId: null, paused: false, pausedUntil: null },
      "Chuyển phòng ban",
      `Ban quản lý chuyển ${DEPT_LABEL[dept as Dept]} xử lý.`,
    );
    return null;
  });
}

export async function requestMaterial(db: Db, actor: Actor, id: number, item: string) {
  return run(db, async (tx) => {
    need(actor, "assign_staff", "technical");
    const name = (item ?? "").trim();
    if (!name || name.length > 120) abort("INVALID_INPUT", "Tên vật tư dài 1–120 ký tự.");
    const t = await lock(tx, actor, id);
    ownDept(actor, t);
    expect(!t.cancelled && (t.stage === 3 || t.stage === 4));
    await tx.insert(materials).values({ ticketId: t.id, item: name, requestedBy: actor.id, staffId: t.assigneeId });
    await write(tx, actor, t, {}, "Yêu cầu vật tư", `${name} · đang chờ cấp.`);
    return null;
  });
}

export async function receiveMaterial(db: Db, actor: Actor, materialId: number) {
  return run(db, async (tx) => {
    need(actor, "assign_staff", "technical");
    const [m] = await tx
      .select({ id: materials.id, received: materials.received, dept: tickets.dept })
      .from(materials)
      .innerJoin(tickets, eq(tickets.id, materials.ticketId))
      .where(eq(materials.id, materialId))
      .for("update", { of: materials });
    if (!m || m.dept !== "ky_thuat") abort("NOT_FOUND");
    expect(!m.received);
    await tx.update(materials).set({ received: true }).where(eq(materials.id, materialId));
    return null;
  });
}

/** Photo access check for GET /api/photos/[id] */
export async function photoFor(db: Db, actor: Actor, photoId: number) {
  if (!Number.isInteger(photoId) || photoId <= 0) return null;
  const [row] = await db
    .select({ mime: photos.mime, data: photos.data, residentId: tickets.residentId, dept: tickets.dept, cancelled: tickets.cancelled })
    .from(photos)
    .innerJoin(tickets, eq(tickets.id, photos.ticketId))
    .where(eq(photos.id, photoId));
  if (!row || !inScope(actor, row)) return null;
  return { mime: row.mime, data: row.data };
}

