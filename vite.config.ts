import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "development" ? "/" : process.env.VITE_BASE_PATH || "/",
  optimizeDeps: {
    entries: ["src/main.tsx"],
  },
  plugins: [
    react(),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // @ts-ignore
    allowedHosts: true,
    fs: {
      // Ogranicz dostęp do plików poza projektem dla bezpieczeństwa
      deny: [
        // Zablokuj dostęp do plików systemowych
        '**/.git/**',
        '**/.env*',
        '**/node_modules/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        // Zablokuj dostęp do katalogów nadrzędnych
        '../**',
        '../../**',
        '../../../**'
      ],
      // Pozwól na dostęp tylko do katalogu projektu
      allow: [
        // Katalog główny projektu
        process.cwd(),
        // Katalog src
        path.resolve(__dirname, './src'),
        // Katalog public
        path.resolve(__dirname, './public'),
        // Node modules (tylko dla development)
        ...(process.env.NODE_ENV === 'development' ? [path.resolve(__dirname, './node_modules')] : [])
      ]
    }
  }
});
