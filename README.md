# Knowledge Hub API with RAG

Knowledge Hub is a NestJS + Prisma API for articles, categories, comments, auth, and AI endpoints.
This version includes Retrieval-Augmented Generation (RAG) over Knowledge Hub articles using Gemini and Qdrant.

## Stack

- Node.js `24.10.0+`
- NestJS + TypeScript
- Prisma + PostgreSQL
- Google Gemini API
  - generation model: `gemini-2.0-flash`
  - embedding model: `text-embedding-004`
- Qdrant vector database in Docker Compose

## Environment setup

Create `.env` from template:

```bash
cp .env.example .env
```

Required AI + RAG variables:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004

RAG_VECTOR_DB_PROVIDER=qdrant
RAG_VECTOR_DB_URL=http://vectordb:6333
RAG_VECTOR_COLLECTION=knowledge_hub_articles
RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=200
RAG_CONVERSATION_MAX_MESSAGES=20
```

## How to obtain Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Open API keys page.
4. Create a new API key.
5. Copy it into local `.env` as `GEMINI_API_KEY`.
6. Do not commit `.env` with real credentials.

## Docker Compose services

`docker-compose.yml` runs:

- `app` (NestJS API)
- `db` (PostgreSQL)
- `vectordb` (Qdrant, persistent volume + healthcheck)

Start all services:

```bash
docker compose up --build
```

For local app run (outside Docker), use:

- `DATABASE_URL` with `localhost`
- `RAG_VECTOR_DB_URL=http://localhost:6333`

## Full startup flow after clone

1. Install dependencies:

```bash
npm install
```

2. Prepare environment:

```bash
cp .env.example .env
```

3. Fill secrets and local URLs in `.env`.

4. Start infrastructure:

```bash
docker compose up -d db vectordb
```

5. Run migrations:

```bash
npx prisma migrate deploy
```

6. Start API:

```bash
npm run start:dev
```

7. Open Swagger:

```text
http://localhost:4000/doc
```

## RAG indexing flow

1. Extract article data from PostgreSQL.
2. Deterministically chunk content (`RAG_CHUNK_SIZE`, `RAG_CHUNK_OVERLAP`).
3. Generate embeddings via Gemini.
4. Store vectors + metadata in Qdrant:
   - `articleId`
   - `articleTitle`
   - `articleStatus`
   - `categoryId`
   - `tags`
   - chunk text/index
5. For questions:
   - embed query
   - retrieve top chunks from Qdrant
   - build grounded prompt
   - generate answer with sources.

## RAG endpoints

- `POST /ai/rag/index`
- `POST /ai/rag/search`
- `POST /ai/rag/chat`
- `DELETE /ai/rag/index/articles/:articleId`
- `GET /ai/rag/chat/:conversationId/history` (optional memory inspection)

### Build/refresh index

```bash
curl -X POST "http://localhost:4000/ai/rag/index" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"onlyPublished":true}'
```

### Semantic search

```bash
curl -X POST "http://localhost:4000/ai/rag/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{
    "query":"How is article moderation handled?",
    "limit":5,
    "articleStatus":"published"
  }'
```

### Grounded RAG chat

```bash
curl -X POST "http://localhost:4000/ai/rag/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"question":"Summarize latest published security guidance"}'
```

### Delete article vectors from index

```bash
curl -X DELETE "http://localhost:4000/ai/rag/index/articles/<article-id>" \
  -H "Authorization: Bearer <access-token>"
```

## Reliability behavior

- If Gemini API is unavailable, API returns `503`.
- If Qdrant is unavailable, API returns `503`.
- Integration errors are logged without leaking secrets.
- Reindex removes stale article vectors during full rebuild.

## Known limitations

- Gemini free-tier quotas may cause `429` or temporary failures.
- Embedding and generation latency depends on network and provider load.
- Full reindex time grows with article volume.
- Regional availability for Gemini may vary by account/location.

## Development commands

```bash
npm run start:dev
npm run build
npm run test
npm run test:e2e
```
