import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

interface PrismaError {
  code?: string;
  meta?: { target?: string[] };
}

function isPrismaError(err: unknown): err is Error & PrismaError {
  return err instanceof Error && "code" in err;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Zod validation errors → 422
  if (err instanceof ZodError) {
    const fields = err.issues.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    res.status(422).json({ error: "Dados inválidos", fields });
    return;
  }

  // Custom AppError (NotFoundError, ConflictError, etc.) → use statusCode
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Prisma record not found → 404
  if (isPrismaError(err) && err.code === "P2025") {
    res.status(404).json({ error: "Registro não encontrado" });
    return;
  }

  // Prisma unique constraint violation → 409
  if (isPrismaError(err) && err.code === "P2002") {
    const fields = (err.meta?.target ?? []).join(", ");
    res.status(409).json({ error: `Já existe um registro com este valor (${fields})` });
    return;
  }

  // Unknown errors → 500, never expose internals in production
  console.error("[ERROR]", err);
  const message =
    process.env["NODE_ENV"] === "production"
      ? "Erro interno do servidor"
      : err instanceof Error
        ? err.message
        : "Erro interno do servidor";
  res.status(500).json({ error: message });
}
