/* ── Navegação por dias ── */

export const TABS_NAVEGACAO = [
  { value: 'seg', label: 'SEG' },
  { value: 'ter', label: 'TER' },
  { value: 'qua', label: 'QUA' },
  { value: 'qui', label: 'QUI' },
  { value: 'sex', label: 'SEX' },
  { value: 'novos', label: 'NOVOS' },
] as const;

export const OPCOES_DIAS = [
  { value: 'seg', label: 'SEG' },
  { value: 'ter', label: 'TER' },
  { value: 'qua', label: 'QUA' },
  { value: 'qui', label: 'QUI' },
  { value: 'sex', label: 'SEX' },
] as const;

export const OPCOES_TURNO = ['Manhã', 'Tarde', 'Manhã e Tarde'] as const;

/* ── Categorias de local ── */

export const CATEGORIAS = [
  { value: 'consultorio', label: 'Consultório' },
  { value: 'psm',         label: 'PSM' },
  { value: 'samu',        label: 'SAMU' },
  { value: 'hospital',    label: 'Hospital' },
] as const;

/** Filtros rápidos para locais de plantão */
export const FILTROS_PLANTAO = [
  { value: 'psm',      label: 'PSM',        emoji: '🏥' },
  { value: 'samu',     label: 'SAMU',       emoji: '🚑' },
  { value: 'hospital', label: 'Hospitais',  emoji: '🏨' },
] as const;
