# Node.js 2026 Q1 Knowledge Hub API

REST API for a Knowledge Hub platform built with NestJS and TypeScript.

## Tech Stack

- Node.js 24.10.0 or higher
- NestJS
- TypeScript
- class-validator and global ValidationPipe
- Swagger via @nestjs/swagger
- Prisma ORM + PostgreSQL

## Requirements

- Node.js version 24.10.0+
- npm

## Setup

1. Clone repository.
2. Install dependencies.

```bash
npm install
```

3. Create local environment file from template.

```bash
cp .env.example .env
```

4. Ensure PORT is configured (default is 4000).

```dotenv
PORT=4000
```

## Run Application

Default start command:

```bash
npm start
```

Development mode:

```bash
npm run start:dev
```

Production build and run:

```bash
npm run build
npm run start:prod
```

Base URL:

```text
http://localhost:4000
```

Swagger OpenAPI docs:

```text
http://localhost:4000/doc
```

## Docker Hub Image

Docker Hub image:

```text
https://hub.docker.com/r/valeryiamiron/knowledge-hub
```

Pull command:

```bash
docker pull valeryiamiron/knowledge-hub:docker-foundation
```

## Environment Variables

See template in [.env.example](.env.example).

Main variables:

- PORT
- CRYPT_SALT
- JWT_SECRET
- JWT_REFRESH_SECRET
- JWT_ACCESS_TTL
- JWT_REFRESH_TTL
- DATABASE_URL
- GEMINI_API_KEY
- GEMINI_API_BASE_URL
- GEMINI_MODEL
- AI_RATE_LIMIT_RPM
- AI_CACHE_TTL_SEC

DATABASE_URL examples:

- local app + docker db: postgresql://postgres:postgres@localhost:5432/knowledge_hub?schema=public&connection_limit=5
- docker app + docker db: postgresql://postgres:postgres@db:5432/knowledge_hub?schema=public&connection_limit=5

Note:

- docker-compose sets DATABASE_URL for app service to use db hostname.

## Gemini API Key Setup (Step-by-step)

1. Open Google AI Studio: https://aistudio.google.com
2. Sign in with your Google account.
3. Open API keys page and create a new key.
4. Copy generated key.
5. Open local `.env` file (created from `.env.example`).
6. Paste the key into:

```dotenv
GEMINI_API_KEY=your-real-key
```

7. Keep this key private and never commit `.env`.

## Gemini Model Used

The service uses Gemini model from env variable:

```dotenv
GEMINI_MODEL=gemini-2.0-flash
```

Default base URL:

```dotenv
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com
```

## Run After Clone (Exact Steps)

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Fill required `.env` values:

```dotenv
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_hub?schema=public&connection_limit=5
JWT_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
GEMINI_API_KEY=your-real-key
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_MODEL=gemini-2.0-flash
AI_RATE_LIMIT_RPM=20
AI_CACHE_TTL_SEC=300
```

4. Run DB migrations and (optionally) seed:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

If `npm run prisma:seed` is unavailable in your local setup, use:

```bash
npx prisma db seed
```

5. Start API:

```bash
npm run start:dev
```

6. Open Swagger docs:

```text
http://localhost:4000/doc
```

## AI Endpoints

- POST /ai/articles/:articleId/summarize
- POST /ai/articles/:articleId/translate
- POST /ai/articles/:articleId/analyze
- POST /ai/generate
- GET /ai/usage

Example requests:

```bash
curl -X POST "http://localhost:4000/ai/articles/<article-id>/summarize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"maxLength":"medium"}'
```

```bash
curl -X POST "http://localhost:4000/ai/articles/<article-id>/translate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"targetLanguage":"Spanish"}'
```

```bash
curl -X POST "http://localhost:4000/ai/articles/<article-id>/analyze" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"task":"review"}'
```

```bash
curl -X POST "http://localhost:4000/ai/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"prompt":"Explain NestJS in one short paragraph"}'
```

## Validate Gemini Key Before App Run

Use this direct provider check to verify that your key and quota are valid.

```bash
curl -s -o /tmp/gemini_check.json -w "%{http_code}\n" \
  -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=<YOUR_GEMINI_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello in one short sentence"}]}]}'

cat /tmp/gemini_check.json
```

Expected statuses:

- 200: key and provider access are valid.
- 401: invalid API key.
- 403: project/API permission issue or regional restriction.
- 429: quota exhausted or free-tier quota unavailable.

## Known Limitations

- Gemini free tier has request and token quotas; calls may fail with provider rate limits.
- Latency can vary depending on model load and network quality.
- Regional availability and policy restrictions may differ by account/location.
- AI outputs are probabilistic and can be inconsistent; production flows should validate response format.

## API Routes

### Users

- GET /user
- GET /user/:id
- POST /user
- PUT /user/:id
- DELETE /user/:id

Notes:

- Password is excluded from response.
- Deleting user sets related article authorId to null.
- Deleting user removes related comments.

### Auth

- POST /auth/signup
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout

Notes:

- /auth/login returns accessToken and refreshToken.
- /auth/refresh returns new token pair.
- /auth/signup and /auth/login are rate-limited by IP: 5 requests per 60 seconds.
- Rate limiting is disabled during automated tests.

### Articles

- GET /article
- GET /article/:id
- POST /article
- PUT /article/:id
- DELETE /article/:id

Supported filtering for GET /article:

- status
- categoryId
- tag

Supported sorting and pagination for list endpoints:

- sortBy
- order (asc | desc)
- page
- limit

Example:

```text
/article?status=published&tag=nodejs
```

```text
/article?sortBy=title&order=asc&page=1&limit=10
```

Notes:

- Deleting article removes its comments.

### Categories

- GET /category
- GET /category/:id
- POST /category
- PUT /category/:id
- DELETE /category/:id

Notes:

- Deleting category sets related article categoryId to null.

### Comments

- GET /comment?articleId={articleId}
- GET /comment/:id
- POST /comment
- DELETE /comment/:id

Notes:

- articleId query is required for GET /comment.
- POST /comment returns 422 if articleId does not exist.

## Validation and Error Handling

- Global ValidationPipe is enabled.
- Incoming request bodies are validated with DTO classes.
- UUID params are validated with ParseUUIDPipe.
- Global exception filter catches unhandled errors and returns normalized JSON responses.
- Custom error classes are available for common HTTP error scenarios:
- `NotFoundError` (404)
- `ValidationError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)

Typical status codes:

- 200 OK
- 201 Created
- 204 No Content
- 400 Bad Request
- 403 Forbidden
- 404 Not Found
- 422 Unprocessable Entity

## Middleware

Request logging middleware is enabled globally and logs method and URL for incoming requests.

## Logging and Runtime Error Handling

Logger behavior is controlled by environment variables:

- `LOG_LEVEL` (default: `log`)
- `LOG_MAX_FILE_SIZE` in KB (default: `1024`)

Supported log levels:

- `log`
- `debug`
- `warn`
- `error`
- `verbose`

Request/response logging:

- Incoming requests include method, URL, query params, and request body
- Outgoing responses include status code and response time
- Sensitive fields (`password`, `token`, `authorization`) are masked as `[REDACTED]`

Log output modes:

- Development: human-readable logs
- Production: structured JSON logs

File logging and rotation:

- Logs are written to `logs/app.log`
- Rotation is size-based using `LOG_MAX_FILE_SIZE`
- Rotated files use timestamp suffix (for example, `app-2026-04-25T08-05-16-000Z.log`)

Process-level safety handlers:

- `uncaughtException` and `unhandledRejection` are captured
- Errors are logged at error level
- Graceful shutdown is performed (`app.close()`, Prisma disconnect)
- Process exits with code `1`

## Testing

Run unit tests with Vitest:

```bash
npm run test
```

Equivalent unit-test command:

```bash
npm run test:unit
```

Run unit tests with coverage:

```bash
npm run test:coverage
```

Run e2e tests with Jest:

```bash
npm run test:e2e
```

Run authorization-related e2e suites:

```bash
npm run test:auth
npm run test:refresh
npm run test:rbac
```

Auth mode note:

- TEST_MODE=auth enables authorization checks in guards.
- test:auth, test:refresh, and test:rbac scripts already set TEST_MODE=auth.

Lint source files:

```bash
npx eslint "src/**/*.ts"
```

## Project Structure

- src/user
- src/article
- src/category
- src/comment
- src/common
- src/storage
- test
