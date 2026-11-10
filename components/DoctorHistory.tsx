'use client';

import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Doctor } from '@/types/doctor';

/* ── Rodapé da ficha: quem cadastrou, quem editou por último e o histórico de edições ── */

interface AuditRow {
  id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  actor_name: string | null;
  created_at: string;
  changes: Record<string, { de: unknown; para: unknown }> | null;
}

/** Campo técnico -> frase simples (campos do mesmo assunto viram uma frase só) */
const FIELD_PHRASES: Record<string, string> = {
  descricao: 'Mudou o nome',
  crm: 'Mudou o CRM',
  uf: 'Mudou a UF',
  especialidade: 'Mudou a especialidade',
  categoria: 'Mudou o tipo de local',
  complemento: 'Mudou o local',
  cidade: 'Mudou o endereço',
  bairro: 'Mudou o endereço',
  endereco: 'Mudou o endereço',
  numero: 'Mudou o endereço',
  telefone: 'Mudou o telefone',
  whatsapp_medico: 'Mudou o WhatsApp do médico',
  whatsapp_clinica: 'Mudou o WhatsApp da clínica',
  email: 'Mudou o email',
  map_link: 'Atualizou o GPS',
  latitude: 'Atualizou o GPS',
  longitude: 'Atualizou o GPS',
  agenda: 'Mudou os dias de atendimento',
  dias_semana: 'Mudou os dias de atendimento',
  turno: 'Mudou os dias de atendimento',
  observacoes: 'Mudou a observação',
  cycle_weeks: 'Mudou as semanas do ciclo',
};

const MAX_ROWS = 20;

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim().toLowerCase());
  return norm(a) === norm(b);
}

/** Frases simples do que mudou; ignora trocas que só mudam maiúscula/minúscula ou vazio → vazio */
function describe(row: AuditRow): string {
  if (row.action === 'INSERT') return 'Cadastro do médico';
  const phrases: string[] = [];
  for (const [k, c] of Object.entries(row.changes ?? {})) {
    if (sameValue(c?.de, c?.para)) continue;
    const phrase = FIELD_PHRASES[k];
    if (phrase && !phrases.includes(phrase)) phrases.push(phrase);
  }
  return phrases.length ? phrases.join(' · ') : 'Edição';
}

export default function DoctorHistory({ doc }: { doc: Doctor }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'unavailable'>('idle');

  const load = useCallback(async () => {
    setState('loading');
    const { data, error } = await supabase
      .from('doctor_audit_logs')
      .select('id, action, actor_name, created_at, changes')
      .eq('doctor_id', doc.id)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    if (error) {
      // 42P01 / PGRST205: tabela ainda não existe (migrations_v6 não rodou)
      const missing = error.code === '42P01' || error.code === 'PGRST205';
      setState(missing ? 'unavailable' : 'error');
      return;
    }
    setRows((data ?? []) as AuditRow[]);
    setState('idle');
  }, [doc.id]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && rows === null && state !== 'loading') void load();
  };

  const created =
    doc.created_via === 'APP_FIELD' && doc.created_by_name?.trim()
      ? `Cadastrado por ${doc.created_by_name.trim()}${doc.created_at ? ` em ${fmtDateTime(doc.created_at)}` : ''}`
      : null;
  const edited =
    doc.updated_by_name?.trim() && doc.updated_at
      ? `Última edição por ${doc.updated_by_name.trim()} em ${fmtDateTime(doc.updated_at)}`
      : null;

  return (
    <div className="mt-1 flex flex-col gap-1 border-t border-slate-800 pt-3 text-xs text-slate-500">
      {created && <span>{created}</span>}
      {edited && <span>{edited}</span>}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="self-start border-0 bg-transparent p-0 py-1 text-xs font-semibold text-slate-400 underline-offset-2 hover:underline"
      >
        {open ? 'Ocultar histórico' : 'Ver histórico de edições'}
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {state === 'loading' && <span>Carregando…</span>}
          {state === 'unavailable' && <span>Histórico indisponível (atualização do banco pendente).</span>}
          {state === 'error' && (
            <span>
              Não foi possível carregar.{' '}
              <button type="button" onClick={() => void load()} className="border-0 bg-transparent p-0 text-xs font-semibold text-blue-400">
                Tentar de novo
              </button>
            </span>
          )}
          {state === 'idle' && rows && rows.length === 0 && <span>Nenhuma edição registrada.</span>}
          {state === 'idle' &&
            rows?.map((r) => (
              <div key={r.id} className="rounded-lg bg-slate-900 px-2.5 py-2">
                <div className="text-[11px] text-slate-400">
                  {r.actor_name || 'sistema'} · {fmtDateTime(r.created_at)}
                </div>
                <div className="break-words text-slate-300">{describe(r)}</div>
              </div>
            ))}
          {state === 'idle' && rows && rows.length === MAX_ROWS && <span>Mostrando as {MAX_ROWS} mais recentes.</span>}
        </div>
      )}
    </div>
  );
}
