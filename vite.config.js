import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import { VitePWA } from 'vite-plugin-pwa' // temporarily disabled to avoid install/peer-dep issues

const projectRootDir = path.resolve(__dirname);

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
  resolve: {
    alias: {
      react: path.resolve(projectRootDir, 'node_modules/react'),
      'react-dom': path.resolve(projectRootDir, 'node_modules/react-dom'),
      'react-dom/client': path.resolve(projectRootDir, 'node_modules/react-dom/client'),
      'react/jsx-runtime': path.resolve(projectRootDir, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(projectRootDir, 'node_modules/react/jsx-dev-runtime'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  build: {
    modulePreload: {
      resolveDependencies: (filename, deps) =>
        deps.filter((d) => !d.includes('vendor-pdf') && !d.includes('vendor-fullcalendar')),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const normalizedId = id.split(path.win32.sep).join('/');
          if (normalizedId.includes('/node_modules/recharts/')) return 'vendor-recharts';
          if (normalizedId.includes('/node_modules/lucide-react/')) return 'vendor-lucide';
          // PERFORMANCE FIX: these used to fall through to the single
          // catch-all 'vendor' chunk below along with everything else in
          // node_modules, so firebase (auth+firestore, sizeable on its
          // own), jspdf/jspdf-autotable/html2canvas (only used by the few
          // pages that export PDFs), and @fullcalendar/* (only used by
          // Schedule) were all downloaded on every single first visit —
          // including before login, when none of them are needed yet.
          // Splitting them into their own chunks means the browser only
          // fetches each one the first time a route that actually uses it
          // is visited, same idea as the page-level React.lazy() split in
          // App.jsx above it.
          if (normalizedId.includes('/node_modules/firebase/') || normalizedId.includes('/node_modules/@firebase/')) return 'vendor-firebase';
          if (normalizedId.includes('/node_modules/jspdf') || normalizedId.includes('/node_modules/html2canvas/')) return 'vendor-pdf';
          if (normalizedId.includes('/node_modules/@fullcalendar/')) return 'vendor-fullcalendar';
          if (normalizedId.includes('/node_modules/katex/')) return 'vendor-katex';
          if (normalizedId.includes('/node_modules/date-fns/')) return 'vendor-date-fns';
          return 'vendor';
        }
      }
    },
    chunkSizeWarningLimit: 2000,
  },
})
