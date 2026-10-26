import { defineConfig, devices } from '@playwright/test'

// Tests du moteur de calcul (sans navigateur), puis de l'app dans un vrai navigateur, sur PC et sur téléphone, avec Supabase simulé.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  // CHROMIUM : navigateur déjà installé sur la machine (environnement sans téléchargement)
  use: { baseURL: 'http://localhost:4174/', trace: 'retain-on-failure', launchOptions: process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {} },
  projects: [
    { name: 'moteur', testDir: './tests/moteur' },
    { name: 'pc', testIgnore: /moteur\//, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'telephone', testIgnore: /moteur\//, use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'VITE_SUPABASE_URL=https://supabase.test VITE_SUPABASE_ANON_KEY=cle-test npx vite build --outDir dist-test && npx vite preview --outDir dist-test --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
