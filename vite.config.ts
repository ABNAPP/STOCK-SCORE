import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
// Set VITE_BASE_PATH when deploying to a subpath (e.g. GitHub Pages: VITE_BASE_PATH=/STOCK-SCORE/)
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  resolve: {
    alias: process.env.VITEST
      ? { 'firebase-admin': path.resolve(__dirname, 'src/test/mocks/firebaseAdmin.ts') }
      : {},
  },
  server: {
    port: 5173, // Default Vite port
    strictPort: false, // If port is in use, try next available port
    open: true, // Automatically open browser when dev server starts
  },
  plugins: [
    react(),
    // Only enable visualizer during build, not in dev mode
    ...(process.env.ANALYZE === 'true' 
      ? [visualizer({
          filename: './dist/stats.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap', // treemap, sunburst, network
        })]
      : []
    ),
  ],
  build: {
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1000KB (1MB)
    rollupOptions: {
      output: {
        // Manual chunk splitting for better optimization
        manualChunks: {
          // Separate vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'i18n-vendor': ['i18next', 'react-i18next'],
          'chart-vendor': ['recharts'],
          'parser-vendor': ['papaparse'],
        },
      },
    },
  },
  // Worker configuration - Vite handles workers automatically with new URL() syntax
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        '**/build/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/',
        '**/__mocks__/',
        'e2e/',
      ],
      include: [
        'src/**/*.{ts,tsx}',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      all: true,
    },
  },
})

