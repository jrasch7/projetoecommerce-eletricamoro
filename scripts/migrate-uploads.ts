/**
 * Migra imagens locais (public/uploads/) para o Supabase Storage e atualiza
 * URLs no banco. Idempotente — pode rodar múltiplas vezes sem duplicar.
 *
 * Uso: npx tsx scripts/migrate-uploads.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma.js";
import { supabaseAdmin, SUPABASE_BUCKET } from "../src/lib/supabase.js";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

function isLocalUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && url.startsWith("/uploads/");
}

function filenameFromLocal(url: string): string {
  return url.replace(/^\/uploads\//, "");
}

async function uploadLocal(filename: string): Promise<string | null> {
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  [skip] arquivo não encontrado: ${filename}`);
    return null;
  }
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" :
    ext === ".webp" ? "image/webp" :
    "image/jpeg";

  // Reaproveita o nome original (timestamp já garante unicidade); se já existir, faz upsert.
  const { error } = await supabaseAdmin.storage
    .from(SUPABASE_BUCKET)
    .upload(filename, buffer, { contentType, cacheControl: "3600", upsert: true });

  if (error) {
    console.error(`  [erro] upload ${filename}: ${error.message}`);
    return null;
  }
  const { data } = supabaseAdmin.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function migrateCategories() {
  const categories = await prisma.category.findMany({ where: { imageUrl: { startsWith: "/uploads/" } } });
  console.log(`\n[Categories] ${categories.length} a migrar`);
  for (const cat of categories) {
    if (!isLocalUrl(cat.imageUrl)) continue;
    const filename = filenameFromLocal(cat.imageUrl);
    const newUrl = await uploadLocal(filename);
    if (newUrl) {
      await prisma.category.update({ where: { id: cat.id }, data: { imageUrl: newUrl } });
      console.log(`  ✓ ${cat.name}`);
    } else {
      // arquivo órfão — limpa referência inválida pra não dar 404 no front
      await prisma.category.update({ where: { id: cat.id }, data: { imageUrl: null } });
      console.log(`  ~ ${cat.name} (referência órfã limpa)`);
    }
  }
}

async function migrateProducts() {
  const products = await prisma.product.findMany();
  console.log(`\n[Products] varrendo ${products.length} produtos`);
  for (const prod of products) {
    if (!prod.images || !Array.isArray(prod.images)) continue;
    const urls = prod.images.filter((u): u is string => typeof u === "string");
    const localUrls = urls.filter(isLocalUrl);
    if (localUrls.length === 0) continue;

    const newImages: string[] = [];
    for (const url of urls) {
      if (!isLocalUrl(url)) {
        newImages.push(url);
        continue;
      }
      const filename = filenameFromLocal(url);
      const newUrl = await uploadLocal(filename);
      if (newUrl) newImages.push(newUrl);
    }
    await prisma.product.update({ where: { id: prod.id }, data: { images: newImages } });
    console.log(`  ✓ ${prod.name} (${localUrls.length} → ${newImages.length})`);
  }
}

async function main() {
  console.log("Iniciando migração para Supabase Storage…");
  console.log(`Bucket: ${SUPABASE_BUCKET}`);
  console.log(`Pasta local: ${UPLOADS_DIR}`);
  await migrateCategories();
  await migrateProducts();
  console.log("\nMigração concluída.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
