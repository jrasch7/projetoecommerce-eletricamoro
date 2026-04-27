import { z } from "zod";

export const CreateOrderSchema = z.object({
  customer: z.string({ error: "Nome do cliente é obrigatório" }).min(1, "Nome do cliente não pode ser vazio").max(200),
  total: z.coerce.number({ error: "Total é obrigatório" }).nonnegative("Total não pode ser negativo"),
  status: z.string().max(50).default("Pendente"),
  payment: z.string().max(100).default("Não informado"),
  address: z
    .string()
    .max(500)
    .nullish()
    .transform((v): string | null => v ?? null),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: z.array(z.any()).default([]),
});

export const UpdateOrderSchema = z.object({
  status: z.string().max(50).optional(),
  payment: z.string().max(100).optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;
