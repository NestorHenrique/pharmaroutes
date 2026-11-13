/** Anel de progresso: visitados sobre o total. O número fica no meio. */
export default function ProgressRing({ value, total, size = 56, label }: { value: number; total: number; size?: number; label?: string }) {
  const stroke = size >= 80 ? 7 : 5;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <span
      role="img"
      aria-label={label ?? `${value} de ${total} visitados`}
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className={`relative font-bold tabular-nums text-slate-100 ${size >= 80 ? 'text-lg' : 'text-[13px]'}`}>
        {value}/{total}
      </span>
    </span>
  );
}
