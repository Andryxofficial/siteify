import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          /* Three.js — separato in chunk vendor per cache a lungo termine */
          if (id.includes('node_modules/three') || id.includes('/three/')) return 'vendor-three';
          /* Vendor — cambia raramente, cache a lungo termine */
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/react-helmet-async')) {
            return 'vendor-helmet';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor')) {
            return 'vendor-recharts';
          }
          /* Andryx Hourglass — chunk core (engine/render/state/audio/sprites/i18n).
             Le scene (src/games/hourglass/scenes/*) restano fuori per essere
             lazy-loaded separatamente al cambio scena, come un metroidvania. */
          if (id.includes('/src/games/hourglass/') && !id.includes('/src/games/hourglass/scenes/')) {
            return 'hourglass';
          }
        },
      },
    },
    rolldownOptions: {
      output: {
        manualChunks(id) {
          /* Three.js — chunk vendor separato */
          if (id.includes('node_modules/three') || id.includes('/three/')) return 'vendor-three';
          /* Vendor React */
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';
          if (id.includes('node_modules/react-helmet-async')) return 'vendor-helmet';
          if (id.includes('node_modules/lucide-react')) return 'vendor-lucide';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor')) return 'vendor-recharts';
          if (id.includes('/src/games/hourglass/') && !id.includes('/src/games/hourglass/scenes/')) return 'hourglass';
        },
      },
    },
  },
})
