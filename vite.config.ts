import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: { port: 8000 },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
      }
    }
  },
  css: {
    postcss: {
      plugins: [(await import('@tailwindcss/postcss')).default],
    },
  },
})
