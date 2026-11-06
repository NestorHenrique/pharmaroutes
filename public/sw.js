/* Service Worker — Rota Propagandista
 * Recebe Web Push (Último Paciente / Rep. no Consultório) e abre o app ao tocar.
 * Funciona no Android (Chrome) e no iPhone com o app instalado na Tela de Início (iOS 16.4+).
 */

const DEFAULT_TITLE = 'Rota Propagandista';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** Lê o payload em qualquer formato: JSON, texto puro ou vazio */
function parsePayload(event) {
  if (!event.data) return {};
  try {
    const data = event.data.json();
    return data && typeof data === 'object' ? data : { body: String(data) };
  } catch {
    try {
      return { body: event.data.text() };
    } catch {
      return {};
    }
  }
}

self.addEventListener('push', (event) => {
  const data = parsePayload(event);

  const options = {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    timestamp: Date.now(),
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  };
  if (data.icon) options.icon = data.icon;

  // O iOS cancela a inscrição se um push chegar sem mostrar notificação:
  // por isso sempre exibimos algo, mesmo com payload vazio.
  event.waitUntil(self.registration.showNotification(data.title || DEFAULT_TITLE, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
