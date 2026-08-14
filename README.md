# 🔐 NotesVault — Secure Expiring Note-Sharing Web App

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Hono.js](https://img.shields.io/badge/Hono-4.6-orange?style=flat-square&logo=hono)](https://hono.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.19-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

A production-aware, high-performance web application for creating and sharing self-destructing, password-protected, and time-expiring notes. Features **atomic race-condition prevention**, **SHA-256 token hashing**, **sliding-window rate limiting**, and **HTTP-only cookie authentication**.

---

## 📋 Table of Contents

- [🚀 Key Features](#-key-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🏗️ System Architecture & Data Flow](#️-system-architecture--data-flow)
- [📂 Directory Structure](#-directory-structure)
- [⚙️ Local Setup Instructions](#️-local-setup-instructions)
- [🧪 Testing Race-Condition Handling](#-testing-race-condition-handling)
- [🔌 API Reference](#-api-reference)
- [📊 Database Schema](#-database-schema)
- [🎯 Technical Interview Q&A](#-technical-interview-qa)
- [🌐 Live Database & Production Deployment](#-live-database--production-deployment)
- [🔒 Security Audit & Best Practices](#-security-audit--best-practices)

---

## 🚀 Key Features

### 🔐 Security & Authentication
- **Secure Authentication**: Email & password authentication with `bcryptjs` password hashing and session tokens delivered via `httpOnly`, `sameSite=Lax` cookies. Zero sensitive tokens stored in `localStorage`.
- **Cryptographic Token Generation**: 256-bit entropy share tokens generated using Node.js `crypto.randomBytes(32)` (64-character hexadecimal strings).
- **One-Way Token Hashing**: Raw tokens exist only in client share URLs. The backend computes and stores SHA-256 token hashes in PostgreSQL (`tokenHash` indexed B-Tree for $O(1)$ lookup performance).
- **Password-Protected Shares**: Optional 12-character random access key (`crypto.randomBytes(9)`), hashed with `bcrypt`. Plaintext keys are presented to the owner **once** upon creation and never stored.
- **Brute-Force Protection**: In-memory IP + token sliding window throttling (maximum 5 failed password attempts per 15-minute window with dynamic cooldown feedback).

### ⚡ Concurrency & Lifecycle Management
- **One-Time Read & Self-Destruct**: Shares marked `ONE_TIME` immediately self-destruct after their initial successful view.
- **Atomic Race-Condition Prevention**: Employs PostgreSQL row-level locking via conditional queries (`UPDATE ... WHERE usedAt IS NULL AND revokedAt IS NULL`) to guarantee zero double-claims under concurrent load.
- **Time-Based Expiration**: Configurable note lifetimes (1h, 12h, 24h, 3d, 7d). Server strictly validates expiration timestamp (`expiresAt`) against current UTC database time.
- **Instant Revocation**: Owners can immediately revoke active share links at any time (`POST /api/shares/:id/revoke`).
- **Accurate View Counting**: Server-side atomic view increment (`viewCount: { increment: 1 }`). Failed access attempts (wrong password, expired token, revoked link) do **not** inflate view counts.
- **Dynamic Origin Detection**: Detects client origin dynamically from HTTP proxy headers (`x-forwarded-host`, `x-forwarded-proto`) and environment variables (`NEXT_PUBLIC_APP_URL`).

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 14 (App Router) | Full-stack React framework & routing |
| **API Server** | Hono.js (`@hono/node-server`) | Fast, lightweight, type-safe API routing |
| **Database** | PostgreSQL | Relational database with atomic ACID transactions |
| **ORM** | Prisma ORM 5 | Schema modeling, migrations, and type-safe query building |
| **Styling** | Tailwind CSS + Lucide Icons | Modern visual styling and iconography |
| **Security** | `crypto` + `bcryptjs` + `jsonwebtoken` | Token generation, secret hashing, JWT session auth |
| **Test Runner** | `tsx` | Direct execution of TypeScript test suites |

---

## 🏗️ System Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        User["User / Recipient"]
        Browser["Browser Application"]
    end

    subgraph Server ["Next.js + Hono API Layer"]
        Router["Hono API Router (/api)"]
        AuthMiddleware["JWT Auth Middleware"]
        RateLimiter["Sliding Window Rate Limiter"]
        CryptoLib["Crypto Utility (SHA-256 / Bcrypt)"]
    end

    subgraph Database ["Data Layer"]
        PostgreSQL[("PostgreSQL Database")]
    end

    User -->|Access Share URL| Browser
    Browser -->|GET /api/share/:token| Router
    Router --> RateLimiter
    RateLimiter -->|Pass| CryptoLib
    CryptoLib -->|Hash Raw Token -> tokenHash| PostgreSQL
    PostgreSQL -->|Fetch Metadata| Router
    Router -->|Return Title & Access Options| Browser

    Browser -->|POST /api/share/:token/unlock| Router
    Router -->|Atomic Update query| PostgreSQL
    PostgreSQL -->|Check usedAt IS NULL & Lock Row| PostgreSQL
    PostgreSQL -->|Return count: 1| Router
    Router -->|Return Note Content| Browser
```

---

## 📂 Directory Structure

```
Notes Web App/
├── prisma/
│   └── schema.prisma         # Database schema (User, Note, ShareLink models)
├── scripts/
│   └── test-race-condition.ts # Automated concurrent race condition verification test
├── src/
│   ├── app/                  # Next.js App Router pages & API mount
│   │   ├── api/              # Catch-all Hono route handler ([...paths])
│   │   ├── login/            # User authentication page
│   │   ├── notes/            # Owner notes dashboard & creation UI
│   │   ├── register/         # User registration page
│   │   ├── share/            # Public note view & unlock UI
│   │   ├── globals.css       # Global styles & Tailwind configuration
│   │   ├── layout.tsx        # Base root layout component
│   │   └── page.tsx          # Hero landing page
│   ├── components/           # UI components (Navbar, NoteCard, CreateModal, etc.)
│   ├── lib/                  # Shared core utilities
│   │   ├── auth.ts           # JWT sign/verify & HTTP-only cookie handlers
│   │   ├── crypto.ts         # SHA-256 token hashing & Bcrypt secret utilities
│   │   ├── db.ts             # Prisma client singleton instance
│   │   └── rate-limit.ts     # In-memory sliding window rate limiter
│   └── server/
│       └── app.ts            # Core Hono API routing logic & handlers
├── .env.example              # Sample environment configuration template
├── package.json              # Project dependencies & npm run scripts
├── tailwind.config.ts        # Tailwind CSS design system configuration
└── tsconfig.json             # TypeScript compilation settings
```

---

## ⚙️ Local Setup Instructions

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: Running locally (`localhost:5432`) or a remote database URL

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd "Notes Web App"
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root based on `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/notes_db?schema=public"
JWT_SECRET="super-secret-jwt-key-notes-app-2026"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Database Initialization & Schema Push
```bash
# Synchronize Prisma schema with database
npm run db:push

# Generate Prisma Client types
npx prisma generate
```

### 4. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

### 📜 Available NPM Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Launch Next.js local development server |
| `npm run build` | Generate Prisma Client and build production bundle |
| `npm run start` | Start production build server |
| `npm run lint` | Run ESLint static analysis checks |
| `npm run db:push` | Push schema changes directly to PostgreSQL |
| `npm run db:studio` | Open interactive Prisma Studio GUI database inspector |
| `npm run test:race` | Execute automated atomic race-condition test suite |
| `npm run test:shares` | Execute automated independent multiple share links test suite |

---

## 🧪 Testing Race-Condition Handling

To verify that concurrent access attempts against a `ONE_TIME` link result in **exactly 1 success** and **1 failure** with `viewCount = 1`, run the test suite:

```bash
npm run test:race
```

### Sample Output Log:
```text
🧪 --- STARTING ATOMIC RACE CONDITION TEST ---

Created ONE_TIME ShareLink ID: cmsslhyhk0003ar3dw0i13c2i
Raw Token: 372588bc5ca8a85f2a4443bde7cf87dd60d0b7b612d9cef8f9cf4c3c49b5b5f9
⚡ Launching 2 SIMULTANEOUS concurrent requests against the ONE_TIME share link...

--- REQUEST RESULTS ---
Request A: { requestId: 'Request A', success: true, title: '...', content: '...' }
Request B: { requestId: 'Request B', success: false, error: 'This share link has already been used.' }

--- FINAL DATABASE STATE ---
viewCount: 1
usedAt: Fri Aug 14 2026 12:27:58 GMT+0530

✅ [SUCCESS] RACE CONDITION TEST PASSED!
Guaranteed by PostgreSQL atomic conditional update (usedAt IS NULL).
```

---

## 🔌 API Reference

### Auth Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new account & set HTTP-only cookie | No |
| `POST` | `/api/auth/login` | Authenticate user & set HTTP-only cookie | No |
| `POST` | `/api/auth/logout` | Clear authentication cookie session | No |
| `GET` | `/api/auth/me` | Return active authenticated user session | Yes |

### Note & Share Management Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/notes` | Create a note and generate share link | Yes |
| `GET` | `/api/notes` | List all notes belonging to authenticated user | Yes |
| `GET` | `/api/notes/:id` | Get note detail and full share link history | Yes |
| `POST` | `/api/notes/:id/regenerate-share` | Generate new share link (revoking previous) | Yes |
| `POST` | `/api/shares/:id/revoke` | Revoke specific share link | Yes |

### Public Share Access Endpoints

| Method | Endpoint | Description | Rate Limited |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/share/:token` | Inspect share metadata (title, expiry, access type) | No |
| `POST` | `/api/share/:token/unlock` | Unlock & claim note content (requires password if protected) | Yes (5/15m) |

---

## 📊 Database Schema

```prisma
enum ShareType {
  ONE_TIME
  TIME_BASED
}

enum AccessType {
  PUBLIC
  PASSWORD_PROTECTED
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  notes        Note[]
}

model Note {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  content   String      @db.Text
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  shares    ShareLink[]

  @@index([userId])
}

model ShareLink {
  id           String     @id @default(cuid())
  noteId       String
  note         Note       @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tokenHash    String     @unique
  rawToken     String?
  shareType    ShareType
  accessType   AccessType
  passwordHash String?
  expiresAt    DateTime?
  usedAt       DateTime?
  revokedAt    DateTime?
  viewCount    Int        @default(0)
  createdAt    DateTime   @default(now())

  @@index([tokenHash])
  @@index([noteId])
}
```

---

## 🎯 Technical Interview Q&A

### 1. How do you prevent two users from using a one-time link at the same time?

**Answer:**
We explicitly avoid the naive `SELECT -> check usedAt -> UPDATE` application pattern because two concurrent requests reading `usedAt = NULL` simultaneously will both proceed, creating a double-claim race condition.

Instead, we execute an **atomic conditional UPDATE** query directly against PostgreSQL using Prisma's `updateMany`:

```typescript
const claimResult = await db.shareLink.updateMany({
  where: {
    id: shareLink.id,
    usedAt: null,
    revokedAt: null,
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } }
    ]
  },
  data: {
    usedAt: new Date(),
    viewCount: { increment: 1 }
  }
});

if (claimResult.count === 0) {
  return c.json({ error: "This share link has already been used." }, 410);
}
```

PostgreSQL executes row-level locking during the `UPDATE`. The first request to arrive acquires the lock, matches `usedAt IS NULL`, sets `usedAt = NOW()`, increments `viewCount`, and returns `count = 1`. The second concurrent request waiting on the row lock evaluates the `WHERE usedAt IS NULL` clause after the first transaction completes, fails to match any row (`count = 0`), and is cleanly rejected with a `410 Gone` HTTP status.

---

### 2. How do you update view count safely under high concurrency?

**Answer:**
We avoid reading `viewCount` into application memory and writing back `viewCount + 1`, which suffers from lost updates under concurrency.

Instead, we execute atomic database-side increments:
- **`TIME_BASED` Shares**: `db.shareLink.update({ where: { id }, data: { viewCount: { increment: 1 } } })`
- **`ONE_TIME` Shares**: The increment occurs within the atomic conditional claim (`data: { usedAt: new Date(), viewCount: { increment: 1 } }`).
- **Failed Access Attempts**: Incorrect passwords, expired tokens, or revoked links abort early before executing the update query, guaranteeing `viewCount` reflects only valid views.

---

### 3. How would this system scale to 1 million concurrent users?

**Answer:**
To support high traffic workloads:

1. **Stateless Web Layer**: Next.js + Hono application nodes are completely stateless (sessions rely on HTTP-only JWT cookies), allowing simple horizontal scaling behind AWS ALB / NGINX load balancers.
2. **Indexed Lookups**: The `tokenHash` column is indexed using a B-Tree (`@@index([tokenHash])`), ensuring constant $O(1)$ query lookup speeds regardless of table size.
3. **Database Connection Pooling**: Utilize **PgBouncer** or **Prisma Accelerate** to manage PostgreSQL connection pools and prevent worker thread exhaustion.
4. **Metadata Caching with Redis**: Cache public metadata (e.g. share type, expiration state, password requirement) in **Redis** with short TTLs to reduce database read load.
5. **Database-Level One-Time Claims**: **One-time claims MUST NOT be cached in Redis in a manner that allows race conditions.** The conditional `UPDATE ... WHERE usedAt IS NULL` MUST execute directly on PostgreSQL to preserve ACID consistency.

---

### 4. How do you prevent brute-force attacks on password-protected links?

**Answer:**
We implement a **Sliding Window Rate Limiter** (`src/lib/rate-limit.ts`) keyed by `ip + tokenHash`:
- Restricts password unlock attempts to **5 failures per 15-minute window**.
- On failed verification, `recordFailedAttempt(key)` increments failure records and returns a `429 Too Many Requests` error with remaining cooldown seconds.
- Successful authentication clears the rate limiter bucket.
- **Distributed Scaling**: For multi-server deployments, swap the in-memory `Map` with **Upstash Redis** or **Redis `INCR` + `EXPIRE`** for cross-node state synchronization.

---

## 🌐 Live Database & Production Deployment

### 1. Cloud PostgreSQL Connection (`DATABASE_URL`)
NotesVault connects to any hosted cloud PostgreSQL provider:
- **Neon Tech**: `postgresql://user:password@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require`
- **Supabase**: `postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres?sslmode=require`
- **Railway / Render**: `postgresql://postgres:pass@host:5432/railway`

Run schema synchronization:
```bash
npx prisma db push
```

### 2. Deploying to Vercel / Render / Cloud
1. Push repository to GitHub.
2. Import project into **Vercel** or **Render**.
3. Configure Environment Variables:
   - `DATABASE_URL`: Cloud PostgreSQL connection string
   - `JWT_SECRET`: High-entropy random secret key
   - `NEXT_PUBLIC_APP_URL`: Production domain URL (e.g. `https://notes-vault.vercel.app`)
4. Set Build Command: `npx prisma generate && next build`
5. Deployment complete! Generated share links will automatically adapt to your live production domain.

---

## 🔒 Security Audit & Best Practices

- [x] **HTTP-Only Cookies**: JWT auth tokens stored in `httpOnly`, `sameSite=Lax`, `secure` cookies to eliminate XSS token theft.
- [x] **Cryptographic Entropy**: Node.js `crypto.randomBytes` used for all token & key generations (never `Math.random()`).
- [x] **SHA-256 Hashing**: Raw share tokens are never stored in database tables.
- [x] **Bcrypt Password Storage**: User passwords and share access keys hashed with `bcrypt` (10 salt rounds).
- [x] **Strict Server Validation**: Expiry, revocation, password matching, and one-time consumption are strictly enforced server-side.

---

<p center>Crafted with 🔐 security and ⚡ speed in mind.</p>

