import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://6ec6-120-29-90-44.ngrok-free.app',
        changeOrigin: true,
        secure: false,
      }
    }
  }
}); 