// vite.config.js or vite.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Your existing Vite configuration (plugins, resolve.alias, etc.)
  plugins: [
    // ... your frontend plugins
  ],
  test: {
    // Vitest configuration options
    environment: 'node', // Use Node.js environment for backend tests
    globals: true, // Optional: makes test APIs globally available (like 'it', 'expect')
    // You can add more configuration here, like file patterns, coverage, etc.
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
  },
});
