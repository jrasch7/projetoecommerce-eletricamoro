import { z } from "zod";

export const CreateCategorySchema = z.object({
  name: z.string({ error: "Nome é obrigatório" }).min(1, "Nome não pode ser vazio").max(100, "Nome muito longo"),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1, "Nome não pode ser vazio").max(100, "Nome muito longo").optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
