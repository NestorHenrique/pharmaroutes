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

/* ── Turno por dia (agenda granular) ── */

export const OPCOES_SHIFT = [
  { value: 'MANHA', label: 'Manhã' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'INTEGRAL', label: 'Integral' },
  { value: 'NOITE', label: 'Noite' },
] as const;

/** Filtro de turno do topo da lista */
export const FILTROS_TURNO = [
  { value: 'MANHA', label: 'Manhã', emoji: '☀️' },
  { value: 'TARDE', label: 'Tarde', emoji: '🌤️' },
  { value: 'NOITE', label: 'Noite', emoji: '🌙' },
] as const;

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

/* ── Especialidades (siglas padronizadas) ──
 * A ordem importa: a primeira palavra-chave encontrada define a sigla.
 * Pediatria e Clínica Geral ficam no fim para "Cardiologia pediátrica" virar CAR.
 */
export const ESPECIALIDADES = [
  { code: 'CAR', label: 'Cardiologia',               keys: ['cardio'] },
  { code: 'ANG', label: 'Angiologia',                keys: ['angio', 'vascular'] },
  { code: 'END', label: 'Endocrinologia',            keys: ['endocrin'] },
  { code: 'GOB', label: 'Ginecologia e Obstetrícia', keys: ['ginec', 'obstet'] },
  { code: 'ORT', label: 'Ortopedia',                 keys: ['ortop', 'traumat'] },
  { code: 'NCR', label: 'Neurocirurgia',             keys: ['neurocir'] },
  { code: 'NEU', label: 'Neurologia',                keys: ['neurol'] },
  { code: 'DER', label: 'Dermatologia',              keys: ['dermat'] },
  { code: 'PSQ', label: 'Psiquiatria',               keys: ['psiqui'] },
  { code: 'URO', label: 'Urologia',                  keys: ['urolog'] },
  { code: 'GAS', label: 'Gastroenterologia',         keys: ['gastro'] },
  { code: 'PNE', label: 'Pneumologia',               keys: ['pneumo'] },
  { code: 'OFT', label: 'Oftalmologia',              keys: ['oftalm'] },
  { code: 'OTO', label: 'Otorrinolaringologia',      keys: ['otorrino'] },
  { code: 'REU', label: 'Reumatologia',              keys: ['reumat'] },
  { code: 'NEF', label: 'Nefrologia',                keys: ['nefro'] },
  { code: 'GER', label: 'Geriatria',                 keys: ['geriat'] },
  { code: 'ONC', label: 'Oncologia',                 keys: ['oncol'] },
  { code: 'CIR', label: 'Cirurgia Geral',            keys: ['cirurgia geral', 'cirurgiao geral'] },
  { code: 'PED', label: 'Pediatria',                 keys: ['pediat'] },
  { code: 'CLG', label: 'Clínica Geral',             keys: ['clinic', 'medicina geral', 'generalista', 'familia'] },
] as const;
