import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_BASE_URL || 'http://localhost:8787';

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }

            if (id.includes('node_modules/pdf-lib')) {
              return 'pdf-edit-vendor';
            }

            if (
              id.includes('node_modules/react-pdf') ||
              id.includes('node_modules/pdfjs-dist')
            ) {
              return 'pdf-render-vendor';
            }

            return undefined;
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
})
