import { useEffect, useCallback, useRef } from 'react';
import { saveDraft, loadDraft, clearDraft } from '@/utils';

/**
 * Salva o estado de um formulário em localStorage automaticamente.
 *
 * Uso:
 *   const [form, setForm] = useState(initialState);
 *   const { clearSaved, restored } = useFormPersistence('add_doctor', form, setForm, initialState);
 *
 * - `restored`: true se havia rascunho salvo e ele foi restaurado.
 * - `clearSaved()`: chame após submit bem-sucedido ou cancelamento.
 */
export function useFormPersistence<T extends Record<string, unknown>>(
  key: string,
  form: T,
  setForm: (val: T | ((prev: T) => T)) => void,
  defaults: T,
) {
  const ready = useRef(false);
  const restoredRef = useRef(false);

  // Restaura na montagem
  useEffect(() => {
    if (ready.current) return;
    ready.current = true;
    const saved = loadDraft<T>(key);
    if (saved) {
      setForm({ ...defaults, ...saved });
      restoredRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save debounced (500 ms)
  useEffect(() => {
    if (!ready.current) return;
    const timer = setTimeout(() => saveDraft(key, form), 500);
    return () => clearTimeout(timer);
  }, [key, form]);

  const clearSaved = useCallback(() => clearDraft(key), [key]);

  return { clearSaved, restored: restoredRef.current };
}
