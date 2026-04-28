import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env["SUPABASE_URL"];
const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"];
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_KEY"];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_KEY devem estar definidos no .env");
}

// Admin client: bypassa RLS. Usado em uploads, convites de usuário, e outras
// operações que exigem privilégio total. NUNCA expor no frontend.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Client público: respeita RLS. Usado para validar JWTs de usuários autenticados.
export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const SUPABASE_BUCKET = process.env["SUPABASE_STORAGE_BUCKET"] || "uploads";
