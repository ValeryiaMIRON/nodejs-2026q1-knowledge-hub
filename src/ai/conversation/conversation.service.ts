import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationResponseDto } from '../dto/conversation.dto';
import { GeminiService } from '../gemini/gemini.service';
import { GeminiContent } from '../gemini/gemini.types';

type ConversationEntry = {
  messages: GeminiContent[];
  createdAt: number;
  updatedAt: number;
};

@Injectable()
export class ConversationService {
  private readonly conversations = new Map<string, ConversationEntry>();

  /** Maximum user+model message pairs kept in memory per conversation. */
  private readonly MAX_PAIRS = 25;

  /** Conversation TTL: 30 minutes of inactivity. */
  private readonly TTL_MS = 30 * 60_000;

  constructor(private readonly geminiService: GeminiService) {}

  async createConversation(message: string): Promise<ConversationResponseDto> {
    this.pruneExpired();

    const userContent: GeminiContent = {
      role: 'user',
      parts: [{ text: message }],
    };

    const result = await this.geminiService.generateWithHistory([userContent]);

    const modelContent: GeminiContent = {
      role: 'model',
      parts: [{ text: result.text }],
    };

    const conversationId = crypto.randomUUID();
    const now = Date.now();

    this.conversations.set(conversationId, {
      messages: [userContent, modelContent],
      createdAt: now,
      updatedAt: now,
    });

    return {
      conversationId,
      reply: result.text,
      messageCount: 2,
    };
  }

  async sendMessage(
    conversationId: string,
    message: string,
  ): Promise<ConversationResponseDto> {
    const entry = this.conversations.get(conversationId);

    if (!entry) {
      throw new NotFoundException('Conversation not found');
    }

    if (Date.now() - entry.updatedAt > this.TTL_MS) {
      this.conversations.delete(conversationId);
      throw new NotFoundException('Conversation expired');
    }

    const userContent: GeminiContent = {
      role: 'user',
      parts: [{ text: message }],
    };

    const history = [...entry.messages, userContent];
    const result = await this.geminiService.generateWithHistory(history);

    const modelContent: GeminiContent = {
      role: 'model',
      parts: [{ text: result.text }],
    };

    let updatedMessages = [...history, modelContent];

    // Trim oldest user+model pairs when history exceeds the cap
    while (updatedMessages.length > this.MAX_PAIRS * 2) {
      updatedMessages = updatedMessages.slice(2);
    }

    entry.messages = updatedMessages;
    entry.updatedAt = Date.now();

    return {
      conversationId,
      reply: result.text,
      messageCount: updatedMessages.length,
    };
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.conversations.entries()) {
      if (now - entry.updatedAt > this.TTL_MS) {
        this.conversations.delete(id);
      }
    }
  }
}
