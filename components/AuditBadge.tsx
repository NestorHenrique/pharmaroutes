import { timeAgo } from '@/utils';

interface AuditBadgeProps {
  updatedAt?: string | null;
  updatedByName?: string | null;
}

/** Badge translúcido laranja — "Atualizado por [Nome] há Xh" */
export default function AuditBadge({ updatedAt, updatedByName }: AuditBadgeProps) {
  if (!updatedAt || !updatedByName) return null;

  const ago = timeAgo(updatedAt);

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[10px] text-orange-700">
      Atualizado por <strong className="font-semibold">{updatedByName}</strong> {ago}
    </span>
  );
}
