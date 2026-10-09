/**
 * Read side of the dashboards. Each loader returns only what its role may see (SPEC-P01 §5);
 * pages call it right after requireUser(), so the actor is always the session user.
 */
import "server-only";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db as appDb } from "@/db";
import type { Db } from "@/db/client";
import { history, materials, notices, photos, ratings, staff, tickets, users, warehouseStock, type Dept } from "@/db/schema";
import { classify, techSkill } from "@/lib/agent";
import { PLACE_ORDER, ROLE_DEPT, ticketCode } from "@/lib/constants";
import type { DeptData, ManagementData, PhotoRef, ReceptionData, ResidentData, WarehouseData } from "@/lib/dto";
import { fmtDateTime, fmtHistory, fmtRelative, initials } from "@/lib/format";
import { ageHours, hoursLeft, isLate } from "@/lib/sla";
import type { SessionUser } from "./session";
import { duplicatesFor, loadRules } from "./workflow";

/** Avatar text of staff dashboards (design: TN, QL, VS, KT) */
const ROLE_AVATAR = { reception: "TN", management: "QL", cleaning: "VS", technical: "KT" } as const;

async function photosOf(db: Db, ids: number[], anonymous = false): Promise<Map<number, PhotoRef[]>> {
  const map = new Map<number, PhotoRef[]>();
  if (!ids.length) return map;
  const rows = await db
    .select({ id: photos.id, ticketId: photos.ticketId, name: photos.name })
    .from(photos)
    .where(inArray(photos.ticketId, ids))
    .orderBy(photos.id);
  for (const r of rows) {
    const list = map.get(r.ticketId) ?? [];
    // Departments never see the uploaded file name: it may carry the resident's name
    list.push({ id: r.id, name: anonymous ? `Ảnh ${list.length + 1}` : r.name });
    map.set(r.ticketId, list);
  }
  return map;
}

export async function residentData(user: SessionUser, db: Db = appDb): Promise<ResidentData> {
  const now = new Date();
  const rows = await db
    .select({ t: tickets, staffName: staff.name, rating: ratings })
    .from(tickets)
    .leftJoin(staff, eq(staff.id, tickets.assigneeId))
    .leftJoin(ratings, eq(ratings.ticketId, tickets.id))
    .where(eq(tickets.residentId, user.id))
    .orderBy(desc(tickets.createdAt));
  const ids = rows.map((r) => r.t.id);
  const hist = ids.length
    ? await db.select().from(history).where(inArray(history.ticketId, ids)).orderBy(desc(history.createdAt), desc(history.id))
    : [];
  const pics = await photosOf(db, ids);
  const noticeRows = await db.select().from(notices).orderBy(desc(notices.publishedAt));

  return {
    user: {
      name: user.name,
      avatar: initials(user.name),
      tower: user.tower ?? "",
      floor: user.floor ?? "",
      apartment: user.apartment ?? "",
    },
    tickets: rows.map(({ t, staffName, rating }) => ({
      id: t.id,
      code: ticketCode(t.id),
      title: t.description,
      location: t.location,
      sentAt: fmtDateTime(t.createdAt),
      stage: t.stage,
      paused: t.paused,
      pauseText: `Việc xử lý đang chậm hơn dự kiến (trước ${t.pausedUntil ? fmtDateTime(t.pausedUntil) : "—"}). Ban quản lý đang theo dõi và sẽ cập nhật mốc mới.`,
      cancelled: t.cancelled,
      mergedInto: t.mergedInto ? ticketCode(t.mergedInto) : null,
      needInfo: t.needInfo,
      dept: t.dept,
      staffName: staffName ?? null,
      urgent: t.urgent,
      rating: rating ? { stars: rating.stars, tags: rating.tags, comment: rating.comment } : null,
      extras: t.extras,
      history: hist
        .filter((h) => h.ticketId === t.id)
        .map((h) => ({ label: h.label, note: h.note, time: fmtHistory(h.createdAt, now) })),
      photos: pics.get(t.id) ?? [],
    })),
    notices: noticeRows.map((n) => ({ id: n.id, date: fmtDateTime(n.publishedAt).slice(6), title: n.title, body: n.body })),
    rules: await loadRules(db),
    places: PLACE_ORDER,
  };
}

/** Status of a duplicate candidate as reception reads it (01-CONTRACTS §2 wording) */
const STAGE_STATUS: Record<number, string> = { 1: "Chờ phân loại", 2: "Đã chuyển phòng ban", 3: "Đang xử lý", 4: "Đang xử lý" };

const residentLabel = (u: { name: string; tower: string | null; apartment: string | null }) =>
  u.tower && u.apartment ? `${u.name} · ${u.tower}-${u.apartment}` : u.name;

export async function receptionData(user: SessionUser, db: Db = appDb): Promise<ReceptionData> {
  const now = new Date();
  const rules = await loadRules(db);
  const rows = await db
    .select({ t: tickets, name: users.name, tower: users.tower, apartment: users.apartment })
    .from(tickets)
    .innerJoin(users, eq(users.id, tickets.residentId))
    .where(eq(tickets.cancelled, false))
    .orderBy(desc(tickets.createdAt));
  const pending = rows.filter((r) => r.t.stage === 1 && !r.t.needInfo);
  const byId = new Map(rows.map((r) => [r.t.id, r]));
  const pics = await photosOf(db, pending.map((r) => r.t.id));
  const routedTickets = rows.filter((r) => r.t.stage >= 2 || r.t.needInfo);
  const routedIds = routedTickets.map((r) => r.t.id);
  const routedHist = routedIds.length
    ? await db.select().from(history).where(inArray(history.ticketId, routedIds)).orderBy(desc(history.createdAt), desc(history.id))
    : [];
  const routedPhotoRows = routedIds.length
    ? await db.select().from(photos).where(inArray(photos.ticketId, routedIds)).orderBy(photos.id)
    : [];
  const staffRows = await db.select().from(staff);
  const staffMap = new Map(staffRows.map((s) => [s.id, s.name]));

  return {
    user: { name: user.name, avatar: ROLE_AVATAR.reception },
    inbox: await Promise.all(
      pending.map(async ({ t, ...u }) => {
        // Live suggestion with the current keyword rules
        const ai = classify(t.description, rules, { tower: u.tower ?? "", floor: "" });
        const dups = await duplicatesFor(db, t, rules);
        return {
          id: t.id,
          code: ticketCode(t.id),
          text: t.description,
          location: t.location,
          resident: residentLabel(u),
          createdAt: fmtRelative(t.createdAt, now),
          urgent: t.urgent,
          aiDept: ai.dept,
          conf: ai.confidence,
          keywords: ai.keywords,
          extras: t.extras,
          photos: pics.get(t.id) ?? [],
          duplicates: dups.map((m) => {
            const o = byId.get(m.id)!;
            return {
              id: m.id,
              code: ticketCode(m.id),
              text: o.t.description,
              location: o.t.location,
              resident: residentLabel(o),
              createdAt: fmtRelative(o.t.createdAt, now),
              status: STAGE_STATUS[o.t.stage] ?? "",
              score: m.score,
              reasons: m.reasons,
            };
          }),
        };
      }),
    ),
    routed: routedTickets.map(({ t }) => {
      const beforePhotos = routedPhotoRows
        .filter((p) => p.ticketId === t.id && !p.name.startsWith("after_"))
        .map((p) => ({ id: p.id, name: p.name }));
      const afterPhotos = routedPhotoRows
        .filter((p) => p.ticketId === t.id && p.name.startsWith("after_"))
        .map((p) => ({ id: p.id, name: p.name }));
      const ticketHist = routedHist
        .filter((h) => h.ticketId === t.id)
        .map((h) => ({ label: h.label, note: h.note, time: fmtHistory(h.createdAt, now) }));
      const disputed = t.extras.some((e) => e.includes("[Báo cần BQL xem]")) || t.paused;
      const disputeReason = t.extras.find((e) => e.includes("[Báo cần BQL xem]"))?.replace("[Báo cần BQL xem] ", "") ?? null;

      return {
        id: t.id,
        code: ticketCode(t.id),
        text: t.description,
        location: t.location,
        createdAt: fmtRelative(t.createdAt, now),
        dept: t.dept,
        aiDept: t.aiDept,
        conf: t.aiConfidence,
        stage: t.stage,
        cancelled: t.cancelled,
        urgent: t.urgent,
        staffName: t.assigneeId ? staffMap.get(t.assigneeId) ?? null : null,
        keywords: t.aiKeywords,
        skill: techSkill(t.description),
        extras: t.extras,
        history: ticketHist,
        beforePhotos,
        afterPhotos,
        disputed,
        disputeReason,
        needInfo: t.needInfo && t.stage === 1,
      };
    }),
  };
}

/**
 * Department queue. Must not reveal WHO sent a ticket (no name/account/resident id, anonymized photo names);
 * must show the resident's rating and feedback (stars, tags, comment) — user decision 2026-10-07 (plan 06 Q11).
 */
export async function deptData(user: SessionUser, db: Db = appDb): Promise<DeptData> {
  const dept = ROLE_DEPT[user.role] as Dept;
  const now = new Date();
  const rows = await db
    .select({ t: tickets, staffName: staff.name, rating: ratings })
    .from(tickets)
    .leftJoin(staff, eq(staff.id, tickets.assigneeId))
    .leftJoin(ratings, eq(ratings.ticketId, tickets.id))
    .where(and(eq(tickets.dept, dept), eq(tickets.cancelled, false), ne(tickets.stage, 1)))
    .orderBy(desc(tickets.createdAt));
  const ids = rows.map((r) => r.t.id);
  const pics = await photosOf(db, ids, true);
  const matRows = ids.length
    ? await db
        .select({ m: materials, staffName: staff.name })
        .from(materials)
        .leftJoin(staff, eq(staff.id, materials.staffId))
        .where(inArray(materials.ticketId, ids))
        .orderBy(desc(materials.createdAt))
    : [];
  const requested = new Set(matRows.map((r) => r.m.ticketId));
  return {
    user: { name: user.name, avatar: ROLE_AVATAR[user.role as "cleaning" | "technical"] },
    tickets: rows.map(({ t, staffName, rating }) => ({
      id: t.id,
      code: ticketCode(t.id),
      text: t.description,
      location: t.location,
      createdAt: fmtRelative(t.createdAt, now),
      urgent: t.urgent,
      stage: t.stage,
      paused: t.paused,
      keywords: t.aiKeywords,
      conf: t.aiConfidence,
      staffId: t.assigneeId,
      staffName: staffName ?? null,
      rating: rating ? { stars: rating.stars, tags: rating.tags, comment: rating.comment } : null,
      skill: techSkill(t.description),
      hoursLeft: hoursLeft(t, now),
      materialRequested: requested.has(t.id),
      extras: t.extras,
      photos: pics.get(t.id) ?? [],
    })),
    staff: await db
      .select({ id: staff.id, name: staff.name, skill: staff.skill, area: staff.area, capacity: staff.capacity })
      .from(staff)
      .where(eq(staff.dept, dept))
      .orderBy(staff.id),
    materials: matRows.map(({ m, staffName }) => ({
      id: m.id,
      item: m.item,
      ticketCode: ticketCode(m.ticketId),
      staffName: staffName ?? null,
      received: m.received,
    })),
  };
}

export async function managementData(user: SessionUser, db: Db = appDb): Promise<ManagementData> {
  const now = new Date();
  const rows = await db
    .select({ t: tickets, stars: ratings.stars, staffName: staff.name })
    .from(tickets)
    .leftJoin(staff, eq(staff.id, tickets.assigneeId))
    .leftJoin(ratings, eq(ratings.ticketId, tickets.id))
    .orderBy(desc(tickets.createdAt));
  const ids = rows.map((r) => r.t.id);
  const hist = ids.length
    ? await db.select().from(history).where(inArray(history.ticketId, ids)).orderBy(desc(history.createdAt), desc(history.id))
    : [];
  const photoRows = ids.length
    ? await db.select().from(photos).where(inArray(photos.ticketId, ids)).orderBy(photos.id)
    : [];

  return {
    user: { name: user.name, avatar: ROLE_AVATAR.management },
    tickets: rows.map(({ t, stars, staffName }) => {
      const beforePhotos = photoRows
        .filter((p) => p.ticketId === t.id && !p.name.startsWith("after_"))
        .map((p) => ({ id: p.id, name: p.name }));
      const afterPhotos = photoRows
        .filter((p) => p.ticketId === t.id && p.name.startsWith("after_"))
        .map((p) => ({ id: p.id, name: p.name }));
      const ticketHist = hist
        .filter((h) => h.ticketId === t.id)
        .map((h) => ({ label: h.label, note: h.note, time: fmtHistory(h.createdAt, now) }));
      const disputed = t.extras.some((e) => e.includes("[Báo cần BQL xem]")) || (t.paused && t.stage === 4);
      const disputeReason = t.extras.find((e) => e.includes("[Báo cần BQL xem]"))?.replace("[Báo cần BQL xem] ", "") ?? null;

      return {
        id: t.id,
        code: ticketCode(t.id),
        text: t.description,
        location: t.location,
        createdAt: fmtRelative(t.createdAt, now),
        dept: t.dept,
        aiDept: t.aiDept,
        conf: t.aiConfidence,
        stage: t.stage,
        cancelled: t.cancelled,
        urgent: t.urgent,
        staffName: staffName ?? null,
        keywords: t.aiKeywords,
        skill: techSkill(t.description),
        extras: t.extras,
        history: ticketHist,
        beforePhotos,
        afterPhotos,
        disputed,
        disputeReason,
        late: isLate(t, now),
        ageH: ageHours(t.createdAt, now),
        stars: stars ?? null,
        doneHours: t.doneAt ? (t.doneAt.getTime() - t.createdAt.getTime()) / 3_600_000 : null,
      };
    }),
  };
}

export async function warehouseData(user: SessionUser, db: Db = appDb): Promise<WarehouseData> {
  const stockRows = await db.select().from(warehouseStock).orderBy(warehouseStock.id);
  const reqRows = await db
    .select({
      m: materials,
      t: tickets,
      u: users,
      staffName: staff.name,
    })
    .from(materials)
    .innerJoin(tickets, eq(tickets.id, materials.ticketId))
    .innerJoin(users, eq(users.id, materials.requestedBy))
    .leftJoin(staff, eq(staff.id, materials.staffId))
    .orderBy(desc(materials.createdAt));

  return {
    user: { name: user.name, avatar: "TK" },
    inventory: stockRows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      category: s.category,
      unit: s.unit,
      stock: s.stock,
      minStock: s.minStock,
      location: s.location,
    })),
    requests: reqRows.map(({ m, t, u, staffName }) => ({
      id: m.id,
      ticketId: m.ticketId,
      ticketCode: ticketCode(m.ticketId),
      ticketDescription: t.description,
      item: m.item,
      requestedBy: u.name,
      staffName: staffName ?? null,
      createdAt: fmtDateTime(m.createdAt),
      received: m.received,
    })),
  };
}
