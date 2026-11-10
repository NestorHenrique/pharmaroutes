// Mapeia a resposta de um provedor de consulta de CRM para { nome, especialidade, rqe }.
// Arquivo puro (sem imports) para poder ser testado fora do Deno.

export interface CrmData {
  nome: string;
  especialidade: string;
  rqe: string;
}

const NAME_KEYS = ['nome', 'name', 'nome_medico', 'nomeMedico', 'nome_completo', 'medico'];
const SPECIALTY_KEYS = ['especialidade', 'especialidades', 'specialty', 'specialties', 'area_atuacao'];
const RQE_KEYS = ['rqe', 'rqes', 'numero_rqe'];
/** onde provedores costumam embrulhar o registro */
const WRAPPER_KEYS = ['data', 'result', 'resultado', 'dados', 'items', 'medico', 'medicos'];
const TEXT_KEYS = ['especialidade', 'nome', 'descricao', 'name', 'rqe', 'numero'];

type Json = unknown;

function isObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Texto limpo de um valor: string, número, objeto com nome/descrição ou lista deles */
function asText(v: Json, joiner: string): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    const parts = v.map((x) => asText(x, joiner)).filter(Boolean);
    return joiner === ' / ' ? (parts[0] ?? '') : parts.join(joiner);
  }
  if (isObject(v)) {
    for (const k of TEXT_KEYS) {
      const t = asText(v[k], joiner);
      if (t) return t;
    }
  }
  return '';
}

function pick(obj: Record<string, Json>, keys: string[], joiner: string): string {
  for (const k of keys) {
    const t = asText(obj[k], joiner);
    if (t) return t;
  }
  return '';
}

/** Procura o registro do médico dentro da resposta (até 3 níveis) */
function findRecord(v: Json, depth = 0): Record<string, Json> | null {
  if (Array.isArray(v)) return v.length ? findRecord(v[0], depth) : null;
  if (!isObject(v)) return null;
  if (NAME_KEYS.some((k) => typeof v[k] === 'string' && (v[k] as string).trim())) return v;
  if (depth >= 3) return null;
  for (const k of WRAPPER_KEYS) {
    if (k in v) {
      const found = findRecord(v[k], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** Devolve os dados encontrados ou null se a resposta não tem nenhum médico */
export function mapCrmResponse(payload: Json): CrmData | null {
  const rec = findRecord(payload);
  if (!rec) return null;
  const data: CrmData = {
    nome: pick(rec, NAME_KEYS, ' '),
    // lista de especialidades: fica com a primeira (o app guarda uma por médico)
    especialidade: pick(rec, SPECIALTY_KEYS, ' / '),
    rqe: pick(rec, RQE_KEYS, ', '),
  };
  return data.nome || data.especialidade || data.rqe ? data : null;
}
