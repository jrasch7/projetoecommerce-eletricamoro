# CLAUDE.md — Elétrica Moro E-commerce

Guia de contexto para agentes Claude. Leia antes de qualquer tarefa.

---

## Visão Geral

E-commerce para a **Elétrica Moro** (Novo Hamburgo, RS). Vende materiais elétricos e produtos para casa. Backend em Node.js/Express/TypeScript, banco PostgreSQL via Supabase, frontend em HTML + Vanilla JS com Tailwind CSS.

**Repositório:** https://github.com/jrasch7/projetoecommerce  
**Branch principal:** `main`

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js (ESM, `"type": "module"`) |
| Linguagem | TypeScript 5.9 (strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`) |
| Framework | Express 4 |
| ORM | Prisma 7 com adaptador `@prisma/adapter-pg` |
| Banco | PostgreSQL (Supabase) |
| Validação | Zod v4 |
| Upload | Multer (disco local `public/uploads/`) |
| Segurança | Helmet, express-rate-limit, CORS |
| Frontend | HTML + Vanilla JS + Tailwind CSS (CDN) |

---

## Comandos

```bash
npm run dev       # servidor dev com hot-reload (tsx watch)
npm run build     # compila TypeScript → dist/
npm start         # inicia produção (node dist/server.js)

npx prisma migrate dev    # aplica migrações no banco
npx prisma generate       # regenera o client em src/generated/prisma/
npx prisma studio         # GUI do banco
```

---

## Estrutura de Arquivos

```
src/
  server.ts              # entry point — valida env vars e inicia o servidor
  app.ts                 # configura Express (middlewares, rotas, health check)
  lib/
    prisma.ts            # singleton PrismaClient com adaptador pg
    errors.ts            # AppError, NotFoundError, ConflictError
    asyncHandler.ts      # wrapper para rotas async (elimina try/catch)
  middleware/
    error.ts             # error handler global (Zod→422, Prisma→404/409, AppError, 500)
    upload.ts            # multer: imagens jpeg/jpg/png/webp até 5MB → public/uploads/
  routes/
    categories.ts        # GET/, GET/:id, GET/:id/subcategories, POST, PUT/:id, DELETE/:id
    subcategories.ts     # GET/, GET/:id, POST, PUT/:id, DELETE/:id
    products.ts          # GET/(paginado), POST, PUT/:id, DELETE/:id
    orders.ts            # GET/(paginado), POST, PUT/:id, DELETE/:id
  schemas/
    category.schema.ts   # CreateCategorySchema, UpdateCategorySchema
    subcategory.schema.ts
    product.schema.ts    # CreateProductSchema, UpdateProductSchema
    order.schema.ts      # CreateOrderSchema, UpdateOrderSchema
  generated/
    prisma/              # cliente Prisma gerado — NÃO editar manualmente

prisma/
  schema.prisma          # modelos: Product, Category, SubCategory, Order
  seed.ts                # seed de dados iniciais
  migrations/            # histórico de migrações SQL

public/
  index.html             # home: hero slider, grid de categorias, carrosséis
  categoria.html         # listagem de produtos por categoria
  admin.html             # painel administrativo
  js/
    main-components.js   # header/footer, carrinho (localStorage), cards de produto
  img/
    logo-moro.webp
  uploads/               # imagens enviadas via API (runtime)
```

---

## Variáveis de Ambiente

Obrigatórias em `.env` (nunca commitar):

```env
DIRECT_URL=postgresql://...    # conexão direta Supabase (obrigatória)
PORT=3000                      # opcional, default 3000
CORS_ORIGIN=*                  # opcional, default *
NODE_ENV=development           # opcional
```

---

## Modelos do Banco

```
Category      id, name (unique), imageUrl?
  └── SubCategory   id, name, categoryId?
        └── Product     id, name, description?, price, stock, is_featured, on_sale,
                         brand?, model?, voltage?, images(Json), subCategoryId?
Order         id, customer, total, status, payment, address?, items(Json), createdAt
```

Relações com `onDelete: SetNull` — deletar categoria/subcategoria não apaga filhos, apenas desvincula.

---

## Padrões de Código

### Rotas

Sempre usar `asyncHandler` — nunca try/catch inline:

```typescript
router.get("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;  // noUncheckedIndexedAccess exige cast
  const item = await prisma.model.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Nome do recurso");
  res.json(item);
}));
```

### Validação com Zod v4

```typescript
// Zod v4: usar { error: "msg" } (não required_error)
// Usar .issues (não .errors) no ZodError
const schema = z.object({
  name: z.string({ error: "obrigatório" }).min(1),
  nullable: z.string().nullish().transform((v): string | null => v ?? null),
});
const parsed = schema.parse(req.body);  // lança ZodError → capturado pelo errorHandler
```

### Erros

```typescript
throw new NotFoundError("Produto");   // → 404
throw new ConflictError("mensagem");  // → 409
throw new AppError(400, "mensagem");  // → status custom
// ZodError automático → 422 com campos
// Prisma P2025 → 404, P2002 → 409
```

### Query params (paginação)

```typescript
const pageNum = Math.max(1, parseInt(String(req.query["page"] ?? "1")));
const limitNum = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
// Resposta: { data, total, page, limit, totalPages }
```

### TypeScript estrito

- `noUncheckedIndexedAccess: true` → `req.params["id"] as string` nos handlers de rota
- `exactOptionalPropertyTypes: true` → campos nullable no Zod devem usar `.transform((v): string | null => v ?? null)` para evitar conflito com Prisma
- `req.query["x"]` retorna `string | ParsedQs | string[] | ParsedQs[] | undefined` → sempre usar `String(req.query["x"] ?? "default")`

---

## Endpoints da API

```
GET    /api/health                    → { status, uptime, timestamp }

GET    /api/categories                → Category[]
GET    /api/categories/:id            → Category (404 se não encontrado)
GET    /api/categories/:id/subcategories → SubCategory[]
POST   /api/categories                → 201 Category  (multipart/form-data: name, photo?)
PUT    /api/categories/:id            → Category      (multipart/form-data: name?, photo?)
DELETE /api/categories/:id            → 204

GET    /api/subcategories             → SubCategory[]
GET    /api/subcategories/:id         → SubCategory (404 se não encontrado)
POST   /api/subcategories             → 201 SubCategory  (body: name, categoryId)
PUT    /api/subcategories/:id         → SubCategory      (body: name?, categoryId?)
DELETE /api/subcategories/:id         → 204

GET    /api/products?page=1&limit=20&subCategoryId=?&categoryId=? → { data, total, page, limit, totalPages }
POST   /api/products                  → 201 Product  (multipart/form-data: campos + images[])
PUT    /api/products/:id              → Product      (multipart/form-data: campos opcionais + images[]?)
DELETE /api/products/:id              → 204

GET    /api/orders?page=1&limit=20    → { data, total, page, limit, totalPages }
POST   /api/orders                    → 201 Order  (body: customer, total, status?, payment?, address?, items?)
PUT    /api/orders/:id                → Order      (body: status?, payment?)
DELETE /api/orders/:id                → 204
```

**Rate limiting:** 100 req / 15min por IP em todos os endpoints `/api/*`

---

## Próximos Passos (Roadmap)

Tarefas em ordem de prioridade para sessões futuras com múltiplos agentes:

### Alta Prioridade

- [ ] **Autenticação JWT** — modelo `User` (admin/cliente), login, middleware `requireAuth`, `requireAdmin`
- [ ] **Integração de Pagamentos** — Stripe ou Mercado Pago, webhook de status de pedido
- [ ] **Testes Automatizados** — Vitest, testes de integração nas rotas com banco real (não mocks)

### Média Prioridade

- [ ] **Busca de Produtos** — `GET /api/products?q=termo` com Prisma `contains` + índice no banco
- [ ] **Otimização do Frontend** — substituir Tailwind CDN por build local, lazy loading de imagens
- [ ] **Carrinho Persistido** — sincronia do localStorage com backend (modelo `Cart` no banco)
- [ ] **Admin completo** — CRUD de produtos/categorias totalmente funcional no admin.html

### Infraestrutura

- [ ] **Dockerfile** + `docker-compose.yml` para ambiente de dev local
- [ ] **CI/CD** — GitHub Actions: `tsc --noEmit` + testes em cada PR
- [ ] **Logs estruturados** — substituir `console.error` por pino ou winston
- [ ] **Índices no banco** — adicionar `@@index` no Prisma para campos de busca frequente

---

## Observações Importantes

1. O cliente Prisma está em `src/generated/prisma/` (gerado automaticamente) — não editar.
2. Após alterar `prisma/schema.prisma`, sempre rodar `prisma migrate dev` + `prisma generate`.
3. O frontend usa `localStorage` com chave `eletrica_moro_cart` para o carrinho.
4. `src/generated/` está excluído do tsconfig mas pode ser importado normalmente — `skipLibCheck: true` está ativo.
5. Rate limit padrão: 100 req/15min. Ajustar se endpoints públicos precisarem de mais tolerância.
6. Uploads ficam em `public/uploads/` — em produção substituir por S3 ou Supabase Storage.
