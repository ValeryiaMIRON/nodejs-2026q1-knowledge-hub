import { RagChunk } from './rag.types';

export function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
): RagChunk[] {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) {
    return [];
  }

  const safeChunkSize = Math.max(100, chunkSize);
  const safeOverlap = Math.max(0, Math.min(chunkOverlap, safeChunkSize - 1));
  const step = safeChunkSize - safeOverlap;

  const chunks: RagChunk[] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < cleaned.length) {
    const end = Math.min(cursor + safeChunkSize, cleaned.length);
    const chunk = cleaned.slice(cursor, end).trim();
    if (chunk) {
      chunks.push({ index, text: chunk });
      index += 1;
    }
    if (end >= cleaned.length) {
      break;
    }
    cursor += step;
  }

  return chunks;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
}
