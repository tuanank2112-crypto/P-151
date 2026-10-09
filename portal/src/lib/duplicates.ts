/**
 * Agent duplicate detection (plan 06 Q13). The Agent proposes, reception only approves or rejects.
 * A pair is a candidate only when ALL hold: same suggested department, same place (tower + floor / lift / common spot),
 * at least one shared keyword, the older ticket is still open (not cancelled, stage ≤ 4) and within the time window.
 */
import type { Dept } from "./constants";

export type DupTicket = {
  id: number;
  dept: Dept | null; // Agent suggestion (live) for the inbox ticket, routed department otherwise
  keywords: string[];
  location: string;
  createdAt: Date;
  stage: number;
  cancelled: boolean;
};

export type DupMatch = { id: number; score: number; reasons: string[] };

export const DUP_WINDOW_HOURS = 7 * 24;
const HOUR = 3_600_000;

/** Where the problem is, comparable across tickets: "S2.05|12", "S2.05|lift", "Khu vực chung · Hầm xe" */
export function placeKey(location: string): string {
  const loc = location.replace(/\s*\(theo mô tả\)\s*/i, " ").trim();
  const tower = loc.match(/tòa\s+(s\d\.\d{2})/i)?.[1]?.toUpperCase();
  const floor = loc.match(/tầng\s+(b?\d{1,2})/i)?.[1]?.toUpperCase();
  if (tower && floor) return `${tower}|${floor}`;
  if (tower && /thang máy/i.test(loc)) return `${tower}|lift`;
  return loc.toLowerCase();
}

export function placeLabel(location: string): string {
  const key = placeKey(location);
  const [tower, floor] = key.split("|");
  if (!floor) return location.replace(/\s*\(theo mô tả\)/i, "");
  return floor === "lift" ? `Tòa ${tower} · thang máy` : `Tòa ${tower} · Tầng ${floor}`;
}

/** Candidates for `t`: older open tickets that look like the same problem, best first (max 3) */
export function findDuplicates(t: DupTicket, others: DupTicket[], dismissed: number[] = []): DupMatch[] {
  if (!t.dept || !t.keywords.length) return [];
  const key = placeKey(t.location);
  const mine = new Set(t.keywords);
  const out: DupMatch[] = [];
  for (const o of others) {
    if (o.id === t.id || o.cancelled || o.stage > 4 || dismissed.includes(o.id)) continue;
    if (o.createdAt.getTime() >= t.createdAt.getTime()) continue; // the newer ticket is the duplicate
    const gapH = (t.createdAt.getTime() - o.createdAt.getTime()) / HOUR;
    if (gapH > DUP_WINDOW_HOURS) continue;
    if (o.dept !== t.dept || placeKey(o.location) !== key) continue;
    const shared = o.keywords.filter((w) => mine.has(w));
    if (!shared.length) continue;
    const union = new Set([...t.keywords, ...o.keywords]).size;
    const score = Math.min(97, Math.round(55 + (35 * shared.length) / union + (gapH <= 24 ? 10 : 0)));
    out.push({
      id: o.id,
      score,
      reasons: [
        `Cùng vị trí: ${placeLabel(t.location)}`,
        `Cùng từ khóa: ${shared.join(", ")}`,
        gapH < 1 ? "Gửi cách nhau dưới 1 giờ" : `Gửi cách nhau ${Math.round(gapH)} giờ`,
      ],
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}
