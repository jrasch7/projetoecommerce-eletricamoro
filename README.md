# Elétrica Moro · E-commerce + Gestão

Plataforma de e-commerce com painel administrativo completo para a **Elétrica Moro** (Novo Hamburgo, RS). Catálogo de materiais elétricos com gestão de estoque, pedidos, clientes e personalização visual em tempo real.

Sistema desenvolvido por **[SulCore](https://sulcore.com)**.

---

## 🚀 Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js (ESM, `"type": "module"`) |
| Linguagem | TypeScript 5.9 estrito (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) |
| Framework | Express 4 |
| ORM | Prisma 7 com adaptador `@prisma/adapter-pg` |
| Banco | PostgreSQL (Supabase) |
| **Autenticação** | **Supabase Auth** (login email+senha, recuperação, convites por email) |
| **Storage** | **Supabase Storage** (bucket público `uploads`, persistente em produção) |
| Validação | Zod v4 |
| Upload | Multer (memoryStorage → Supabase Storage) |
| Segurança | Helmet, express-rate-limit, CORS configurável |
| Frontend | HTML + Vanilla JS + Tailwind CSS (CDN) |
| Charts | Chart.js (dashboards admin) |
| Ícones | Phosphor Icons |

---

## 🏗️ Arquitetura

### Auth unificada (Supabase Auth)

Um único sistema de auth gerencia clientes e administradores. A diferenciação é via `user_metadata.is_admin` no Supabase. **Sem dois logins, sem código de password local** — Supabase cuida de hash, recovery, MFA, emails.

```
┌──────────────────────────────────────────────┐
│ Modal de login na loja (main-components.js) │
└──────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   user_metadata        user_metadata
   .is_admin = true     .is_admin = false (default)
        │                       │
        ▼                       ▼
   /admin.html           /minha-conta.html
   + Painel admin        + Pedidos / Interesses / Dados
```

- `requireAuth` middleware: valida JWT Supabase, qualquer usuário logado passa
- `requireAdmin` middleware: extends + exige `is_admin === true`
- Frontend: `window.AppCore.openAuthModal()`, `window.adminAuth.requireAdmin()`

### Storage persistente

Imagens vão direto para o **bucket Supabase**, não para o disco local. URLs públicas persistem entre deploys (essencial em hosts com filesystem efêmero como Vercel/Railway).

- Upload: `multer.memoryStorage()` → `uploadFile(buffer)` → Supabase Storage
- Cleanup automático: ao substituir/deletar imagem, o arquivo antigo é removido do bucket
- Migração de imagens locais: `npx tsx scripts/migrate-uploads.ts`

### Anti-FOUC (zero flash de cores)

Personalização de tema (cores primária/secundária/acento, fonte, logo) é gerenciada via DB e injetada server-side no `<head>` antes do primeiro paint. Estratégia em camadas:

1. **SSR**: backend injeta `<style>:root{...}</style>` + `<script id="ssr-config">{...}</script>` no `<head>`
2. **localStorage cache**: tema da última visita aplicado sincronicamente em fallback
3. **Background revalidate**: fetch `/api/config` em background, atualiza só se mudou

### Painel administrativo (`/admin.html`)

Acesso restrito a usuários com `is_admin: true`. Inclui:

- Dashboard: faturamento, ticket médio, produtos críticos, top vendas (Chart.js)
- Produtos: CRUD com upload múltiplo de imagens, variantes, filtros
- Categorias / Subcategorias: CRUD com foto
- Pedidos: lista paginada, atualização de status
- Personalização: cores, fonte, banners, logo, favicon, redes sociais, SEO
- Pagamentos: configuração de provedor (PagBank, Mercado Pago, Cielo, WhatsApp)
- **Equipe**: lista de admins + convite por email + revogar acesso

---

## 📋 Funcionalidades

**Loja**
- Catálogo paginado com filtros por categoria/subcategoria
- Carrosséis dinâmicos (destaques, "para sua casa")
- Página de produto com galeria, variantes (voltagem/cor), produtos sugeridos
- Carrinho local (localStorage), checkout transparente PagBank
- Login/cadastro inline (modal) — clientes acessam Meus Pedidos / Interesses / Dados
- Recuperação de senha por email (Supabase)

**Painel admin**
- Tudo da loja + gestão completa
- Convite de novos colaboradores por email (sem cadastro manual)
- Histórico de último acesso por admin
- Logout seguro com revogação de sessão

---

## 🛠️ Setup local

### 1. Variáveis de ambiente

Crie `.env` na raiz (não comitar):

```env
# PostgreSQL via Supabase
DATABASE_URL="postgresql://postgres.xxx:senha@aws-...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:senha@aws-...pooler.supabase.com:5432/postgres"

# Supabase Auth + Storage
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_KEY="eyJ..."
SUPABASE_STORAGE_BUCKET="uploads"

# App
PORT=3000
CORS_ORIGIN="*"
NODE_ENV="development"
```

### 2. No painel Supabase

- **Authentication → Providers → Email**: ligado, "Confirm email" OFF (recomendado em dev)
- **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/login.html`, `http://localhost:3000/set-password.html`
- **Storage**: criar bucket `uploads` marcado como **Public**

### 3. Instalar e rodar

```bash
npm install
npx prisma db push          # sincroniza schema
npx prisma generate         # gera cliente
npm run dev                 # servidor com hot-reload
```

### 4. Criar primeiro admin

No SQL Editor do Supabase:

```sql
-- Após convidar seu email via Authentication → Users → Invite,
-- ou criar via cadastro normal na loja, marque como admin:
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
WHERE email = 'seu-email@dominio.com';
```

Depois disso, faça login normal na loja → o dropdown de "Minha conta" passa a mostrar **"Painel administrativo"**.

---

## 📂 Estrutura

```
src/
  server.ts                      # entry point — valida env e inicia
  app.ts                         # Express setup + SSR theme injection
  lib/
    prisma.ts                    # singleton PrismaClient (adapter-pg)
    supabase.ts                  # clients admin (service_role) + public (anon)
    storage.ts                   # uploadFile() + deleteFileByUrl() helpers
    errors.ts                    # AppError, NotFoundError, ConflictError
    asyncHandler.ts              # wrapper async pra rotas
  middleware/
    error.ts                     # handler global (Zod→422, Prisma→404/409)
    upload.ts                    # multer memoryStorage + filtro de imagens
    requireAuth.ts               # valida JWT Supabase (qualquer usuário)
    requireAdmin.ts              # exige user_metadata.is_admin
  routes/
    categories.ts                # CRUD (write protegido)
    subcategories.ts             # CRUD (write protegido)
    products.ts                  # CRUD paginado (write protegido)
    orders.ts                    # GET admin / GET /track público / POST público
    customer.ts                  # /me, PUT /me, /orders (cliente logado)
    admin.ts                     # /me, /users, /invite, DELETE /users/:id
    config.ts                    # tema da loja (write admin)
    payments.ts                  # config de provedor + webhook
  schemas/                       # Zod schemas por entidade
  generated/prisma/              # cliente Prisma gerado (não editar)

scripts/
  migrate-uploads.ts             # migra public/uploads/ → Supabase Storage

prisma/
  schema.prisma                  # Product, Category, SubCategory, Order,
                                 #  Customer, ProductVariant, StoreConfig,
                                 #  PaymentConfig
  seed.ts                        # seed inicial

public/
  index.html                     # home (carrosséis, hero, categorias)
  categoria.html                 # listagem por categoria
  produto.html                   # detalhe + variantes + sugeridos
  checkout.html                  # checkout transparente
  sucesso.html                   # confirmação pós-compra
  minha-conta.html               # área do cliente (pedidos / interesses / dados)
  admin.html                     # painel admin
  login.html                     # login universal (cliente + admin)
  set-password.html              # destino de invite/recovery
  central-do-cliente.html        # redirect → /minha-conta.html
  admin-login.html               # redirect → /login.html
  js/
    main-components.js           # header, footer, carrinho, modal de auth
    admin-auth.js                # módulo ESM pro painel admin
    theme-config.js              # aplica tema (SSR + cache)
    supabase-config.js           # gerado dinâmicamente pelo backend
  img/logo-moro.webp
```

---

## 🔌 API

```
GET    /api/health                                → status

# Auth (Supabase, frontend chama supabase-js direto)
# /api/auth/* não existe mais — auth é via supabase-js

# Cliente
GET    /api/customer/me              [auth]       → perfil + isAdmin
PUT    /api/customer/me              [auth]       → atualiza perfil
GET    /api/customer/orders          [auth]       → pedidos do cliente

# Admin
GET    /api/admin/me                 [admin]      → admin atual
GET    /api/admin/users              [admin]      → lista admins
POST   /api/admin/invite             [admin]      → envia convite por email
DELETE /api/admin/users/:id          [admin]      → revoga acesso

# Catálogo
GET    /api/categories                            → lista
GET    /api/categories/:id                        → detalhe
GET    /api/categories/:id/subcategories          → subcategorias
POST   /api/categories               [admin]      → multipart (name, photo?)
PUT    /api/categories/:id           [admin]      → multipart
DELETE /api/categories/:id           [admin]

GET    /api/subcategories                         → lista
GET    /api/subcategories/:id                     → detalhe
POST   /api/subcategories            [admin]
PUT    /api/subcategories/:id        [admin]
DELETE /api/subcategories/:id        [admin]

GET    /api/products?page&limit&subCategoryId&categoryId  → paginado
GET    /api/products/suggested?categoryIds                → sugeridos
POST   /api/products                 [admin]      → multipart + images[]
PUT    /api/products/:id             [admin]
DELETE /api/products/:id             [admin]

# Pedidos
GET    /api/orders                   [admin]      → paginado
GET    /api/orders/track             público      → busca por id+email/cpf
POST   /api/orders                   público      → checkout
PUT    /api/orders/:id               [admin]
DELETE /api/orders/:id               [admin]

# Config (loja)
GET    /api/config                                → tema, banners, redes
POST   /api/config                   [admin]      → atualiza

# Pagamentos
GET    /api/payments/config                       → provedor ativo (sem secret)
POST   /api/payments/config          [admin]      → atualiza
POST   /api/payments/process                      → processa pagamento
POST   /api/payments/webhook                      → callback do provedor
```

Rate limit: **100 req / 15min** por IP em `/api/*`.

---

## 📜 Comandos

```bash
npm run dev                          # tsx watch (hot-reload)
npm run build                        # tsc → dist/
npm start                            # produção (node dist/server.js)

npx prisma db push                   # sincroniza schema
npx prisma generate                  # regenera cliente
npx prisma studio                    # GUI do banco
npx tsc --noEmit                     # type-check sem emitir

npx tsx scripts/migrate-uploads.ts   # migra imagens locais → Supabase Storage
```

---

## 🚦 Roadmap

### Próximos
- [ ] **Cupons & descontos** (modelo `Coupon` + UI admin + apply no checkout)
- [ ] **Carrinho persistido + recuperação de venda** (sync com DB + email de carrinho abandonado)
- [ ] **Newsletter & ofertas** (lista + dispatcher de email)
- [ ] **Wishlist/Interesses** (botão coração nos produtos + UI em minha-conta)

### Médio prazo
- [ ] **Busca de produtos** (`?q=termo` com Prisma `contains` + índice)
- [ ] **Tailwind self-hosted** (substituir CDN por build local pra remover warning)
- [ ] **Subdomínio admin** (`admin.eletricamoro.com.br`)
- [ ] **Testes automatizados** (Vitest + integração com banco real)
- [ ] **CI/CD** (GitHub Actions: tsc + tests em cada PR)

### Infra
- [ ] **Dockerfile + docker-compose** pra ambiente de dev
- [ ] **Logs estruturados** (pino ou winston)
- [ ] **Índices no banco** (campos de busca frequente)

---

## ⚠️ Observações

1. O cliente Prisma fica em `src/generated/prisma/` — gerado, não editar
2. Após mudar `prisma/schema.prisma`: `npx prisma db push && npx prisma generate`
3. Carrinho usa `localStorage` chave `eletrica_moro_cart`
4. Tema usa `localStorage` chave `eletrica_moro_theme` (cache anti-FOUC)
5. Em produção, **`SUPABASE_*` deve estar definido** — sem isso o servidor não sobe
6. Bucket Supabase `uploads` precisa estar **Public** pra `<img src>` funcionar direto

---

## 🔗 Links

- **Repositório:** https://github.com/jrasch7/projetoecommerce
- **SulCore:** https://sulcore.com — sistema desenvolvido por
- **Branch principal:** `main`

© 2026 SulCore · Todos os direitos reservados
