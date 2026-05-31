import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  // Serve the images/ folder as static assets at /images/
  publicDir: 'images',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase SDK split by package
          'firebase-app':       ['firebase/app'],
          'firebase-auth':      ['firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          'firebase-functions': ['firebase/functions'],
          // React runtime
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
