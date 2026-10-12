import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // En desarrollo el front llama a /api/... y Vite lo reenvía al backend sin el prefijo.
      // Así front y back comparten origen y la cookie de refresh (path /auth en el backend)
      // se reescribe a /api/auth para que el navegador la mande en /api/auth/refresh.
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
          cookiePathRewrite: { '/auth': '/api/auth' },
        },
      },
    },
  };
});
