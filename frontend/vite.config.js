import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // aceita conexões de outros computadores da rede
    port: 5173,
    strictPort: true,    // se a 5173 estiver ocupada, dá erro (em vez de pular para 5174)
    proxy: { '/api': 'http://localhost:3002' },
  },
})