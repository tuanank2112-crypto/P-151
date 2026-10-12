import { DEPT_ORDER, type Dept } from "./constants";

export type KeywordRules = Record<Dept, string[]>;

export type AgentResult = {
  dept: Dept | null;
  confidence: number;
  keywords: string[];
  urgent: boolean;
  locationFromText: string | null;
};

export const URGENT_WORDS = ["cháy", "khói", "chập", "kẹt", "ngập", "gas", "vỡ ống", "tràn", "có người bên trong"];

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whole-word match: a keyword must not touch other letters/digits, so "ồn" does not match "đồng"
 * and "ống" does not match "chống" (the design's plain indexOf did).
 */
export function hasWord(lowerText: string, word: string): boolean {
  const w = word.trim().toLowerCase();
  if (!w) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(w)}(?![\\p{L}\\p{N}])`, "u").test(lowerText);
}

// Order breaks ties: "đèn sảnh thang máy" is an electrical job
const SKILLS: [string, string[]][] = [
  ["Điện", ["điện", "đèn", "bóng", "chập", "ổ cắm", "aptomat", "điều hòa"]],
  ["Cấp thoát nước", ["nước", "rò", "rỉ", "vòi", "ống", "thấm", "tắc", "bồn", "cống"]],
  ["Thang máy", ["thang máy", "cửa thang", "kẹt"]],
];

/** Mentioned floor/tower that differs from the resident's home (Resident.dc.html textLoc) */
export function locationFromText(text: string, home: { tower: string; floor: string }): string | null {
  const mFloor = text.match(/tầng\s*(b?\d{1,2})/i);
  const mTower = text.match(/tòa\s*(s\d\.\d{2})/i);
  const floor = mFloor ? mFloor[1].toUpperCase() : null;
  const tower = mTower ? mTower[1].toUpperCase() : null;
  const otherFloor = floor !== null && floor !== home.floor.toUpperCase() && floor !== "1";
  const otherTower = tower !== null && tower !== home.tower.toUpperCase();
  if (!otherFloor && !otherTower) return null;
  return `Tòa ${tower ?? home.tower}${floor ? ` · Tầng ${floor}` : ""}`;
}

/**
 * Keyword classifier shared by the resident preview (client) and the server (source of truth).
 * Contract: planning/06_2026-10-07_resident-portal-next/specs/01-CONTRACTS.md §3
 */
export function classify(text: string, rules: KeywordRules, home: { tower: string; floor: string }): AgentResult {
  const s = (text || "").toLowerCase();
  let best: Dept | null = null;
  let bestCount = 0;
  let total = 0;
  const hits = {} as Record<Dept, string[]>;
  for (const d of DEPT_ORDER) {
    hits[d] = (rules[d] ?? []).filter((w) => hasWord(s, w));
    total += hits[d].length;
    if (hits[d].length > bestCount) {
      bestCount = hits[d].length;
      best = d;
    }
  }
  const urgent = URGENT_WORDS.some((w) => hasWord(s, w));
  const loc = locationFromText(text || "", home);
  if (!best || total === 0) return { dept: null, confidence: 0, keywords: [], urgent, locationFromText: loc };
  const confidence = Math.min(97, Math.round(48 + (38 * bestCount) / total + 5 * Math.min(bestCount, 3)));
  return { dept: best, confidence, keywords: hits[best], urgent, locationFromText: loc };
}

/** Suggested specialty for the technical department (Technical.dc.html "chuyên môn") */
export function techSkill(text: string): string | null {
  const s = text.toLowerCase();
  let best: string | null = null;
  let bestCount = 0;
  for (const [skill, words] of SKILLS) {
    const n = words.filter((w) => hasWord(s, w)).length;
    if (n > bestCount) {
      bestCount = n;
      best = skill;
    }
  }
  return best;
}
