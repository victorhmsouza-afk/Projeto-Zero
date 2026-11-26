import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// O build gera UM ÚNICO index.html (CSS e JS embutidos) dentro de ../ (pasta projetoparticular3.0),
// para abrir com dois cliques, no GitHub Pages ou em qualquer servidor, sem 404 (Hash Router).
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // Em desenvolvimento, /api-prontuario/* é repassado para a API do prontuário (evita CORS).
  server: {
    proxy: {
      '/api-prontuario': {
        target: 'https://api-prontuario.samel.com.br',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api-prontuario/, ''),
      },
    },
  },
  build: {
    outDir: '..',
    emptyOutDir: false,
    chunkSizeWarningLimit: 4000,
  },
});
