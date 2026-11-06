import { supabase } from '@/lib/supabase';
import { cityKey } from '@/utils';

/**
 * Web Push segmentado por cidade.
 * O representante escolhe uma cidade; quando alguém marca "Último Paciente" ou
 * "Rep. no Consultório" num médico dessa cidade, a Edge Function `notify-city`
 * envia o push para quem está inscrito nela. Não usa GPS.
 */

// Remove aspas, espaços e quebras de linha que às vezes vêm junto do .env
const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/\s+/g, '');

export type PushSupport = 'ok' | 'unsupported' | 'no-key' | 'denied';

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  if (!VAPID_PUBLIC_KEY) return 'no-key';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

/** Base64 URL-safe (chave VAPID) → Uint8Array */
export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Chave pública VAPID válida = 65 bytes começando com 0x04 (ponto P-256 não comprimido).
 * Retorna a chave convertida ou uma mensagem dizendo o que está errado.
 */
type VapidKey = ReturnType<typeof urlBase64ToUint8Array>;

function getApplicationServerKey(): { key: VapidKey } | { error: string } {
  let bytes: VapidKey;
  try {
    bytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  } catch {
    return { error: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY não é Base64 válido. Copie a chave de novo, sem aspas.' };
  }
  if (bytes.length !== 65 || bytes[0] !== 4) {
    return {
      error:
        `NEXT_PUBLIC_VAPID_PUBLIC_KEY inválida (${bytes.length} bytes, esperado 65). ` +
        'Use a Public Key (a mais longa, ~87 caracteres), não a Private Key.',
    };
  }
  return { key: bytes };
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/** Usa o service worker que já existir; senão registra /sw.js */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() === 'unsupported') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/** Cidade em que este aparelho está inscrito (ou null) */
export async function getPushCity(): Promise<string | null> {
  try {
    const sub = await currentSubscription();
    if (!sub) return null;
    const { data } = await supabase
      .from('push_subscriptions')
      .select('city')
      .eq('endpoint', sub.endpoint)
      .maybeSingle();
    return (data as { city: string } | null)?.city ?? null;
  } catch {
    return null;
  }
}

export async function subscribeToCity(
  userId: string,
  city: string,
): Promise<{ ok: boolean; message: string }> {
  const support = getPushSupport();
  if (support === 'unsupported') {
    return {
      ok: false,
      message: 'Este navegador não suporta notificações. No iPhone, instale o app na Tela de Início primeiro.',
    };
  }
  if (support === 'no-key') {
    return { ok: false, message: 'Chave VAPID não configurada (NEXT_PUBLIC_VAPID_PUBLIC_KEY).' };
  }
  if (!city.trim()) return { ok: false, message: 'Escolha uma cidade.' };

  const keyResult = getApplicationServerKey();
  if ('error' in keyResult) return { ok: false, message: keyResult.error };
  const applicationServerKey = keyResult.key;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, message: 'Permissão de notificação negada. Libere nas configurações do navegador.' };
  }

  try {
    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();

    // Inscrição antiga feita com outra chave VAPID: precisa cancelar antes de inscrever de novo
    if (sub && !sameKey(sub.options.applicationServerKey, applicationServerKey)) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
      sub = null;
    }

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const json = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        city: city.trim(),
        city_key: cityKey(city),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    if (error) return { ok: false, message: `Erro ao salvar inscrição: ${error.message}` };

    return { ok: true, message: `Notificações ativas para ${city.trim()}.` };
  } catch (err) {
    return { ok: false, message: `Não foi possível ativar: ${(err as Error).message}` };
  }
}

export async function unsubscribePush(): Promise<{ ok: boolean; message: string }> {
  try {
    const sub = await currentSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    return { ok: true, message: 'Notificações desativadas neste aparelho.' };
  } catch (err) {
    return { ok: false, message: `Erro ao desativar: ${(err as Error).message}` };
  }
}

/** Dispara o push para a cidade do médico (falha silenciosa: o status já foi salvo) */
export async function notifyCity(doctorId: string, statusType: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('notify-city', {
      body: { doctor_id: doctorId, status_type: statusType },
    });
    if (error) console.warn('Push não enviado:', error.message);
  } catch (err) {
    console.warn('Push não enviado:', (err as Error).message);
  }
}
