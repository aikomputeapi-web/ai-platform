# AI Chat Feature Documentation

## Overview

The AI Chat feature (`/dashboard/chat`) provides a full-featured chat interface that:

- Streams responses from all major AI providers (OpenAI, Anthropic, Google Gemini, and more) through OmniRoute
- Saves conversation history per user in PostgreSQL
- Supports image and document uploads via private S3-compatible storage
- Allows per-message model switching between providers
- Uses each user's existing plan limits and model permissions

## Architecture

```
Browser (React) → Portal Chat API → PostgreSQL (history)
                                    → S3 (attachments)
                                    → OmniRoute (normalized streaming)
                                        → OpenAI
                                        → Anthropic
                                        → Gemini
                                        → and more
```

The browser never contacts AI providers directly. All requests flow through the portal, which:

1. Authenticates the user via existing session
2. Decrypts the user's hidden OmniRoute API key
3. Assembles the request from persisted conversation history
4. Proxies to OmniRoute's `/v1/chat/completions` endpoint
5. Translates the upstream SSE into a normalized event protocol
6. Persists the completed assistant message

## Required Environment Variables

### Chat Credential Encryption

```env
# REQUIRED in production — comma-separated for key rotation
CHAT_KEY_ENCRYPTION_KEY=your-secure-encryption-key-here

# For key rotation, list old key first, new key last:
# CHAT_KEY_ENCRYPTION_KEY=old-key,new-key
```

### S3-Compatible Object Storage

```env
# Bucket name for chat attachments
CHAT_S3_BUCKET=aikompute-chat-attachments

# AWS region (or your S3-compatible provider's region)
CHAT_S3_REGION=us-east-1
# or
AWS_REGION=us-east-1

# For S3-compatible providers (MinIO, Backblaze B2, Cloudflare R2, etc.):
CHAT_S3_ENDPOINT=https://your-s3-endpoint.com
CHAT_S3_FORCE_PATH_STYLE=true

# AWS credentials (standard AWS SDK env vars)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Already Required (Existing)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret
OMNIROUTE_INTERNAL_URL=http://127.0.0.1:20128
OMNIROUTE_ADMIN_PASSWORD=your-omniroute-admin-password
```

## S3 Bucket Configuration

### Lifecycle Policy

Set an expiration rule to catch orphaned objects (objects whose database records were deleted but S3 cleanup failed):

```json
{
  "Rules": [
    {
      "ID": "orphan-cleanup",
      "Status": "Enabled",
      "Filter": { "Prefix": "attachments/" },
      "Expiration": { "Days": 90 }
    }
  ]
}
```

### CORS

No CORS configuration is needed — all uploads go through the portal server, not directly from the browser.

### Bucket Policy

The bucket should be private (block all public access). Only the portal's AWS credentials should have access.

## Encryption Key Rotation

To rotate the `CHAT_KEY_ENCRYPTION_KEY`:

1. Add the new key to the environment variable (old key first, new key second):

   ```
   CHAT_KEY_ENCRYPTION_KEY=old-key,new-key
   ```

2. Restart the portal. New credentials will be encrypted with the new key. Old credentials can still be decrypted using the old key.

3. To fully migrate, run a re-encryption script that decrypts all existing credentials with the old key and re-encrypts with the new key. (This script is not yet built — manual SQL update or a migration script.)

4. Once all credentials are re-encrypted, remove the old key:
   ```
   CHAT_KEY_ENCRYPTION_KEY=new-key
   ```

## Supported File Types and Limits

### Images

- **Formats:** PNG, JPEG, GIF, WebP
- **Max size:** 10 MB per file
- **Max per message:** 4 images
- **Condition:** Only included when the selected model supports vision

### Documents

- **Formats:** PDF, TXT, Markdown (MD), CSV, JSON
- **Max size:** 25 MB per file
- **Max per message:** 4 documents
- **Extraction:** Text is extracted server-side and stored in PostgreSQL. Original binary stays in S3.
- **Extraction limit:** 50,000 characters per document (truncated with marker)

### Rejected File Types

Archives (zip, tar, rar, 7z), executables (exe, dll, so, app), scripts (sh, bat, ps1), code files (js, ts, py, etc.), HTML/SVG (script injection risk).

## Database Schema

See `prisma/migrations/20260720_add_chat_tables/migration.sql` for the full schema.

### Tables

- `chat_conversations` — User-owned conversation containers
- `chat_messages` — Individual messages with role, content, status, model info, token usage
- `chat_attachments` — File metadata with S3 storage key and extracted text
- `chat_credentials` — Encrypted hidden OmniRoute API keys (one per user)

All tables cascade-delete when a user or conversation is deleted.

## Deployment Sequence

1. **Set environment variables** (see above)
2. **Run database migration:**
   ```bash
   cd customer-portal
   npx prisma migrate deploy
   npx prisma generate
   ```
3. **Create the S3 bucket** and configure lifecycle/CORS as described above
4. **Build and deploy** the customer portal as usual
5. **Verify** by navigating to `/dashboard/chat` as a signed-in user

## Rollback

1. The chat feature is additive — it does not modify existing tables or routes
2. To disable: remove the `/dashboard/chat` route from `navItems` in `src/app/dashboard/layout.tsx`
3. To fully revert: drop the chat tables and remove the new files:
   ```sql
   DROP TABLE IF EXISTS chat_credentials;
   DROP TABLE IF EXISTS chat_attachments;
   DROP TABLE IF EXISTS chat_messages;
   DROP TABLE IF EXISTS chat_conversations;
   ```
4. Clean up S3 objects manually or let the lifecycle policy expire them

## API Endpoints

| Method | Path                           | Description                            |
| ------ | ------------------------------ | -------------------------------------- |
| GET    | `/api/chat/conversations`      | List user's conversations              |
| POST   | `/api/chat/conversations`      | Create a new conversation              |
| DELETE | `/api/chat/conversations`      | Delete all conversations               |
| GET    | `/api/chat/conversations/[id]` | Get conversation with messages         |
| PATCH  | `/api/chat/conversations/[id]` | Rename or archive                      |
| DELETE | `/api/chat/conversations/[id]` | Delete conversation + S3 objects       |
| GET    | `/api/chat/models`             | List available text-generation models  |
| POST   | `/api/chat/attachments`        | Upload files (multipart)               |
| POST   | `/api/chat/send`               | Send message and stream response (SSE) |

## Security Notes

- Hidden OmniRoute API keys are encrypted at rest with AES-256-GCM
- Keys are never logged, never sent to the browser
- All API routes require authentication via `requireAuth()`
- All conversation/attachment operations verify ownership before acting
- S3 objects are private with short-lived presigned URLs for downloads
- File uploads are validated (type, size, extension) before storage
- Prompt injection is handled by OmniRoute's existing guard
- Conversation deletion purges both PostgreSQL records and S3 objects
