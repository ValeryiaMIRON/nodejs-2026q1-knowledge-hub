export type RagChunk = {
  index: number;
  text: string;
};

export type RagArticleForIndex = {
  id: string;
  title: string;
  content: string;
  status: string;
  categoryId: string | null;
  tags: string[];
  updatedAt: Date;
};

export type RagVectorPayload = {
  articleId: string;
  articleTitle: string;
  chunk: string;
  chunkIndex: number;
  articleStatus: string;
  categoryId: string | null;
  tags: string[];
  updatedAt: string;
};

export type RagSearchFilter = {
  articleStatus?: string;
  categoryId?: string;
  tags?: string[];
};
