export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-24 rounded bg-line/70" />
      <div className="mt-3 h-7 w-40 rounded bg-line/70" />
      <div className="mt-2 h-4 w-64 rounded bg-line/50" />
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <div className="h-24 bg-surface" />
        <div className="h-24 bg-surface" />
        <div className="h-24 bg-surface" />
        <div className="h-24 bg-surface" />
      </div>
      <div className="mt-5 h-72 rounded-xl border border-line bg-surface" />
    </div>
  );
}
