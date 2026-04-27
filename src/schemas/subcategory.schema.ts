import { z } from "zod";

export const CreateSubCategorySchema = z.object({
  name: z.string({ error: "Nome é obrigatório" }).min(1, "Nome não pode ser vazio").max(100, "Nome muito longo"),
  categoryId: z.string({ error: "categoryId é obrigatório" }).uuid("categoryId deve ser um UUID válido"),
});

export const UpdateSubCategorySchema = z.object({
  name: z.string().min(1, "Nome não pode ser vazio").max(100, "Nome muito longo").optional(),
  categoryId: z.string().uuid("categoryId deve ser um UUID válido").optional(),
});

export type CreateSubCategoryInput = z.infer<typeof CreateSubCategorySchema>;
export type UpdateSubCategoryInput = z.infer<typeof UpdateSubCategorySchema>;
