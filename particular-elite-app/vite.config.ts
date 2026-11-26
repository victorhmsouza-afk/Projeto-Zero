import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// O build gera UM ÚNICO index.html (CSS e JS embutidos) dentro de ../projeto-particularelite,
// para abrir com dois cliques, no GitHub Pages ou em qualquer servidor, sem 404 (Hash Router).
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    outDir: '../projeto-particularelite',
    emptyOutDir: false,
    chunkSizeWarningLimit: 4000,
  },
});
