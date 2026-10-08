import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const ROLES = ["resident", "reception", "management", "cleaning", "technical", "warehouse"] as const;
export const DEPTS = ["ve_sinh", "ky_thuat", "bql"] as const;
export const PLACES = ["floor", "lobby", "lift", "common"] as const;

export const roleEnum = pgEnum("role", ROLES);
export const deptEnum = pgEnum("dept", DEPTS);
export const placeEnum = pgEnum("place", PLACES);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  tower: text("tower"),
  floor: text("floor"),
  apartment: text("apartment"),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const staff = pgTable(
  "staff",
  {
    id: serial("id").primaryKey(),
    dept: deptEnum("dept").notNull(),
    name: text("name").notNull(),
    skill: text("skill"),
    area: text("area"),
    capacity: integer("capacity"),
  },
  (t) => [unique("staff_dept_name_uq").on(t.dept, t.name)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    residentId: integer("resident_id")
      .notNull()
      .references(() => users.id),
    description: text("description").notNull(),
    location: text("location").notNull(),
    place: placeEnum("place").notNull(),
    placeDetail: text("place_detail"),
    urgent: boolean("urgent").notNull().default(false),
    aiDept: deptEnum("ai_dept"),
    aiConfidence: integer("ai_confidence").notNull().default(0),
    aiKeywords: text("ai_keywords").array().notNull().default(sql`'{}'::text[]`),
    dept: deptEnum("dept"),
    assigneeId: integer("assignee_id").references(() => staff.id),
    stage: smallint("stage").notNull().default(1),
    needInfo: boolean("need_info").notNull().default(false),
    paused: boolean("paused").notNull().default(false),
    pausedUntil: timestamp("paused_until", { withTimezone: true }),
    cancelled: boolean("cancelled").notNull().default(false),
    mergedInto: integer("merged_into").references((): AnyPgColumn => tickets.id),
    mergedFrom: integer("merged_from").array().notNull().default(sql`'{}'::integer[]`),
    extras: text("extras").array().notNull().default(sql`'{}'::text[]`),
    // Tickets reception confirmed are NOT duplicates of this one (Agent stops proposing them)
    dupDismissed: integer("dup_dismissed").array().notNull().default(sql`'{}'::integer[]`),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("tickets_stage_ck", sql`${t.stage} between 1 and 6`),
    index("tickets_resident_idx").on(t.residentId),
    index("tickets_dept_stage_idx").on(t.dept, t.stage),
    index("tickets_stage_idx").on(t.stage),
  ],
);

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

export const history = pgTable(
  "history",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    note: text("note").notNull().default(""),
    actorId: integer("actor_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("history_ticket_idx").on(t.ticketId)],
);

export const ratings = pgTable(
  "ratings",
  {
    ticketId: integer("ticket_id")
      .primaryKey()
      .references(() => tickets.id, { onDelete: "cascade" }),
    stars: smallint("stars").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    comment: text("comment").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [check("ratings_stars_ck", sql`${t.stars} between 1 and 5`)],
);

export const keywords = pgTable(
  "keywords",
  {
    id: serial("id").primaryKey(),
    dept: deptEnum("dept").notNull(),
    word: text("word").notNull(),
  },
  (t) => [unique("keywords_dept_word_uq").on(t.dept, t.word)],
);

export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  item: text("item").notNull(),
  requestedBy: integer("requested_by")
    .notNull()
    .references(() => users.id),
  staffId: integer("staff_id").references(() => staff.id),
  received: boolean("received").notNull().default(false),
  createdAt: createdAt(),
});

export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export const warehouseStock = pgTable("warehouse_stock", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull().default("cái"),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5),
  location: text("location").notNull().default("Kho trung tâm"),
  createdAt: createdAt(),
});

export type Role = (typeof ROLES)[number];
export type Dept = (typeof DEPTS)[number];
export type Place = (typeof PLACES)[number];
export type TicketRow = typeof tickets.$inferSelect;
