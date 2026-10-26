import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Publié sur GitHub Pages sous /vandb-pilotage/ ; chemins relatifs pour fonctionner à toute adresse.
export default defineConfig({
  plugins: [react()],
  base: './',
})
