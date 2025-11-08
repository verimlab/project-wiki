import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(() => {
  // Allow overriding proxy target via env var
  const proxyTarget = process.env.VITE_ASSISTANT_PROXY_TARGET || 'http://127.0.0.1:5001/project-wiki-445ed/us-central1';
  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy only the assistant endpoint in dev so /api/gemini hits Functions/emulator
        '/api/gemini': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: () => '/gemini',
        },
      },
    },
  }
})
