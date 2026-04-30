import { z } from "zod";

const CouponTypeSchema = z.enum(["PERCENT", "FIXED"]);

export const CreateCouponSchema = z.object({
  code: z
    .string({ error: "Código do cupom é obrigatório" })
    .trim()
    .min(1, "Código do cupom é obrigatório")
    .max(50)
    .transform((v) => v.toUpperCase()),
  type: CouponTypeSchema,
  value: z.coerce.number({ error: "Valor do cupom é obrigatório" }).positive("Valor deve ser maior que zero"),
  minOrder: z
    .coerce.number()
    .nonnegative("Pedido mínimo não pode ser negativo")
    .nullish()
    .transform((v): number | null => v ?? null),
  maxUses: z
    .coerce.number()
    .int("Limite de uso deve ser inteiro")
    .positive("Limite de uso deve ser maior que zero")
    .nullish()
    .transform((v): number | null => v ?? null),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .nullish()
    .transform((v): Date | null => (v ? new Date(v) : null)),
  active: z.coerce.boolean().default(true),
});

export const UpdateCouponSchema = CreateCouponSchema.partial();

export const ValidateCouponSchema = z.object({
  code: z.string({ error: "Código do cupom é obrigatório" }).trim().min(1).transform((v) => v.toUpperCase()),
  total: z.coerce.number({ error: "Total é obrigatório" }).nonnegative("Total não pode ser negativo"),
});

export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>;
export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;
