import { z } from "zod";

const boolField = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => v === true || v === "true")
  .default(false);

const nullableStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v): string | null => v ?? null);

export const CreateProductSchema = z.object({
  name: z.string({ error: "Nome é obrigatório" }).min(1, "Nome não pode ser vazio").max(200),
  description: nullableStr(2000),
  price: z.coerce.number({ error: "Preço é obrigatório" }).positive("Preço deve ser maior que zero"),
  stock: z.coerce.number().int().min(0, "Estoque não pode ser negativo").default(0),
  subCategoryId: nullableStr(50),
  is_featured: boolField,
  on_sale: boolField,
  brand: nullableStr(100),
  model: nullableStr(100),
  voltage: nullableStr(50),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  price: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  subCategoryId: z.string().nullable().optional(),
  is_featured: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .optional(),
  on_sale: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
  voltage: z.string().trim().max(50).nullable().optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
