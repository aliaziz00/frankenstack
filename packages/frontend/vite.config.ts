import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev-time reverse proxy: the browser only ever talks to the Vite
      // origin, so there's no CORS to think about from the frontend's side
      // (the backend still allows it directly, for curl/Postman use). In
      // production this same role is played by a real reverse proxy /
      // gateway sitting in front of both services.
      '/api': 'http://localhost:4000',
    },
  },
})
