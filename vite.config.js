/**
 * Vite Configuration
 * Optimized for KitchenEye PWA
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'frontend/public',

  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true,

    // Optimize chunks
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend/public/index.html'),
      },
      output: {
        manualChunks: {
          // Vendor chunk for external dependencies
          'vendor': ['nanostores', 'web-vitals'],

          // Store chunk for state management
          'stores': [
            './frontend/public/stores/auth.js',
            './frontend/public/stores/ui.js',
          ],

          // Utils chunk
          'utils': [
            './frontend/public/utils/lazy-images.js',
            './frontend/public/utils/vitals.js',
          ],
        },

        // Naming pattern for chunks
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Organize assets by type
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];

          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },

    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
      format: {
        comments: false, // Remove comments
      },
    },

    // Target modern browsers
    target: 'es2020',

    // Generate sourcemaps for debugging
    sourcemap: false,

    // Optimize CSS
    cssCodeSplit: true,

    // Asset inline limit (smaller assets will be inlined as base64)
    assetsInlineLimit: 4096, // 4KB

    // Chunk size warning limit
    chunkSizeWarningLimit: 500, // 500KB
  },

  // Development server settings
  server: {
    port: 3000,
    open: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },

  // Preview server (for production build)
  preview: {
    port: 4173,
    open: true,
  },

  // Dependency optimization
  optimizeDeps: {
    include: ['nanostores', 'web-vitals'],
    exclude: [],
  },

  // Plugin configuration
  plugins: [],

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  // CSS preprocessor options
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase',
    },
  },

  // Performance optimizations
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
});
