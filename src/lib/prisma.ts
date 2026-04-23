import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import "dotenv/config";

const { Pool } = pg;

// 1. Configuramos o pool de conexão
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. Instanciamos o Adapter
const adapter = new PrismaPg(pool);

// 3. Instanciamos o Cliente usando o ADAPTER
// Na v7 com adapter, passamos o objeto 'adapter' diretamente
export const prisma = new PrismaClient({ adapter });