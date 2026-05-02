import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiService } from '../gemini/gemini.service';
import { ConversationService } from './conversation.service';

const makeMockGemini = () =>
  ({
    generateWithHistory: vi.fn().mockResolvedValue({ text: 'Mock reply' }),
  }) as unknown as GeminiService;

describe('ConversationService', () => {
  let service: ConversationService;
  let gemini: GeminiService;

  beforeEach(() => {
    gemini = makeMockGemini();
    service = new ConversationService(gemini);
  });

  describe('createConversation', () => {
    it('should return a conversationId, reply, and messageCount of 2', async () => {
      const result = await service.createConversation('Hello');

      expect(result.conversationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(result.reply).toBe('Mock reply');
      expect(result.messageCount).toBe(2);
    });

    it('should call generateWithHistory with user content', async () => {
      await service.createConversation('Hi there');

      expect(gemini.generateWithHistory).toHaveBeenCalledWith([
        { role: 'user', parts: [{ text: 'Hi there' }] },
      ]);
    });
  });

  describe('sendMessage', () => {
    it('should append user+model messages and return updated messageCount', async () => {
      const { conversationId } = await service.createConversation('First');
      vi.mocked(gemini.generateWithHistory).mockResolvedValueOnce({
        text: 'Second reply',
      });

      const result = await service.sendMessage(conversationId, 'Second');

      expect(result.reply).toBe('Second reply');
      expect(result.messageCount).toBe(4); // 2 from creation + 2 new
      expect(result.conversationId).toBe(conversationId);
    });

    it('should include the full history in the generateWithHistory call', async () => {
      const { conversationId } = await service.createConversation('First');
      vi.mocked(gemini.generateWithHistory).mockResolvedValueOnce({
        text: 'Follow-up reply',
      });

      await service.sendMessage(conversationId, 'Follow-up');

      const lastCall = vi
        .mocked(gemini.generateWithHistory)
        .mock.calls.at(-1)![0];
      expect(lastCall).toHaveLength(3); // user, model, user
      expect(lastCall[0]).toMatchObject({ role: 'user' });
      expect(lastCall[1]).toMatchObject({ role: 'model' });
      expect(lastCall[2]).toMatchObject({
        role: 'user',
        parts: [{ text: 'Follow-up' }],
      });
    });

    it('should throw NotFoundException for unknown conversationId', async () => {
      await expect(
        service.sendMessage('00000000-0000-4000-8000-000000000000', 'Hello'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for expired conversation', async () => {
      const { conversationId } = await service.createConversation('Start');

      // Manually expire the conversation by manipulating internal state
      const conversations = (
        service as unknown as {
          conversations: Map<string, { updatedAt: number }>;
        }
      ).conversations;
      const entry = conversations.get(conversationId)!;
      entry.updatedAt = Date.now() - 31 * 60 * 1000; // 31 minutes ago

      await expect(
        service.sendMessage(conversationId, 'Late message'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
