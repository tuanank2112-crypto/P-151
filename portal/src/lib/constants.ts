export type Role = "resident" | "reception" | "management" | "cleaning" | "technical" | "warehouse";
export type Dept = "ve_sinh" | "ky_thuat" | "bql";
export type Place = "floor" | "lobby" | "lift" | "common";

export const DEPT_ORDER: Dept[] = ["ve_sinh", "ky_thuat", "bql"];

export const DEPT_LABEL: Record<Dept, string> = {
  ve_sinh: "Phòng vệ sinh",
  ky_thuat: "Phòng kỹ thuật",
  bql: "Ban quản lý",
};

/** Bar colors of the management overview (Management.dc.html DEPTS[*][1]) */
export const DEPT_COLOR: Record<Dept, string> = {
  ve_sinh: "#0F8A7E",
  ky_thuat: "#C2571A",
  bql: "#5B4BA8",
};

export const ROLE_LABEL: Record<Role, string> = {
  resident: "Cư dân",
  reception: "Ban tiếp nhận thông tin",
  management: "Ban quản lý",
  cleaning: "Phòng vệ sinh",
  technical: "Phòng kỹ thuật",
  warehouse: "Thủ kho vật tư",
};

export const ROLE_HOME: Record<Role, string> = {
  resident: "/resident",
  reception: "/reception",
  management: "/management",
  cleaning: "/cleaning",
  technical: "/technical",
  warehouse: "/warehouse",
};

/** Department a staff role works for (dashboards of departments) */
export const ROLE_DEPT: Partial<Record<Role, Dept>> = {
  cleaning: "ve_sinh",
  technical: "ky_thuat",
  management: "bql",
};

export const STAGES = ["Tiếp nhận", "Thẩm định", "Phân công", "Đang xử lý", "Nghiệm thu", "Hoàn tất"] as const;

export const SLA_HOURS = { urgent: 4, normal: 48 } as const;

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MIN_DESCRIPTION = 10;

export const STAR_LABEL = ["", "Rất không hài lòng", "Không hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"];
export const GOOD_TAGS = ["Xử lý nhanh", "Sạch sẽ, gọn gàng", "Thái độ tốt", "Giải quyết triệt để"];
export const BAD_TAGS = ["Chậm trễ", "Chưa triệt để", "Thái độ chưa tốt", "Không báo trước"];

export type PlaceDef = { title: string; hint: (home: Home) => string; base: (home: Home) => string; opts: string[] };
export type Home = { tower: string; floor: string; apartment: string };

export const PLACE_ORDER: Place[] = ["floor", "lobby", "lift", "common"];

export const PLACE_DEFS: Record<Place, PlaceDef> = {
  floor: {
    title: "Tầng của tôi",
    hint: (h) => `Tầng ${h.floor}`,
    base: (h) => `Tòa ${h.tower} · Tầng ${h.floor}`,
    opts: ["Trong căn hộ", "Hành lang", "Phòng rác", "Cầu thang bộ"],
  },
  lobby: {
    title: "Sảnh cư dân",
    hint: () => "Tầng 1",
    base: (h) => `Tòa ${h.tower} · Sảnh cư dân tầng 1`,
    opts: ["Sảnh chính", "Khu hộp thư", "Lối vào"],
  },
  lift: {
    title: "Trong thang máy",
    hint: (h) => `Tòa ${h.tower}`,
    base: (h) => `Tòa ${h.tower} · Trong thang máy`,
    opts: ["Thang 1", "Thang 2", "Thang 3", "Thang chở hàng"],
  },
  common: {
    title: "Khu vực chung",
    hint: () => "Tiện ích nội khu",
    base: () => "Khu vực chung",
    opts: ["Hồ bơi", "Sân chơi", "Vườn nội khu", "Hầm xe", "Cổng ra vào"],
  },
};

/** Location string of a submitted ticket (Resident.dc.html baseLoc) */
export function placeLocation(place: Place, sub: string, home: Home): string {
  const P = PLACE_DEFS[place];
  if (!sub) return P.base(home);
  return `${P.base(home)} · ${sub === "Trong căn hộ" ? `Trong căn hộ ${home.apartment}` : sub}`;
}

export function ticketCode(id: number): string {
  return `PA-${String(id).padStart(4, "0")}`;
}

/** Shown under the portal name on the login page (Main.dc.html "[TÊN KHU ĐÔ THỊ]") */
export const SITE_NAME = "Khu đô thị Ocean Park";

// Danh mục vật tư mẫu: seed nạp vào kho (warehouse_stock), form yêu cầu vật tư của Kỹ thuật chọn từ cùng danh sách
export const STOCK_CATALOG: { code: string; name: string; category: string; unit: string; stock: number }[] = [
  { code: "VT-E01", name: "Aptomat tép MCB 1P 32A Schneider", category: "Điện", unit: "cái", stock: 12 },
  { code: "VT-E02", name: "Aptomat tổng MCCB 3P 63A Mitsubishi", category: "Điện", unit: "cái", stock: 3 },
  { code: "VT-E03", name: "Dây điện đôi Cadivi VCm 2x2.5mm²", category: "Điện", unit: "cuộn", stock: 8 },
  { code: "VT-E04", name: "Bóng đèn LED Tuýp T8 1.2m 18W Rạng Đông", category: "Chiếu sáng", unit: "bóng", stock: 40 },
  { code: "VT-E05", name: "Bóng đèn Downlight âm trần 9W Philip", category: "Chiếu sáng", unit: "bóng", stock: 4 },
  { code: "VT-N01", name: "Van khóa nước 1 chiều đồng MIHA D25", category: "Cấp thoát nước", unit: "cái", stock: 10 },
  { code: "VT-N02", name: "Van phao cơ ngắt nước thông minh D27", category: "Cấp thoát nước", unit: "cái", stock: 6 },
  { code: "VT-N03", name: "Ống nước Tiền Phong uPVC D27 C2", category: "Cấp thoát nước", unit: "cây", stock: 25 },
  { code: "VT-N04", name: "Băng tan cao cấp PTFE quấn ống nước", category: "Phụ kiện", unit: "cuộn", stock: 2 },
  { code: "VT-N05", name: "Keo dán ống PVC Tiền Phong 100g", category: "Phụ kiện", unit: "tuýp", stock: 15 },
];
