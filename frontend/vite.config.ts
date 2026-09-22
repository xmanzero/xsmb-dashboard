import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // The ECharts chunk is ~720 kB (240 kB gzip) by nature; it is split out and cached separately.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Keep the large, rarely-changing chart engine in its own long-cached chunk.
        manualChunks(id) {
          // Module ids use forward slashes on every OS, including Windows.
          if (/node_modules\/(echarts|zrender|echarts-for-react)\//.test(id)) return 'echarts'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
        },
      },
    },
  },
})
