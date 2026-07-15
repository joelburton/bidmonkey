/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Unit/component tests live next to the source; the e2e/ Playwright specs
    // run under `npm run e2e`, not here (Vitest can't load Playwright's test()).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
