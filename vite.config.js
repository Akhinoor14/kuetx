import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import { VitePWA } from 'vite-plugin-pwa' // temporarily disabled to avoid install/peer-dep issues

export default defineConfig({
  plugins: [
    react(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],
    //   manifest: { /* ...original manifest omitted for brevity... */ },
    //   workbox: { /* ... */ },
    //   devOptions: { enabled: true },
    // }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const normalizedId = id.split(path.win32.sep).join('/');
          if (normalizedId.includes('/node_modules/recharts/')) return 'vendor-recharts';
          if (normalizedId.includes('/node_modules/lucide-react/')) return 'vendor-lucide';
          return 'vendor';
        }
      }
    },
    chunkSizeWarningLimit: 2000,
  },
})
