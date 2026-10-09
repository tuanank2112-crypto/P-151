import type { PhotoRef } from "@/lib/dto";

export function PhotoStrip({ photos }: { photos: PhotoRef[] }) {
  return (
    <div className="thumbs">
      {photos.map((p) => (
        <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title={p.name}>
          {/* eslint-disable-next-line @next/next/no-img-element -- authorized photo route, no optimizer */}
          <img src={p.url} alt={p.name} loading="lazy" />
        </a>
      ))}
    </div>
  );
}
