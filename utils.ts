// "seg, ter, qua" -> ['seg', 'ter', 'qua']  (fonte única para ler dias)
export const parseDays = (value?: string | null): string[] =>
  (value ?? '')
    .toLowerCase()
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

export const toggleDay = (current: string | undefined, day: string): string => {
  const set = new Set(parseDays(current));
  if (set.has(day)) set.delete(day);
  else set.add(day);
  return [...set].join(', ');
};

export const isRecentDoctor = (createdAt?: string): boolean => {
  if (!createdAt) return false;
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return false;
  return (Date.now() - createdDate.getTime()) / (1000 * 3600 * 24) <= 7;
};

// Trata DDD 55 (RS) e zero à esquerda corretamente.
export const buildWhatsAppUrl = (phone?: string): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 10) return null;
  const full = digits.length >= 12 && digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
};
