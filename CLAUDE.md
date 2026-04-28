# CLAUDE.md — Elétrica Moro E-commerce

Guia de contexto para agentes Claude. Leia antes de qualquer tarefa.

---

## Visão Geral

E-commerce para a **Elétrica Moro** (Novo Hamburgo, RS). Vende materiais elétricos e produtos para casa. Backend Node.js/Express/TypeScript, banco PostgreSQL via Supabase, frontend HTML + Vanilla JS com Tailwind CSS.

Sistema desenvolvido por **SulCore** (assinatura visível em todas as telas administrativas e mini-assinatura no rodapé da loja).

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
| **Auth** | **Supabase Auth** (cliente + admin unificados via `user_metadata.is_admin`) |
| **Storage** | **Supabase Storage** (bucket público `uploads`) |
| Validação | Zod v4 |
| Upload | Multer `memoryStorage` → `uploadFile()` → Supabase |
| Segurança | Helmet, express-rate-limit, CORS configurável |
| Frontend | HTML + Vanilla JS + Tailwind CSS (CDN) |

---

## Comandos

```bash
npm run dev                          # tsx watch (hot-reload)
npm run build                        # tsc → dist/
npm start                            # node dist/server.js

npx prisma db push                   # sync schema (preferido em dev)
npx prisma generate                  # regenera cliente
npx tsc --noEmit                     # type-check sem emitir

npx tsx scripts/migrate-uploads.ts   # migra imagens locais → Supabase
```

---

## Variáveis de Ambiente

Em `.env` (gitignored, **nunca commitar**):

```env
DATABASE_URL=postgresql://...        # via pgbouncer
DIRECT_URL=postgresql://...          # conexão direta (obrigatória)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...             # pública (frontend)
SUPABASE_SERVICE_KEY=eyJ...          # secreta (bypassa RLS)
SUPABASE_STORAGE_BUCKET=uploads
PORT=3000                            # opcional
CORS_ORIGIN=*                        # opcional
NODE_ENV=development                 # opcional
```

---

## Arquitetura de Auth (CRÍTICO entender)

**Não há mais auth duplicado.** Tudo passa pelo Supabase Auth.

```
Cliente (loja)         Admin (painel)
       │                      │
       └──────────┬───────────┘
                  │
        Supabase Auth
        (email + senha)
                  │
        ┌─────────┴─────────┐
        │ user_metadata     │
        │ .is_admin = true  │  → admin
        │ .is_admin ≠ true  │  → cliente
        └───────────────────┘
```

### Middleware

- **`requireAuth`** (src/middleware/requireAuth.ts) — valida JWT Supabase, qualquer logado passa. Expõe `req.authUser = { id, email, isAdmin }`.
- **`requireAdmin`** (src/middleware/requireAdmin.ts) — extends + exige `is_admin === true`. Expõe `req.adminUser = { id, email }`.

### Frontend

- **Loja**: `main-components.js` injeta botão "Entrar" / dropdown "Minha conta" (com link "Painel administrativo" só se `is_admin`). Modal de login/cadastro/forgot dentro do mesmo arquivo.
- **Painel admin**: `admin.html` tem guard duplo no `<head>`: síncrono (lê `localStorage` do Supabase) + async (`requireAdmin()` valida via API).
- **Páginas:**
  - `/login.html` — universal (cliente + admin), redireciona conforme `is_admin`
  - `/set-password.html` — invite + recovery, redireciona conforme tipo
  - `/admin-login.html` → redirect 302 pra `/login.html`
  - `/central-do-cliente.html` → redirect pra `/minha-conta.html`

### Criar primeiro admin

```sql
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
WHERE email = '<email>';
```

### Convidar novo admin

Via UI (aba "Equipe" no painel) → endpoint `POST /api/admin/invite` chama `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { is_admin: true }, redirectTo: '/set-password.html' })`. Email é enviado pela infra do Supabase.

---

## Arquitetura de Storage

**Imagens NÃO vão pro disco local.** Sempre Supabase Storage.

```
multer.memoryStorage() → req.file.buffer
                              │
                              ▼
                   uploadFile(file)  [src/lib/storage.ts]
                              │
                              ▼
              supabaseAdmin.storage.from('uploads').upload(...)
                              │
                              ▼
              { publicUrl: "https://xxx.supabase.co/storage/v1/object/public/uploads/..." }
```

- URLs salvas no DB são absolutas (não `/uploads/...`)
- `deleteFileByUrl(url)` apaga o blob quando imagem é substituída/deletada
- Migração: `npx tsx scripts/migrate-uploads.ts` (idempotente)

---

## Arquitetura Anti-FOUC (zero flash de cores)

Tema (cores, fonte, logo) é gerenciado por DB (`StoreConfig`) e injetado em camadas:

1. **SSR** — `src/app.ts` intercepta TODAS as requisições HTML (`/`, `/admin.html`, etc.) e injeta no `<head>`:
   - `<style>:root{--color-primary:...; --color-secondary:...; ...}</style>`
   - `<script id="ssr-config" type="application/json">{...config completa...}</script>`
2. **Cache localStorage** — `theme-config.js` salva config em `eletrica_moro_theme` e aplica sincronicamente em fallback se não houver SSR.
3. **Background revalidate** — após `load`, fetch `/api/config` e atualiza só se houve mudança (sem re-flash).

**Não rode** scripts de tema async no first paint — sempre use SSR ou cache.

---

## Estrutura

```
src/
  server.ts              # entry — valida env e inicia
  app.ts                 # Express + SSR theme injection (interceptor de /)
  lib/
    prisma.ts            # singleton PrismaClient (adapter-pg)
    supabase.ts          # supabaseAdmin (service_role) + supabasePublic (anon)
    storage.ts           # uploadFile, deleteFileByUrl (Supabase Storage)
    errors.ts            # AppError, NotFoundError, ConflictError
    asyncHandler.ts      # wrapper async pra rotas
  middleware/
    error.ts             # handler global (Zod→422, Prisma→404/409, AppError)
    upload.ts            # multer memoryStorage + filtro imagens 5MB
    requireAuth.ts       # valida JWT Supabase (cliente OU admin logado)
    requireAdmin.ts      # exige is_admin=true
  routes/
    categories.ts        # GET/, GET/:id, POST [admin], PUT [admin], DELETE [admin]
    subcategories.ts     # mesmo padrão
    products.ts          # paginado, suggested, write [admin]
    orders.ts            # GET [admin], /track público, /my-account [auth], POST público
    customer.ts          # /me, PUT /me, /orders — todos [auth]
    admin.ts             # /me, /users, /invite, DELETE /users/:id — todos [admin]
    config.ts            # tema (write [admin])
    payments.ts          # config + webhook + process
  schemas/               # Zod schemas
  generated/prisma/      # cliente gerado — NÃO editar

scripts/
  migrate-uploads.ts     # migra public/uploads/ → Supabase

prisma/
  schema.prisma          # Product, Category, SubCategory, Order, Customer,
                         #  ProductVariant, StoreConfig, PaymentConfig

public/
  index.html             # home
  categoria.html         # listagem
  produto.html           # detalhe + variantes
  checkout.html          # checkout PagBank
  sucesso.html           # confirmação
  minha-conta.html       # cliente: pedidos / interesses / dados
  admin.html             # painel admin (guard via Supabase JWT)
  login.html             # login universal
  set-password.html      # invite + recovery
  admin-login.html       # → redirect /login.html
  central-do-cliente.html # → redirect /minha-conta.html
  js/
    main-components.js   # header dinâmico, modal auth, carrinho, footer
    admin-auth.js        # ESM module pro painel admin
    theme-config.js      # aplica tema (SSR + cache + revalidate)
    supabase-config.js   # gerado dinamicamente pelo backend
  img/logo-moro.webp
```

---

## Padrões de código

### Rotas (sempre asyncHandler + Zod)

```typescript
router.get("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;  // noUncheckedIndexedAccess
  const item = await prisma.model.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("Recurso");
  res.json(item);
}));

router.post("/", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = CreateXSchema.parse(req.body);
  // ...
}));
```

### Validação Zod v4

```typescript
// Zod v4: { error: "msg" } (não required_error)
// ZodError tem .issues (não .errors)
const schema = z.object({
  name: z.string({ error: "obrigatório" }).min(1),
  // pra Prisma: nullable + default(null) evita string|undefined no output
  field: z.string().nullish().transform((v): string | null => v ?? null),
});
```

### Erros

```typescript
throw new NotFoundError("Produto");   // → 404
throw new ConflictError("...");       // → 409
throw new AppError(400, "...");       // → status custom
// ZodError automático → 422 com lista de campos
// Prisma P2025 → 404, P2002 → 409
```

### Paginação

```typescript
const pageNum = Math.max(1, parseInt(String(req.query["page"] ?? "1")));
const limitNum = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
// resposta: { data, total, page, limit, totalPages }
// front: Array.isArray(raw) ? raw : (raw.data || [])
```

### Upload

```typescript
import { uploadFile, deleteFileByUrl } from "../lib/storage.js";

// POST
const imageUrl = req.file ? await uploadFile(req.file) : null;

// PUT (substitui)
if (req.file) {
  const previous = await prisma.x.findUnique({ ..., select: { imageUrl: true } });
  data.imageUrl = await uploadFile(req.file);
  await deleteFileByUrl(previous?.imageUrl);
}

// DELETE
const previous = await prisma.x.findUnique({ ..., select: { imageUrl: true } });
await prisma.x.delete({ where: { id } });
await deleteFileByUrl(previous?.imageUrl);
```

### TypeScript estrito

- `noUncheckedIndexedAccess: true` → `req.params["id"] as string`, `String(req.query["x"] ?? "default")`
- `exactOptionalPropertyTypes: true` → use `?? null` em campos opcionais Prisma; em Zod use `.nullish().transform((v): string | null => v ?? null)`

### Frontend (admin)

- Use o monkey-patch global de `window.fetch` no `<head>` pra Bearer automático
- Use `setVal/getVal/setSrc/showEl` (helpers null-safe) ao invés de `document.getElementById(...).value` direto

---

## Endpoints

```
GET    /api/health                                                → status

# Cliente [auth]
GET    /api/customer/me                                           → perfil + isAdmin
PUT    /api/customer/me                                           → atualiza
GET    /api/customer/orders                                       → pedidos do cliente

# Admin [admin]
GET    /api/admin/me                                              → admin atual
GET    /api/admin/users                                           → lista admins
POST   /api/admin/invite                                          → email de convite
DELETE /api/admin/users/:id                                       → revoga acesso

# Catálogo
GET    /api/categories
GET    /api/categories/:id
GET    /api/categories/:id/subcategories
POST   /api/categories                                  [admin]
PUT    /api/categories/:id                              [admin]
DELETE /api/categories/:id                              [admin]

GET    /api/subcategories
GET    /api/subcategories/:id
POST   /api/subcategories                               [admin]
PUT    /api/subcategories/:id                           [admin]
DELETE /api/subcategories/:id                           [admin]

GET    /api/products?page&limit&subCategoryId&categoryId
GET    /api/products/suggested?categoryIds
POST   /api/products                                    [admin]
PUT    /api/products/:id                                [admin]
DELETE /api/products/:id                                [admin]

# Pedidos
GET    /api/orders?page&limit                           [admin]
GET    /api/orders/track?identifier&orderNumber                   → público
GET    /api/orders/my-account                           [auth]
POST   /api/orders                                                → público (checkout)
PUT    /api/orders/:id                                  [admin]
DELETE /api/orders/:id                                  [admin]

# Config (tema da loja)
GET    /api/config
POST   /api/config                                      [admin]

# Pagamentos
GET    /api/payments/config                                       → sem secret
POST   /api/payments/config                             [admin]
POST   /api/payments/process
POST   /api/payments/webhook                                      → callback
```

Rate limiting: **100 req / 15min** por IP.

---

## Roadmap (em ordem de prioridade)

### Phase B (próxima)
- [ ] **Cupons & descontos** — modelo `Coupon` + UI admin + apply no checkout
- [ ] **Carrinho persistido + recuperação** — sync localStorage↔DB + email de carrinho abandonado
- [ ] **Newsletter & ofertas** — lista + dispatcher de email

### Médio prazo
- [ ] **Wishlist/Interesses funcional** (botão coração + UI minha-conta)
- [ ] **Busca de produtos** (`?q=termo`)
- [ ] **Tailwind self-hosted** (build local)
- [ ] **Subdomínio admin** (`admin.dominio.com.br`)
- [ ] **Testes** (Vitest + integração com banco real)

### Infraestrutura
- [ ] **Dockerfile + docker-compose**
- [ ] **CI/CD** (GitHub Actions)
- [ ] **Logs estruturados** (pino)
- [ ] **Índices no banco**

---

## Observações importantes

1. Banco vazio em dev → `npx prisma db push` é OK; com dados → `prisma migrate dev --create-only` + revisar SQL antes
2. Após mudar `prisma/schema.prisma`: `npx prisma db push && npx prisma generate`
3. Carrinho usa `localStorage` chave `eletrica_moro_cart`
4. Tema usa `localStorage` chave `eletrica_moro_theme` (cache anti-FOUC)
5. Em produção, `SUPABASE_*` e `DIRECT_URL` são obrigatórios — server falha no startup sem eles
6. Bucket `uploads` deve estar **Public** no Supabase Storage
7. Páginas com FOUC: NUNCA introduza fetch async de tema antes do first paint — use SSR
8. Auth: NUNCA reintroduza JWT custom ou bcrypt — Supabase Auth é a única fonte de verdade

---

## Política do agente nesta sessão

- Sempre rodar `npx tsc --noEmit` antes de commitar
- Avisar antes de pushar pro GitHub; com OK do usuário, pushar direto sem reconfirmar
- Nunca pushar com `--force`, em outras branches ou outros remotes sem pedido explícito
- Documentação na assinatura: SulCore (empresa de desenvolvimento), © 2026 SulCore
