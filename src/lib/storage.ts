import path from "path";
import { supabaseAdmin, SUPABASE_BUCKET } from "./supabase.js";
import { AppError } from "./errors.js";

function uniqueName(originalname: string): string {
  const ext = path.extname(originalname).toLowerCase();
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

/**
 * Sobe um arquivo recebido pelo multer (memoryStorage) para o Supabase Storage
 * e devolve a URL pública. Em produção essa URL persiste entre deploys.
 */
export async function uploadFile(file: Express.Multer.File): Promise<string> {
  const filename = uniqueName(file.originalname);
  const { error } = await supabaseAdmin.storage
    .from(SUPABASE_BUCKET)
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      cacheControl: "3600",
      upsert: false,
    });
  if (error) throw new AppError(500, `Falha ao enviar imagem: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Apaga um arquivo do bucket dada sua URL pública (idempotente — falhas silenciosas).
 */
export async function deleteFileByUrl(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return;
  const marker = `/${SUPABASE_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const key = publicUrl.slice(idx + marker.length);
  await supabaseAdmin.storage.from(SUPABASE_BUCKET).remove([key]).catch(() => undefined);
}
