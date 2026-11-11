import { WHATSAPP_DIGITS, WHATSAPP_EXAMPLE, whatsappError } from '@/utils';

interface WhatsAppFieldsProps {
  medico: string;
  clinica: string;
  onChange: (field: 'whatsapp_medico' | 'whatsapp_clinica', value: string) => void;
  /** mostra o erro mesmo sem o usuário ter mexido (ao tentar salvar) */
  showErrors?: boolean;
  /** classe das caixas (cada formulário tem a sua altura) */
  inputCls: string;
}

const FIELDS = [
  { key: 'whatsapp_medico', label: 'WhatsApp Médico' },
  { key: 'whatsapp_clinica', label: 'WhatsApp Clínica' },
] as const;

/**
 * Os dois WhatsApps com o título ACIMA da caixa e o exemplo como instrução.
 * Só aceita dígitos e no máximo 11 (DDD + número); com menos, avisa o que falta.
 */
export default function WhatsAppFields({ medico, clinica, onChange, showErrors = false, inputCls }: WhatsAppFieldsProps) {
  const values = { whatsapp_medico: medico, whatsapp_clinica: clinica };
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {FIELDS.map(({ key, label }) => {
        const value = values[key] ?? '';
        const digits = value.replace(/\D/g, '');
        // Enquanto digita, só reclama quando passa de 11; o "falta" aparece ao salvar
        const error = showErrors || digits.length > WHATSAPP_DIGITS ? whatsappError(value) : null;
        const id = `wa-${key}`;
        return (
          <label key={key} htmlFor={id} className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">{label}</span>
            <input
              id={id}
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder={WHATSAPP_EXAMPLE}
              maxLength={WHATSAPP_DIGITS}
              value={value}
              onChange={(e) => onChange(key, e.target.value.replace(/\D/g, '').slice(0, WHATSAPP_DIGITS))}
              aria-invalid={Boolean(error)}
              aria-describedby={`${id}-hint`}
              className={`${inputCls} tabular-nums ${error ? 'border-red-500' : ''}`}
            />
            <span id={`${id}-hint`} className={`text-[11px] leading-snug ${error ? 'text-red-400' : 'text-slate-500'}`}>
              {error ?? `DDD + número · ${digits.length}/${WHATSAPP_DIGITS}`}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Primeiro erro dos dois WhatsApps (para bloquear o Salvar).
 * Com `initial`, um número antigo que não foi mexido não trava a edição de outros campos.
 */
export function whatsappFormError(
  medico: string | null | undefined,
  clinica: string | null | undefined,
  initial?: { medico: string; clinica: string },
): string | null {
  const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
  const m = initial && digits(medico) === digits(initial.medico) ? null : whatsappError(medico);
  if (m) return `WhatsApp Médico: ${m}`;
  const c = initial && digits(clinica) === digits(initial.clinica) ? null : whatsappError(clinica);
  if (c) return `WhatsApp Clínica: ${c}`;
  return null;
}
