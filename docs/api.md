# CloudVault API Documentation

Base URL: `http://localhost:4000/api` (or configured `PORT`)

All protected routes require an `Authorization: Bearer <access_token>` header. Refresh tokens are stored in HttpOnly cookies and can also be passed via the `/auth/refresh` endpoint.

---

## 1. Authentication Endpoints

### Register User
- **POST** `/auth/register`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!",
    "displayName": "Jane Doe"
  }
  ```
- **Response (201)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "cuid...",
      "email": "user@example.com",
      "displayName": "Jane Doe",
      "storageUsed": "0",
      "storageQuota": "10737418240"
    }
  }
  ```

### Login
- **POST** `/auth/login`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "accessToken": "eyJhbGciOi...",
    "user": { "id": "...", "email": "..." }
  }
  ```
  *Sets HttpOnly cookie `refreshToken`*.

### Refresh Token
- **POST** `/auth/refresh`
- **Body**: `{ "refreshToken": "optional-if-in-cookie" }`
- **Response (200)**:
  ```json
  {
    "success": true,
    "accessToken": "eyJhbGciOi..."
  }
  ```

### Current User Profile
- **GET** `/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200)**: Current user record including storage statistics and OAuth links.

### OAuth Endpoints
- **GET** `/auth/google` - Initiate Google OAuth 2.0 flow
- **GET** `/auth/google/callback` - OAuth callback URL
- **GET** `/auth/github` - Initiate GitHub OAuth flow
- **GET** `/auth/github/callback` - OAuth callback URL

---

## 2. File Operations Endpoints

### Get Pre-signed Upload URL
- **POST** `/files/upload-url`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "fileName": "document.pdf",
    "filePath": "documents/document.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1048576
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "uploadUrl": "http://localhost:9000/cloudvault-primary/users/...?X-Amz-Signature=...",
    "s3Key": "users/<userId>/documents/document.pdf/v1",
    "versionNumber": 1,
    "isNewFile": true
  }
  ```
  *Upload file directly to `uploadUrl` via HTTP PUT, then confirm.*

### Confirm Upload
- **POST** `/files/confirm-upload`
- **Body**:
  ```json
  {
    "s3Key": "users/<userId>/documents/document.pdf/v1",
    "fileName": "document.pdf",
    "filePath": "documents/document.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1048576,
    "checksum": "sha256-hex-digest"
  }
  ```
- **Response (201)**: File and FileVersion database records.

### List Files
- **GET** `/files?page=1&limit=20&search=doc`
- **Response (200)**: Paginated file list with total file counts and current version.

### Download File
- **GET** `/files/:id`
- **Response (200)**: Metadata and pre-signed GET download URL.

### Soft Delete & Trash
- **DELETE** `/files/:id` - Moves file to trash (`isDeleted: true`)
- **GET** `/files/trash` - Lists files in trash
- **POST** `/files/:id/restore` - Restores file from trash
- **DELETE** `/files/:id/hard-delete` - Permanently purges object from S3 and database

### Storage Stats
- **GET** `/files/stats`
- **Response (200)**: Used bytes, quota, percentage, and total files count.

---

## 3. Versioning Endpoints

### List File Versions
- **GET** `/files/:id/versions`
- **Response (200)**: List of all version iterations (`v1`, `v2`, `v3`...) with file size, upload timestamp, and checksum.

### Download Specific Version
- **GET** `/files/:id/versions/:versionId`
- **Response (200)**: Pre-signed GET URL for that specific version snapshot.

### Restore Past Version
- **POST** `/files/:id/versions/:versionId/restore`
- **Response (200)**: Clones past version snapshot as a new version `v(n+1)`.

---

## 4. Replication & Backup Endpoints

### Replication Status
- **GET** `/replication/status`
- **Response (200)**: Replication target bucket, primary objects count, replica objects count, sync lag.

### Trigger Replication Sync
- **POST** `/replication/trigger`
- **Response (200)**: Manually synchronizes objects between primary and replica bucket.

### List Backups
- **GET** `/backups`
- **Response (200)**: List of historical snapshot dumps.

### Trigger Manual Backup
- **POST** `/backups/trigger`
- **Response (200)**: Initiates snapshot dump to backup bucket.

### Restore from Backup
- **POST** `/backups/:id/restore`
- **Response (200)**: Restores all files from a backup snapshot.

---

## 5. Product Ranking Endpoints

All endpoints require a valid `Authorization: Bearer <accessToken>` header. Behavioural
data is scoped to the authenticated user: one shopper's signals never alter another
shopper's profile, only aggregate popularity.

### Ranked Catalogue
- **GET** `/products`
- **Query**: `category` (optional), `search` (optional), `limit` (optional, default 60)
- **Response (200)**:
```json
{
  "success": true,
  "data": {
    "personalized": true,
    "signalCount": 4,
    "products": [
      {
        "id": "p-home-02",
        "name": "Hearth Pour-Over Kettle",
        "category": "Home",
        "brand": "Hearth",
        "price": 119,
        "rating": 4.6,
        "ratingCount": 1876,
        "rank": 1,
        "score": 0.9718,
        "reason": "You browse Home often",
        "breakdown": {
          "category": 0.4,
          "brand": 0.15,
          "price": 0.1418,
          "popularity": 0.1979,
          "rating": 0.092
        }
      }
    ]
  }
}
```
`personalized` is `false` when the caller has no interaction history; in that case the
`category`, `brand` and `price` contributions are all `0` and ranking falls back to
popularity and rating.

### Category Facets
- **GET** `/products/categories`
- **Response (200)**: `[{ "category": "Audio", "count": 3 }, ...]`

### Taste Profile
- **GET** `/products/insights`
- **Response (200)**: The caller's derived profile — top categories and brands with
  normalised affinity weights, preferred price, price spread, and interaction counts by type.

### Single Product
- **GET** `/products/:id`
- **Response (200)**: The product with its personalized score, reason and breakdown.
- **Errors**: `404` if no such product.

### Record Interaction
- **POST** `/products/:id/interactions`
- **Body**: `{ "type": "VIEW" | "CLICK" | "CART" | "PURCHASE" }`
- **Response (201)**: `{ "recorded": true, "type": "PURCHASE" }`
- **Errors**: `400` for an unrecognised type, `404` if no such product.

Weights: `VIEW=1`, `CLICK=3`, `CART=6`, `PURCHASE=10`. Each signal decays with a
seven-day half-life, and signals older than 90 days are excluded from scoring.

### Reset History
- **DELETE** `/products/history`
- **Response (200)**: `{ "deleted": 4 }` — clears the caller's signals, returning them
  to the cold-start ranking path.


---

## 6. Analytics Endpoints

All endpoints require authentication and accept an optional `days` query parameter
(1–365, default 30) defining the analysis window.

### Dashboard
- **GET** `/analytics`
- Returns `overview`, `funnel`, `topProducts`, `categories`, `trend` and
  `effectiveness` in a single round trip — what the Analytics page loads.

### Overview
- **GET** `/analytics/overview`
- Catalogue size, active shoppers, shoppers with history, interaction volume, and
  storage-tier totals (files, bytes, versions, backup snapshots).

### Conversion Funnel
- **GET** `/analytics/funnel`
- **Response (200)**:
```json
{
  "windowDays": 30,
  "stages": [
    { "stage": "VIEW",     "count": 203, "stepConversion": 1,     "overallConversion": 1 },
    { "stage": "CLICK",    "count": 94,  "stepConversion": 0.463, "overallConversion": 0.463 },
    { "stage": "CART",     "count": 38,  "stepConversion": 0.404, "overallConversion": 0.187 },
    { "stage": "PURCHASE", "count": 26,  "stepConversion": 0.684, "overallConversion": 0.128 }
  ],
  "revenue": 5720,
  "orders": 26,
  "averageOrderValue": 220
}
```
`stepConversion` is the share of the stage immediately above; `overallConversion`
is the share of the top of the funnel.

### Top Products
- **GET** `/analytics/top-products?limit=10`
- Catalogue leaderboard by time-decayed weighted engagement, with units sold,
  revenue and per-product view→purchase conversion.

### Category Performance
- **GET** `/analytics/categories`
- Per-category interactions, views, purchases, revenue and conversion rate.

### Engagement Trend
- **GET** `/analytics/trend?days=14`
- Daily counts per signal type, zero-filled so the series is continuous.

### Ranking Effectiveness
- **GET** `/analytics/ranking-effectiveness`
- **Response (200)**:
```json
{
  "meanRankByType": { "VIEW": 8.0, "CLICK": 1.0, "CART": 1.3, "PURCHASE": 1.0 },
  "measuredShare": 0.039,
  "catalogueCoverage": 1,
  "top5Concentration": 0.366,
  "totalInteractions": 361
}
```
`meanRankByType` counts only interactions that carried a position (`rank` in the
interaction payload). `measuredShare` reports what fraction that was, so the
sample behind the mean is never hidden.
