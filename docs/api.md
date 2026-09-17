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
