export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-wrap" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-line" />
      ))}
    </div>
  );
}
