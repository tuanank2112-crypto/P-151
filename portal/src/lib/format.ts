const TZ = "Asia/Ho_Chi_Minh";

function parts(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute") };
}

/** "14:45 05/10/2026" (Resident.dc.html) */
export function fmtDateTime(d: Date): string {
  const p = parts(d);
  return `${p.hh}:${p.mm} ${p.d}/${p.m}/${p.y}`;
}

/** "09:12 hôm nay" · "Hôm qua 19:20" · "03/10 10:15" (staff dashboards) */
export function fmtRelative(d: Date, now: Date): string {
  const p = parts(d);
  const today = parts(now);
  const yesterday = parts(new Date(now.getTime() - 86_400_000));
  const sameDay = (a: typeof p, b: typeof p) => a.y === b.y && a.m === b.m && a.d === b.d;
  if (sameDay(p, today)) return `${p.hh}:${p.mm} hôm nay`;
  if (sameDay(p, yesterday)) return `Hôm qua ${p.hh}:${p.mm}`;
  return `${p.d}/${p.m} ${p.hh}:${p.mm}`;
}

/** "Vừa xong" within a minute, otherwise the full date-time */
export function fmtHistory(d: Date, now: Date): string {
  return now.getTime() - d.getTime() < 60_000 ? "Vừa xong" : fmtDateTime(d);
}

export function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[w.length - 2][0] + w[w.length - 1][0]).toUpperCase();
}
