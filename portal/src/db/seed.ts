/**
 * Demo data merged from the six design files (SPEC-P01 §6). Times are relative to `now` so SLA/late states stay meaningful.
 * Seeds only when `users` is empty; `reset` truncates the app tables first (blocked in production by the CLI).
 */
import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { history, keywords, materials, notices, ratings, staff, tickets, users, warehouseStock, type Dept, type Place } from "./schema";
import { classify, type KeywordRules } from "@/lib/agent";
import { DEPT_LABEL, STOCK_CATALOG, placeLocation, type Home } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { hashPassword } from "@/server/password";

export const DEMO_PASSWORD = "123456";

export const SEED_KEYWORDS: KeywordRules = {
  ve_sinh: ["rác", "bẩn", "mùi", "hôi", "dọn", "lau", "vệ sinh", "gián", "chuột", "côn trùng", "muỗi", "nước đọng", "trơn", "thu gom"],
  ky_thuat: [
    "điện", "chập", "thang máy", "điều hòa", "đèn", "bóng", "rò", "rỉ", "vòi", "mất nước", "nước yếu", "ống", "tắc", "bồn",
    "cống", "cửa", "khóa", "ổ cắm", "aptomat", "thấm", "kẹt", "hỏng",
  ],
  bql: [
    "phí", "hóa đơn", "gửi xe", "thẻ", "ồn", "hàng xóm", "an ninh", "bảo vệ", "trộm", "người lạ", "camera", "karaoke", "khoan",
    "khiếu nại", "thủ tục", "đăng ký", "hợp đồng", "tiện ích",
  ],
};

type UserSeed = { username: string; name: string; role: "resident" | "reception" | "management" | "cleaning" | "technical" | "warehouse"; login: boolean; home?: Home };

const USERS: UserSeed[] = [
  { username: "cudan", name: "Nguyễn Minh Anh", role: "resident", login: true, home: { tower: "S2.05", floor: "12", apartment: "1208" } },
  { username: "tiepnhan", name: "Phạm Thu Trang", role: "reception", login: true },
  { username: "quanly", name: "Vũ Hoàng Long", role: "management", login: true },
  { username: "vesinh", name: "Ngô Thị Lan", role: "cleaning", login: true },
  { username: "kythuat", name: "Đặng Văn Hùng", role: "technical", login: true },
  { username: "kho", name: "Trần Minh Kho", role: "warehouse", login: true },
  { username: "tranquocbao", name: "Trần Quốc Bảo", role: "resident", login: false, home: { tower: "S2.05", floor: "9", apartment: "0903" } },
  { username: "lethuha", name: "Lê Thu Hà", role: "resident", login: false, home: { tower: "S1.03", floor: "22", apartment: "2210" } },
  { username: "hoangnam", name: "Hoàng Nam", role: "resident", login: false, home: { tower: "S1.01", floor: "7", apartment: "0705" } },
  { username: "phamgiahuy", name: "Phạm Gia Huy", role: "resident", login: false, home: { tower: "S1.03", floor: "5", apartment: "0507" } },
  { username: "domailinh", name: "Đỗ Mai Linh", role: "resident", login: false, home: { tower: "S1.01", floor: "9", apartment: "0910" } },
];

const STAFF: { dept: Dept; name: string; skill?: string; area?: string; capacity?: number }[] = [
  { dept: "ve_sinh", name: "Tổ A", area: "Tòa S1.01 – S1.03", capacity: 4 },
  { dept: "ve_sinh", name: "Tổ B", area: "Tòa S2.01 – S2.05", capacity: 4 },
  { dept: "ve_sinh", name: "Tổ C", area: "Sảnh, hầm, cảnh quan", capacity: 3 },
  { dept: "ky_thuat", name: "Kỹ thuật viên 1", skill: "Điện" },
  { dept: "ky_thuat", name: "Kỹ thuật viên 2", skill: "Cấp thoát nước" },
  { dept: "ky_thuat", name: "Kỹ thuật viên 3", skill: "Thang máy" },
  { dept: "ky_thuat", name: "Kỹ thuật viên 4", skill: "Điện" },
];

type TicketSeed = {
  key: string;
  by: string;
  text: string;
  place: Place;
  sub?: string;
  location?: string; // overrides the place-derived location
  ageH: number;
  urgent?: boolean;
  dept?: Dept;
  stage: number;
  staff?: string;
  doneAfterH?: number; // hours after creation the department reported done
  pausedForH?: number;
  needInfo?: boolean;
  cancelled?: boolean;
  mergedInto?: string;
  extras?: string[];
  rating?: { stars: number; tags: string[]; comment?: string };
  material?: { item: string; received: boolean };
};

const TICKETS: TicketSeed[] = [
  // Resident "cudan" (Resident.dc.html)
  { key: "rac12", by: "cudan", text: "Rác chưa được thu gom ở phòng rác tầng 12", place: "floor", sub: "Phòng rác", ageH: 220, dept: "ve_sinh", stage: 6, staff: "Tổ B", doneAfterH: 3 },
  { key: "ocam", by: "cudan", text: "Ổ cắm hành lang tầng 12 bị cháy đen", place: "floor", sub: "Hành lang", ageH: 410, urgent: true, dept: "ky_thuat", stage: 6, staff: "Kỹ thuật viên 4", doneAfterH: 2.5, rating: { stars: 5, tags: ["Xử lý nhanh", "Thái độ tốt"], comment: "Kỹ thuật viên đến sau 1 tiếng, thay ổ cắm gọn gàng." } },
  { key: "cauthang", by: "cudan", text: "Đèn cầu thang bộ bị cháy bóng", place: "floor", sub: "Cầu thang bộ", ageH: 140, dept: "ky_thuat", stage: 5, staff: "Kỹ thuật viên 1", doneAfterH: 16 },
  { key: "on", by: "cudan", text: "Căn hộ bên cạnh gây ồn sau 23h nhiều ngày liền", place: "floor", sub: "Hành lang", ageH: 10, dept: "bql", stage: 2 },
  { key: "voi", by: "cudan", text: "Vòi nước bồn rửa bị rò rỉ, nước thấm xuống sàn bếp", place: "floor", sub: "Trong căn hộ", ageH: 15, dept: "ky_thuat", stage: 4, staff: "Kỹ thuật viên 2", material: { item: "Vòi rửa, băng tan", received: true } },
  { key: "densanh", by: "cudan", text: "Sảnh thang máy tầng 12 có đèn hỏng", place: "floor", sub: "Hành lang", location: "Tòa S2.05 · Tầng 12 · Sảnh thang máy", ageH: 26, dept: "ky_thuat", stage: 4, staff: "Kỹ thuật viên 1", pausedForH: 18, material: { item: "Bóng đèn LED âm trần", received: false } },
  { key: "racday", by: "cudan", text: "Thùng rác tầng 12 đầy tràn, bốc mùi hôi từ tối qua chưa được thu gom", place: "floor", sub: "Phòng rác", ageH: 2, urgent: true, stage: 1 },
  // Other residents (Reception / Management / Cleaning / Technical samples)
  { key: "denchap", by: "phamgiahuy", text: "Đèn sảnh thang máy tầng 12 chập chờn rồi tắt hẳn", place: "lobby", location: "Tòa S2.05 · Tầng 12 (theo mô tả)", ageH: 25, stage: 1, cancelled: true, mergedInto: "densanh" },
  // Agent duplicate proposals (plan 06 Q13): a newer report of the same lift, and of an in-progress corridor job
  { key: "thang2", by: "cudan", text: "Thang máy số 2 dừng giữa chừng, cửa không mở, có người bên trong", place: "lift", sub: "Thang 2", ageH: 0.5, urgent: true, stage: 1 },
  { key: "hanhlang5", by: "lethuha", text: "Hành lang tầng 5 tòa S1.03 có mùi hôi và nhiều gián", place: "floor", location: "Tòa S1.03 · Tầng 5 (theo mô tả)", ageH: 3.5, stage: 1 },
  { key: "kethang", by: "tranquocbao", text: "Thang máy số 2 bị kẹt giữa tầng 9 và tầng 10, có người bên trong", place: "lift", sub: "Thang 2", ageH: 1, urgent: true, stage: 1 },
  { key: "phixe", by: "lethuha", text: "Phí gửi xe ô tô tháng 10 tăng so với tháng trước, nhờ giải thích", place: "common", sub: "Hầm xe", ageH: 3, stage: 1 },
  { key: "cayxanh", by: "hoangnam", text: "Cây xanh khu vườn nội khu bị đổ sau mưa, chắn lối đi bộ", place: "common", sub: "Vườn nội khu", ageH: 4, stage: 1 },
  { key: "xedap", by: "phamgiahuy", text: "Khu để xe đạp dưới hầm có vấn đề, nhờ kiểm tra giúp", place: "common", sub: "Hầm xe", ageH: 6, stage: 1, needInfo: true },
  { key: "goi", by: "domailinh", text: "Nhờ kiểm tra giúp lịch sử dụng phòng sinh hoạt cộng đồng", place: "common", ageH: 30, stage: 1, cancelled: true },
  { key: "gian", by: "phamgiahuy", text: "Hành lang tầng 5 bẩn, xuất hiện nhiều gián gần phòng rác", place: "floor", sub: "Hành lang", ageH: 18, dept: "ve_sinh", stage: 4, staff: "Tổ A" },
  { key: "suoi", by: "hoangnam", text: "Khu vui chơi trẻ em có nhiều lá và rác sau mưa", place: "common", sub: "Sân chơi", ageH: 5, dept: "ve_sinh", stage: 2 },
  { key: "tham", by: "domailinh", text: "Nước từ trần nhà vệ sinh nhỏ giọt, nghi căn trên bị thấm", place: "floor", sub: "Trong căn hộ", ageH: 72, dept: "ky_thuat", stage: 4, staff: "Kỹ thuật viên 2", material: { item: "Keo chống thấm, ống thoát sàn", received: false } },
  { key: "matdien", by: "phamgiahuy", text: "Mất điện toàn bộ tầng 7, nghi chập tủ điện", place: "floor", sub: "Hành lang", location: "Tòa S1.01 · Tầng 7 (theo mô tả)", ageH: 5, urgent: true, dept: "ky_thuat", stage: 2 },
  { key: "thecu", by: "lethuha", text: "Đăng ký thẻ cư dân cho người thân mới chuyển đến", place: "common", location: "Văn phòng BQL", ageH: 96, dept: "bql", stage: 2 },
  { key: "nuocdong", by: "tranquocbao", text: "Sảnh tòa có nước đọng sau mưa, sàn trơn dễ ngã", place: "lobby", sub: "Sảnh chính", ageH: 120, dept: "ve_sinh", stage: 6, staff: "Tổ C", doneAfterH: 6, rating: { stars: 4, tags: ["Sạch sẽ, gọn gàng"] } },
  { key: "chuot", by: "domailinh", text: "Phòng rác tầng 8 có chuột", place: "floor", sub: "Phòng rác", location: "Tòa S2.05 · Tầng 8 (theo mô tả)", ageH: 170, dept: "ve_sinh", stage: 6, staff: "Tổ B", doneAfterH: 30, rating: { stars: 2, tags: ["Chưa triệt để"], comment: "Hai ngày sau vẫn còn thấy chuột ở phòng rác." } },
  { key: "hoadon", by: "lethuha", text: "Hóa đơn phí dịch vụ tính sai diện tích", place: "common", location: "Căn S1.03-2210", ageH: 200, dept: "bql", stage: 6, doneAfterH: 40, rating: { stars: 4, tags: ["Giải quyết triệt để"] } },
  { key: "den3", by: "hoangnam", text: "Đèn hành lang tầng 3 không sáng", place: "floor", sub: "Hành lang", location: "Tòa S1.01 · Tầng 3 (theo mô tả)", ageH: 60, dept: "ky_thuat", stage: 6, staff: "Kỹ thuật viên 1", doneAfterH: 20, rating: { stars: 5, tags: ["Xử lý nhanh"] }, material: { item: "Bóng đèn LED", received: true } },
];

const STAR_TEXT = ["", "Rất không hài lòng", "Không hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"];
const H = 3_600_000;

export async function seed(db: Db, opts: { reset?: boolean; now?: Date } = {}): Promise<"seeded" | "skipped"> {
  const now = opts.now ?? new Date();
  if (opts.reset) {
    await db.execute(
      sql`truncate table materials, ratings, history, photos, tickets, staff, keywords, notices, sessions, users, warehouse_stock restart identity cascade`,
    );
  }
  const [{ count }] = (await db.execute<{ count: number }>(sql`select count(*)::int as count from users`)).rows;
  if (count > 0) return "skipped";

  await db.transaction(async (tx) => {
    const pass = await hashPassword(DEMO_PASSWORD);
    const userRows = await tx
      .insert(users)
      .values(
        USERS.map((u) => ({
          username: u.username,
          name: u.name,
          role: u.role,
          passwordHash: u.login ? pass : "!",
          tower: u.home?.tower ?? null,
          floor: u.home?.floor ?? null,
          apartment: u.home?.apartment ?? null,
        })),
      )
      .returning();
    const userBy = new Map(userRows.map((u) => [u.username, u]));
    const staffRows = await tx.insert(staff).values(STAFF).returning();
    const staffBy = new Map(staffRows.map((s) => [s.name, s]));
    await tx.insert(keywords).values(
      (Object.keys(SEED_KEYWORDS) as Dept[]).flatMap((dept) => SEED_KEYWORDS[dept].map((word) => ({ dept, word }))),
    );
    const reception = userBy.get("tiepnhan")!;
    const deptActor: Record<Dept, number> = {
      ve_sinh: userBy.get("vesinh")!.id,
      ky_thuat: userBy.get("kythuat")!.id,
      bql: userBy.get("quanly")!.id,
    };

    const idBy = new Map<string, number>();
    // Oldest first so codes grow with time; merge targets are inserted before their sources
    const ordered = [...TICKETS].sort((a, b) => b.ageH - a.ageH);
    for (const s of ordered) {
      const owner = userBy.get(s.by)!;
      const home: Home = { tower: owner.tower!, floor: owner.floor!, apartment: owner.apartment! };
      const ai = classify(s.text, SEED_KEYWORDS, home);
      const createdAt = new Date(now.getTime() - s.ageH * H);
      const doneAt = s.doneAfterH !== undefined ? new Date(createdAt.getTime() + s.doneAfterH * H) : null;
      const assignee = s.staff ? staffBy.get(s.staff)! : null;
      const pausedUntil = s.pausedForH ? new Date(now.getTime() + s.pausedForH * H) : null;
      const [row] = await tx
        .insert(tickets)
        .values({
          residentId: owner.id,
          description: s.text,
          location: s.location ?? placeLocation(s.place, s.sub ?? "", home),
          place: s.place,
          placeDetail: s.sub ?? null,
          urgent: s.urgent ?? false,
          aiDept: ai.dept,
          aiConfidence: ai.confidence,
          aiKeywords: ai.keywords,
          dept: s.dept ?? null,
          assigneeId: assignee?.id ?? null,
          stage: s.stage,
          needInfo: s.needInfo ?? false,
          paused: !!pausedUntil,
          pausedUntil,
          cancelled: s.cancelled ?? false,
          extras: s.extras ?? [],
          doneAt,
          createdAt,
          updatedAt: now,
        })
        .returning({ id: tickets.id });
      idBy.set(s.key, row.id);

      // History, oldest first; inserted with explicit times
      const end = (doneAt ?? now).getTime();
      const at = (f: number) => new Date(createdAt.getTime() + (end - createdAt.getTime()) * f);
      const ev: { label: string; note: string; actorId: number; createdAt: Date }[] = [
        { label: "Đã gửi", note: "Bạn gửi phản ánh.", actorId: owner.id, createdAt },
        {
          label: "Tiếp nhận",
          note: `Agent gợi ý ${ai.dept ? `${DEPT_LABEL[ai.dept]} (${ai.confidence}%)` : "Ban tiếp nhận xem xét"}${s.urgent ? ", khẩn cấp" : ""}.`,
          actorId: owner.id,
          createdAt: new Date(createdAt.getTime() + 60_000),
        },
      ];
      if (s.needInfo)
        ev.push({ label: "Yêu cầu bổ sung", note: "Ban tiếp nhận cần thêm thông tin, vui lòng bổ sung chi tiết.", actorId: reception.id, createdAt: at(0.3) });
      if (s.stage >= 2 && s.dept)
        ev.push({ label: "Thẩm định", note: `Ban tiếp nhận xác nhận, chuyển ${DEPT_LABEL[s.dept]}.`, actorId: reception.id, createdAt: at(0.15) });
      if (s.stage >= 4 && s.dept)
        ev.push({
          label: "Phân công",
          note: assignee ? `Giao ${assignee.name}${assignee.skill ? ` (${assignee.skill.toLowerCase()})` : ""}.` : "Ban quản lý nhận xử lý.",
          actorId: deptActor[s.dept],
          createdAt: at(0.3),
        });
      if (s.material)
        ev.push({ label: "Yêu cầu vật tư", note: `${s.material.item} · đang chờ cấp.`, actorId: deptActor.ky_thuat, createdAt: at(0.4) });
      if (pausedUntil)
        ev.push({ label: "Tạm hoãn", note: `Đang chờ vật tư, dự kiến xử lý trước ${fmtDateTime(pausedUntil)}.`, actorId: deptActor[s.dept!], createdAt: at(0.5) });
      if (doneAt && s.dept)
        ev.push({ label: "Nghiệm thu", note: `${assignee?.name ?? DEPT_LABEL[s.dept]} báo đã xử lý xong, chờ bạn xác nhận.`, actorId: deptActor[s.dept], createdAt: doneAt });
      if (s.stage === 6 && doneAt)
        ev.push({ label: "Hoàn tất", note: "Bạn xác nhận đã xử lý xong.", actorId: owner.id, createdAt: new Date(doneAt.getTime() + 0.5 * H) });
      if (s.rating && doneAt)
        ev.push({
          label: `Bạn đánh giá ${s.rating.stars} sao`,
          note: STAR_TEXT[s.rating.stars] + (s.rating.stars < 3 ? " · đã chuyển Ban quản lý xem xét." : "."),
          actorId: owner.id,
          createdAt: new Date(doneAt.getTime() + 0.6 * H),
        });
      if (s.cancelled && !s.mergedInto)
        ev.push({ label: "Đã hủy", note: "Bạn hủy phản ánh.", actorId: owner.id, createdAt: at(0.05) });
      ev.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      await tx.insert(history).values(ev.map((e) => ({ ...e, ticketId: row.id })));

      if (s.rating)
        await tx.insert(ratings).values({
          ticketId: row.id,
          stars: s.rating.stars,
          tags: s.rating.tags,
          comment: s.rating.comment ?? "",
          createdAt: new Date(doneAt!.getTime() + 0.6 * H),
        });
      if (s.material)
        await tx.insert(materials).values({
          ticketId: row.id,
          item: s.material.item,
          requestedBy: deptActor.ky_thuat,
          staffId: assignee?.id ?? null,
          received: s.material.received,
          createdAt: at(0.4),
        });
    }

    // Merges: the source is cancelled, the target keeps the source text as an extra
    for (const s of TICKETS.filter((t) => t.mergedInto)) {
      const src = idBy.get(s.key)!;
      const dst = idBy.get(s.mergedInto!)!;
      const code = `PA-${String(src).padStart(4, "0")}`;
      const dstCode = `PA-${String(dst).padStart(4, "0")}`;
      const when = new Date(now.getTime() - (s.ageH - 0.5) * H);
      await tx.execute(sql`update tickets set merged_into = ${dst} where id = ${src}`);
      await tx.execute(
        sql`update tickets set merged_from = array_append(merged_from, ${src}), extras = array_append(extras, ${`[Gộp từ ${code}] ${s.text}`}) where id = ${dst}`,
      );
      await tx.insert(history).values([
        { ticketId: src, label: "Đã gộp", note: `Phản ánh trùng với ${dstCode}, được theo dõi chung tại đó.`, actorId: reception.id, createdAt: when },
        { ticketId: dst, label: "Gộp phản ánh trùng", note: `Gộp ${code} vào phản ánh này.`, actorId: reception.id, createdAt: when },
      ]);
    }

    const day = (d: number) => new Date(now.getTime() + d * 24 * H);
    const dmy = (d: Date) => fmtDateTime(d).slice(6);
    await tx.insert(warehouseStock).values(STOCK_CATALOG);

    await tx.insert(notices).values([
      {
        title: "Lịch bảo trì thang máy tòa S2.05",
        body: `Thang máy số 1 và số 2 tòa S2.05 bảo trì định kỳ từ 08:00 đến 11:00 ngày ${dmy(day(3))}. Trong thời gian này, cư dân vui lòng sử dụng thang số 3 và thang chở hàng.`,
        publishedAt: day(-1),
      },
      {
        title: "Tạm ngừng cấp nước để vệ sinh bể ngầm",
        body: `Nước sinh hoạt các tòa S1.01 – S1.03 tạm ngừng từ 22:00 ngày ${dmy(day(5))} đến 05:00 sáng hôm sau. Cư dân vui lòng chủ động trữ nước.`,
        publishedAt: day(-2),
      },
      {
        title: "Thu phí dịch vụ tháng 10",
        body: "Phí dịch vụ tháng 10 được thu từ ngày 01/10 đến hết ngày 15/10/2026. Cư dân có thể chuyển khoản theo mã căn hộ hoặc nộp tại văn phòng Ban quản lý.",
        publishedAt: day(-6),
      },
    ]);
  });
  return "seeded";
}
