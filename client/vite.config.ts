import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['maplibre-gl', 'socket.io-client'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    // Vite 8 / Rolldown native codeSplitting groups:
    // `vendor-react` MUST carry the highest priority so Rolldown never pulls react/jsx-runtime
    // into lazy map chunks (`vendor-maplibre`) and forces eager preloads on landing.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 50,
            },
            {
              name: 'vendor-maplibre',
              test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/,
              priority: 40,
            },
            {
              name: 'vendor-socket',
              test: /[\\/]node_modules[\\/](socket\.io-client|engine\.io-client|@socket\.io)[\\/]/,
              priority: 30,
            },
            {
              name: 'data-vietnam-catalog',
              test: /[\\/]src[\\/]data[\\/](seedData|vietnamDirectory)\.ts$/,
              priority: 20,
            },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
});
