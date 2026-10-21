export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true">
      <div className="h-10 w-64 rounded-xl bg-border" />
      <div className="h-24 rounded-3xl bg-border/60" />
      <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 overflow-hidden lg:grid-flow-row lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-72 rounded-3xl bg-border/50" />
        ))}
      </div>
    </div>
  );
}
