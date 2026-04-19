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
- JWT_SECRET_KEY
- JWT_SECRET_REFRESH_KEY
- TOKEN_EXPIRE_TIME
- TOKEN_REFRESH_EXPIRE_TIME
- DATABASE_URL

DATABASE_URL examples:

- local app + docker db: postgresql://postgres:postgres@localhost:5432/knowledge_hub?schema=public&connection_limit=5
- docker app + docker db: postgresql://postgres:postgres@db:5432/knowledge_hub?schema=public&connection_limit=5

Note:

- docker-compose sets DATABASE_URL for app service to use db hostname.

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

## Testing

Run all tests:

```bash
npm run test
```

Run specific suites:

```bash
npm run test -- users.e2e.spec.ts
npm run test -- articles.e2e.spec.ts
npm run test -- categories.e2e.spec.ts
npm run test -- comments.e2e.spec.ts
```

Authorization-related suites:

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
