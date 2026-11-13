import type { Doctor, DoctorLocation } from '@/types/doctor';
import { SHIFT_LABEL, dayLabel, getAgenda } from '@/utils';

const DAY_CODES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const DAY_FULL: Record<string, string> = {
  seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo',
};

/** Locais do médico. Sem `locais`, vale o endereço do cadastro (um local só: tudo igual a antes). */
export function getLocations(doc: Doctor): DoctorLocation[] {
  if (doc.locais && doc.locais.length > 0) return doc.locais;
  return [
    {
      id: 'principal',
      nome: doc.complemento || 'Consultório próprio',
      endereco: doc.endereco || '',
      numero: doc.numero || '',
      bairro: doc.bairro || '',
      cidade: doc.cidade || '',
      map_link: doc.map_link || '',
      agenda: getAgenda(doc),
      principal: true,
    },
  ];
}

/** Local de hoje: o que atende hoje; se nenhum atende, o primeiro. */
export function todayLocation(locs: readonly DoctorLocation[], date: Date = new Date()): DoctorLocation {
  const code = DAY_CODES[date.getDay()];
  return locs.find((l) => l.agenda.some((e) => e.day === code)) ?? locs[0];
}

/** Local do dia da rota: o que atende nesse dia ("ter", "qua"...); se nenhum atende (dia trocado pelo rep), o Local 1. */
export function locationForDay(locs: readonly DoctorLocation[], day: string): DoctorLocation {
  return locs.find((l) => l.agenda.some((e) => e.day === day)) ?? locs[0];
}

/** "Quinta · Tarde" (primeiro dia da agenda do local) */
export function locationWhen(loc: DoctorLocation): string {
  const e = loc.agenda[0];
  if (!e) return 'Sem dia definido';
  const extra = loc.agenda.length > 1 ? ` +${loc.agenda.length - 1}` : '';
  return `${DAY_FULL[e.day] ?? e.day} · ${SHIFT_LABEL[e.shift]}${extra}`;
}

/** "Seg manhã · Qua tarde" (resumo curto dos dias do local) */
export function agendaSummary(agenda: DoctorLocation['agenda']): string {
  if (agenda.length === 0) return 'Sem dia definido';
  return agenda.map((e) => `${dayLabel(e.day)} ${SHIFT_LABEL[e.shift].toLowerCase()}`).join(' · ');
}

/** "Av. Brasil, 120 · Centro" */
export function locationAddress(loc: DoctorLocation): string {
  const street = [loc.endereco, loc.numero].filter(Boolean).join(', ');
  return [street, loc.bairro].filter(Boolean).join(' · ') || 'Sem endereço';
}

/** Primeira palavra útil do nome do local: "Clínica Cajubá" → usada inteira se curta */
export function locationShort(loc: DoctorLocation): string {
  return loc.nome.replace(/^(cl[ií]nica|hospital|consult[oó]rio)\s+/i, '').trim() || loc.nome;
}

/** Agenda dos locais extras limpa (dias válidos, sem repetir dia) */
export function cleanAgenda(agenda: unknown): DoctorLocation['agenda'] {
  if (!Array.isArray(agenda)) return [];
  const seen = new Set<string>();
  const out: DoctorLocation['agenda'] = [];
  for (const e of agenda) {
    if (!e || typeof e.day !== 'string' || !DAY_CODES.includes(e.day) || seen.has(e.day)) continue;
    seen.add(e.day);
    out.push({ day: e.day, shift: e.shift });
  }
  return out;
}

/**
 * Agenda para o filtro de dia: dias do Local 1 mais os dos locais extras.
 * Assim o médico aparece na rota de quinta mesmo que quinta seja só do outro local.
 */
export function agendaAllLocations(doc: Doctor): DoctorLocation['agenda'] {
  const main = getAgenda(doc);
  const extras = (doc.locais ?? []).slice(1);
  if (extras.length === 0) return main;
  const have = new Set(main.map((e) => e.day));
  const add = extras.flatMap((l) => l.agenda).filter((e) => !have.has(e.day) && have.add(e.day));
  return [...main, ...add];
}

/** Link para abrir o local no mapa: o GPS fixo, ou a rota até o endereço */
export function locationMapsUrl(loc: DoctorLocation): string | null {
  const link = loc.map_link?.trim();
  if (link) return link;
  if (!loc.endereco) return null;
  const address = [[loc.endereco, loc.numero || 'SN'].join(', '), loc.bairro, loc.cidade].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
