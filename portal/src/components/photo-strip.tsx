export function PhotoStrip({ photos }: { photos: { id: number; name: string }[] }) {
  return (
    <div className="thumbs">
      {photos.map((p) => (
        <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer" title={p.name}>
          {/* eslint-disable-next-line @next/next/no-img-element -- authorized photo route, no optimizer */}
          <img src={`/api/photos/${p.id}`} alt={p.name} loading="lazy" />
        </a>
      ))}
    </div>
  );
}
