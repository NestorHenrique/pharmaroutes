import { cleanWhatsApp, whatsAppError, WHATSAPP_EXAMPLE } from '@/utils';

interface Props {
  medico: string;
  clinica: string;
  onChange: (field: 'whatsapp_medico' | 'whatsapp_clinica', value: string) => void;
  inputCls: string;
}

/** Dois campos de WhatsApp com título acima e só aceitando DDD + 9 dígitos (11 no total). */
export default function WhatsAppFields({ medico, clinica, onChange, inputCls }: Props) {
  const errMedico = whatsAppError(medico);
  const errClinica = whatsAppError(clinica);

  const field = (label: string, name: 'whatsapp_medico' | 'whatsapp_clinica', value: string, error: string | null) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        maxLength={14}
        placeholder={WHATSAPP_EXAMPLE}
        value={value}
        onChange={(e) => onChange(name, cleanWhatsApp(e.target.value))}
        aria-invalid={error ? true : undefined}
        className={`${inputCls}${error ? ' border-red-500' : ''}`}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        {field('WhatsApp médico', 'whatsapp_medico', medico, errMedico)}
        {field('WhatsApp clínica', 'whatsapp_clinica', clinica, errClinica)}
      </div>
      {(errMedico || errClinica) && (
        <p className="m-0 text-xs text-red-400">{errMedico ?? errClinica}</p>
      )}
    </div>
  );
}
