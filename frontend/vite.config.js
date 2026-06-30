import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:8787';
  const isElectronBuild = mode === 'electron';
  
  // Determine if we should use proxy or direct API calls
  const isExternalApi = apiBaseUrl.includes('http://') && !apiBaseUrl.includes('localhost') || apiBaseUrl.includes('https://');
  const shouldUseProxy = !isExternalApi && !isElectronBuild;

  return {
    // Electron butuh path relatif ('./) agar aset bisa dimuat dari file://
    base: isElectronBuild ? './' : '/',
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    build: {
      outDir: isElectronBuild ? '../electron-app/frontend-dist' : 'dist',
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
    server: shouldUseProxy ? {
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    } : {},
  };
})
