import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Autorise les tunnels HTTPS (VS Code « Ports », ngrok…) pour tester la caméra sur téléphone.
  server: { host: true, allowedHosts: true },
  preview: { host: true, allowedHosts: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/*.svg'],
      manifest: {
        name: 'Mieru — le pont Kizuna',
        short_name: 'Mieru',
        description: 'Ton compteur te parle. Aaddad le traduit.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#f3e9d4',
        theme_color: '#1d5c9e',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      }
    })
  ]
});
