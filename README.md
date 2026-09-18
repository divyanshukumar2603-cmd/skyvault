# CloudVault — Secure Analytical eCommerce Platform on AWS

CloudVault is a secure analytical eCommerce platform built on AWS services, pairing an enterprise-grade object storage tier with a personalized product ranking engine:
- **Commerce Analytics**: Conversion funnel with per-stage drop-off, category and catalogue performance, daily engagement trends, and self-measurement of the ranking engine (mean rank per action, catalogue coverage, engagement concentration).
- **Personalized Product Ranking**: Behaviour-driven catalogue ranking that learns from views, clicks, cart additions and purchases. Blends category affinity, brand affinity, price fit, popularity and rating, with 7-day exponential decay and a popularity-based cold-start path. Every result explains its own position.
- **Direct-to-Object-Storage Uploads**: Pre-signed URLs for high-performance direct uploads (up to 5 GB per file).
- **Automated File Versioning**: Automatic version numbering (`v1`, `v2`, `...`), timeline visualization, and point-in-time version restoration.
- **Dual Cloud Storage**: Seamlessly switches between local **MinIO** (development) and **AWS S3** (production) via simple environment variable configuration.
- **Bucket Replication & Resiliency**: Native AWS S3 replication in production (detected at boot), with an application-level sync loop as the fallback for MinIO or unconfigured buckets.
- **Automated & Scheduled Backups**: Daily midnight UTC backups via cron jobs, manual backup snapshots, and one-click disaster recovery.
- **Multi-Tenant Key-Prefix Isolation**: Scalable S3 key prefixes (`users/{userId}/...`) protecting tenant boundaries.
- **Modern Security & Authentication**: Argon2id password hashing, JWT access/refresh token rotation, Google & GitHub OAuth 2.0.
- **Glassmorphic Dark UI**: Built with Next.js 14/16 App Router, Tailwind CSS v4, Lucide icons, and Framer Motion.

---

## 🏗 System Architecture

```
                                  +-----------------------------+
                                  |   Frontend (Next.js App)    |
                                  |    Port 3000 (React 19)     |
                                  +--------------+--------------+
                                                 |
                       +-------------------------+-------------------------+
                       | REST API                                          | Pre-signed PUT/GET
                       v                                                   v
         +-----------------------------+                     +-----------------------------+
         |     Backend API (Express)   |                     |     Object Storage          |
         |    Port 4000 (TypeScript)   |                     |   (MinIO or AWS S3)         |
         +--------------+--------------+                     +--------------+--------------+
                        |                                                   |
         +--------------+--------------+                     +--------------+--------------+
         | PostgreSQL (Prisma 5.22)    |                     | Buckets:                    |
         | - Users & OAuth Accounts    |                     | - skyvault-primary          |
         | - Files & FileVersions      |                     | - skyvault-replica          |
         | - RefreshTokens & Backups   |                     | - skyvault-backups          |
         | - Products & Interactions   |                     |                             |
         +-----------------------------+                     +-----------------------------+
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20 or v24+
- **Docker & Docker Compose** (for running PostgreSQL + MinIO containerized)

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default local settings point to MinIO at `http://localhost:9000` and PostgreSQL at `localhost:5432`.

### 3. Run with Docker Compose
To spin up all services (PostgreSQL, MinIO, Backend, Frontend):
```bash
docker compose up -d
```
The init container will automatically initialize the MinIO buckets (`cloudvault-primary`, `cloudvault-replica`, `cloudvault-backups`) and enable bucket versioning.

### 4. Running Standalone (Local Development)

#### Backend:
```bash
cd backend
npm install
npx prisma generate
npm run dev
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

Access the application:
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (User: `minioadmin`, Password: `minioadmin123`)

---

## ☁️ Transitioning from MinIO to AWS S3 (Production)

The storage client in `backend/src/config/s3.ts` is dual-mode. To shift to AWS:

1. In `.env`:
   - **Remove or comment out** `S3_ENDPOINT` (or set to blank).
   - Set `AWS_REGION` (e.g., `us-east-1`).
   - Fill in your AWS IAM credentials:
     ```env
     # S3_ENDPOINT=
     AWS_REGION=us-east-1
     S3_ACCESS_KEY_ID=AKIA...
     S3_SECRET_ACCESS_KEY=wJalr...
     S3_PRIMARY_BUCKET=my-production-cloudvault-primary
     S3_REPLICA_BUCKET=my-production-cloudvault-replica
     S3_BACKUP_BUCKET=my-production-cloudvault-backups
     ```
2. In AWS S3:
   - Enable bucket versioning on `my-production-cloudvault-primary` and `my-production-cloudvault-replica`.
   - Set up S3 Cross-Region Replication (CRR) from primary to replica.
   - Configure S3 Lifecycle rule to transition backup bucket objects to Glacier after 90 days.

Zero backend code modifications are needed!

---

## 🧪 Testing

Run backend unit and integration test suites:
```bash
cd backend
npm run test
```

Typecheck frontend:
```bash
cd frontend
npx tsc --noEmit
```

Build production bundles:
```bash
cd backend && npm run build
cd frontend && npm run build
```

---

## 📚 API Reference
For complete endpoints, payloads, and request schemas, see [docs/api.md](docs/api.md).

---

## 🛒 Personalized Product Ranking

The analytical tier ranks the product catalogue per user. It is documented in full in
Section 6 of `PROJECT_REPORT.md`; in short:

| Signal | Weight in score | Notes |
|---|---|---|
| Category affinity | 0.40 | Learned from the user's own interactions |
| Brand affinity | 0.15 | Same computation, per brand |
| Price fit | 0.15 | Gaussian around the user's typical price point |
| Popularity | 0.20 | Log-damped, across all shoppers |
| Rating | 0.10 | The product's own customer rating |

### Measuring the ranking

The Analytics page holds the engine to account rather than assuming it works:

| Measure | Reads as |
|---|---|
| Mean rank per action | Purchases at a lower mean rank than views ⇒ the ordering surfaces what people buy |
| Catalogue coverage | Share of products getting any engagement — guards against starving the long tail |
| Top-5 concentration | Rising concentration with falling coverage ⇒ a popularity feedback loop |

Only interactions made through the ranked interface carry a position, so seeded demo
activity cannot inflate mean rank; the share that carried one is reported alongside.

Interaction weights are `VIEW=1`, `CLICK=3`, `CART=6`, `PURCHASE=10`, each decaying with a
seven-day half-life. Users with no history fall back to `0.65 × popularity + 0.35 × rating`.

### Seeding the catalogue

```bash
cd backend
npm run seed:products
```

This upserts 25 products across 6 categories and generates a baseline of demo shopper
activity so that popularity ranking has real data behind it. It is idempotent — re-running
regenerates the demo activity without duplicating products.

The deploy script runs this automatically after bringing containers up.

---

## 🚀 Deployment

```bash
./scripts/deploy-ec2.sh <EC2_PUBLIC_IP>   # provision + deploy + seed
node scripts/setup-s3.js <EC2_PUBLIC_IP>  # bucket replication, lifecycle, CORS
node scripts/list-s3.js                   # inspect what is actually in the buckets
```

`deploy-ec2.sh` is idempotent: it quiesces old containers, ensures swap and disk headroom,
installs Docker and a compatible buildx, syncs the project, rewrites the localhost URLs in
`.env` to the instance's public IP, then builds and starts the stack.
