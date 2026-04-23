import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    // Adicione o "as string" para acalmar o TypeScript
    url: process.env.DATABASE_URL as string,
  },
});