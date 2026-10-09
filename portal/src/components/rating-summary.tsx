import { STAR_LABEL } from "@/lib/constants";
import type { DeptTicket, RatingDto } from "@/lib/dto";
import { IconStar } from "./icons";

/**
 * Resident rating as departments see it: stars, quick tags, comment — never who wrote it (plan 06 Q11).
 * Colors follow the "ĐÁNH GIÁ CỦA BẠN" block of Resident.dc.html.
 */
export function RatingSummary({ rating }: { rating: RatingDto }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line px-4 py-3">
      <span className="text-[11px] font-bold tracking-[.06em] text-muted">ĐÁNH GIÁ CỦA CƯ DÂN</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rstars" aria-label={`${rating.stars} trên 5 sao`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= rating.stars ? "on" : undefined}>
              <IconStar size={18} />
            </span>
          ))}
        </span>
        <span className="text-sm font-semibold">
          {rating.stars}/5 · {STAR_LABEL[rating.stars]}
        </span>
      </div>
      {rating.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rating.tags.map((g) => (
            <span key={g} className="pill ftag">
              {g}
            </span>
          ))}
        </div>
      )}
      {rating.comment && <p className="m-0 text-sm leading-[1.55] text-body">“{rating.comment}”</p>}
    </div>
  );
}

/** Completed department card: the resident's rating and feedback, or why there is none yet */
export function Feedback({ t }: { t: Pick<DeptTicket, "rating" | "stage"> }) {
  if (t.rating) return <RatingSummary rating={t.rating} />;
  return <span className="text-[13px] text-muted">{t.stage === 5 ? "Chờ cư dân nghiệm thu." : "Cư dân chưa đánh giá."}</span>;
}
