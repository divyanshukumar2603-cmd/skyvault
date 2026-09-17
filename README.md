# CloudVault — Secure Multi-Tier Cloud Storage Platform

CloudVault is an enterprise-grade cloud object storage web application featuring:
- **Direct-to-Object-Storage Uploads**: Pre-signed URLs for high-performance direct uploads (up to 5 GB per file).
- **Automated File Versioning**: Automatic version numbering (`v1`, `v2`, `...`), timeline visualization, and point-in-time version restoration.
- **Dual Cloud Storage**: Seamlessly switches between local **MinIO** (development) and **AWS S3** (production) via simple environment variable configuration.
- **Bucket Replication & Resiliency**: Continuous synchronization to a replica bucket (simulating AWS Cross-Region Replication locally and native S3 CRR in production).
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
         | - Users & OAuth Accounts    |                     | - cloudvault-primary        |
         | - Files & FileVersions      |                     | - cloudvault-replica (CRR)  |
         | - RefreshTokens & Backups   |                     | - cloudvault-backups        |
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
