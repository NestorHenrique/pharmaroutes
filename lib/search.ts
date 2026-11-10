/**
 * Busca de médicos: sem acento, várias palavras (todas precisam aparecer, em qualquer campo),
 * com filtro de onde procurar e com a indicação de onde achou.
 */

import type { Doctor } from '@/types/doctor';
import { normalizeText } from '@/utils';

export type SearchScope = 'tudo' | 'nome' | 'crm' | 'especialidade' | 'local' | 'contato';

export const SEARCH_SCOPES: { value: SearchScope; label: string }[] = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'nome', label: 'Nome' },
  { value: 'crm', label: 'CRM' },
  { value: 'especialidade', label: 'Especialidade' },
  { value: 'local', label: 'Local' },
  { value: 'contato', label: 'Contato' },
];

interface Field {
  scope: Exclude<SearchScope, 'tudo'>;
  /** rótulo mostrado em "achou em" */
  label: string;
  value: string;
  /** campo numérico: compara só os dígitos */
  digits?: boolean;
}

export interface SearchMatch {
  matched: boolean;
  /** primeiro campo (fora o nome) em que a busca bateu, ex.: "Bairro: Centro" */
  hint: string | null;
}

function fieldsOf(d: Doctor): Field[] {
  const f = (scope: Field['scope'], label: string, value: string | null | undefined, digits = false): Field => ({
    scope,
    label,
    value: (value ?? '').trim(),
    digits,
  });
  return [
    f('nome', 'Nome', d.descricao),
    f('crm', 'CRM', d.crm, true),
    f('crm', 'RQE', d.rqe, true),
    f('especialidade', 'Especialidade', d.especialidade),
    f('local', 'Bairro', d.bairro),
    f('local', 'Cidade', d.cidade),
    f('local', 'Endereço', [d.endereco, d.numero].filter(Boolean).join(' ')),
    f('local', 'Local', d.complemento),
    f('contato', 'Telefone', d.telefone, true),
    f('contato', 'WhatsApp médico', d.whatsapp_medico, true),
    f('contato', 'WhatsApp clínica', d.whatsapp_clinica, true),
    f('contato', 'E-mail', d.email),
    f('contato', 'Observação', d.observacoes),
  ].filter((x) => x.value);
}

/** Divide a busca em palavras já sem acento */
export function searchTokens(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

function digitsOf(s: string): string {
  return s.replace(/\D/g, '');
}

function tokenMatches(field: Field, token: string): boolean {
  if (normalizeText(field.value).includes(token)) return true;
  if (field.digits) {
    const tokenDigits = digitsOf(token);
    // só compara dígitos com pelo menos 3 números (evita "1" achar todo telefone)
    if (tokenDigits.length >= 3 && digitsOf(field.value).includes(tokenDigits)) return true;
  }
  return false;
}

export function matchDoctor(d: Doctor, query: string, scope: SearchScope = 'tudo'): SearchMatch {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return { matched: true, hint: null };

  const fields = fieldsOf(d).filter((fl) => scope === 'tudo' || fl.scope === scope);
  let hint: string | null = null;

  for (const token of tokens) {
    const hit = fields.filter((fl) => tokenMatches(fl, token));
    if (hit.length === 0) return { matched: false, hint: null };
    if (!hint) {
      // prefere um campo que não seja o nome para explicar por que o médico apareceu
      const other = hit.find((fl) => fl.scope !== 'nome');
      if (other && !hit.some((fl) => fl.scope === 'nome')) hint = `${other.label}: ${other.value}`;
    }
  }
  return { matched: true, hint };
}
