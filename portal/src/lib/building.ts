export type Building = "S1" | "S2";

/** First building code found in the texts, in order; a sub-building ("S1.12") counts as its building (01-CONTRACTS §2) */
export function buildingOf(...texts: (string | null | undefined)[]): Building | null {
  for (const text of texts) {
    const m = /\bS([12])(?:\.\d{1,2})?\b/i.exec(text ?? "");
    if (m) return `S${m[1]}` as Building;
  }
  return null;
}
