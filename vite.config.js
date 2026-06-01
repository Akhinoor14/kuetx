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
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 2000,
  },
})
