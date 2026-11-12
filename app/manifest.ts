import type { MetadataRoute } from 'next';

/**
 * Manifesto do app. `id`, `start_url`, `scope` e `name` NÃO devem mudar: é por eles que o aparelho
 * reconhece o app já instalado na Tela de Início. Trocar só os ícones não exige reinstalar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Rota Propagandista',
    short_name: 'Rota',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B0B12',
    theme_color: '#0B0B12',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
