import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Na Vez · fila da barbearia',
    short_name: 'Na Vez',
    description: 'Sua posição na fila e o aviso de quando for a sua vez.',
    start_url: '/',
    display: 'standalone',
    background_color: '#eef0f3',
    theme_color: '#121417',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
