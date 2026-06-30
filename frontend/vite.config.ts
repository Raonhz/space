import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '');
    return {
      envDir: '../',
      server: {
        proxy: {
          '/ws/stream-status': {target: 'ws://127.0.0.1:5001', ws: true},
          '/health': 'http://127.0.0.1:5001',
          '/music': 'http://127.0.0.1:5001',
          '/api': 'http://127.0.0.1:5001',
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
