export const TABS_NAVEGACAO = [
  { label: 'SEG', value: 'seg' },
  { label: 'TER', value: 'ter' },
  { label: 'QUA', value: 'qua' },
  { label: 'QUI', value: 'qui' },
  { label: 'SEX', value: 'sex' },
  { label: 'NOVOS', value: 'novos' },
];

export const OPCOES_DIAS = [
  { label: 'SEG', value: 'seg' },
  { label: 'TER', value: 'ter' },
  { label: 'QUA', value: 'qua' },
  { label: 'QUI', value: 'qui' },
  { label: 'SEX', value: 'sex' },
];

export const OPCOES_TURNO = ['Manhã', 'Tarde', 'Manhã e Tarde'];

export function isRecentDoctor(createdAt?: string) {
  if (!createdAt) return false;

  const createdDate = new Date(createdAt);
  const now = new Date();

  return (now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24) <= 7;
}

export function toggleDaySelection(
  currentDaysString = '',
  dayValue: string
) {
  const days = currentDaysString
    .toLowerCase()
    .split(',')
    .map((day) => day.trim())
    .filter(Boolean);

  const updatedDays = days.includes(dayValue)
    ? days.filter((day) => day !== dayValue)
    : [...days, dayValue];

  return updatedDays.join(', ');
}
