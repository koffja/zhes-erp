import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5271,
    host: true, // 允许局域网访问
    proxy: {
      '/api': {
        target: 'http://localhost:5126',
        changeOrigin: true
      }
    },
    headers: {
      'Cache-Control': 'no-store' // 禁用缓存
    }
  }
})
