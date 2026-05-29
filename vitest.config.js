import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['dotenv/config'], // carrega .env (DATABASE_URL etc.)
    include: ['tests/**/*.test.{js,mjs}'],
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
});
