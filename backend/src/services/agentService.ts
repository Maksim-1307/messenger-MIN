import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { config } from '../utils/config.js';
import { messageRepository, buildChatKey } from '../repositories/MessageRepository.js';
import { chatRepository } from '../repositories/ChatRepository.js';
import { userRepository } from '../repositories/UserRepository.js';

interface ChatSummary {
  chatId: string;
  chatKey: string;
  otherUser?: {
    id: string;
    username: string;
    displayName: string | null;
  };
  summary: string;
  messageCount: number;
}

interface SummarizeResult {
  summaries: ChatSummary[];
  fullSummary: string;
}

// Initialize OpenRouter client
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.llm.apiKey,
});

export class AgentService {
  /**
   * Get recent messages from user's last N chats
   * Returns array of chats with their messages
   */
  async getRecentChatsMessages(
    userId: number,
    maxChats: number = 5,
    maxMessagesPerChat: number = 10,
  ): Promise<Array<{
    chatId: string;
    chatKey: string;
    messages: Array<{ sender_id: string; text: string; created_at: string }>;
    otherUser?: { id: string; username: string; displayName: string | null };
  }>> {
    // Get user's recent chats
    const recentChats = await chatRepository.getUserChatsEnriched(userId, maxChats);

    const chatData: Array<{
      chatId: string;
      chatKey: string;
      messages: Array<{ sender_id: string; text: string; created_at: string }>;
      otherUser?: { id: string; username: string; displayName: string | null };
    }> = [];

    for (const chat of recentChats) {
      // Get participants to build chatKey
      const participants = await chatRepository.getParticipants(chat.id);
      const participantIds = participants.map(p => parseInt(p.user_id));

      if (participantIds.length < 2) continue;

      // Find the other user
      const otherUserId = participantIds.find(id => id !== userId);
      if (!otherUserId) continue;

      const otherUser = await userRepository.findById(otherUserId);

      // Build chatKey
      const chatKey = buildChatKey(userId, otherUserId);

      // Get recent messages for this chat
      const messages = await messageRepository.getMessagesBetweenUsers(
        userId,
        otherUserId,
        maxMessagesPerChat,
      );

      if (messages.length > 0) {
        chatData.push({
          chatId: chat.id,
          chatKey,
          messages: messages.map(m => ({
            sender_id: m.sender_id,
            text: m.text,
            created_at: m.created_at,
          })),
          otherUser: otherUser ? {
            id: otherUser.id,
            username: otherUser.username,
            displayName: otherUser.display_name,
          } : undefined,
        });
      }
    }

    return chatData;
  }

  /**
   * Summarize chat messages using AI
   * Returns per-chat summaries and a full summary
   */
  async summarizeChats(
    chatData: Array<{
      chatId: string;
      chatKey: string;
      messages: Array<{ sender_id: string; text: string; created_at: string }>;
      otherUser?: { id: string; username: string; displayName: string | null };
    }>,
  ): Promise<SummarizeResult> {
    if (chatData.length === 0) {
      return {
        summaries: [],
        fullSummary: 'Нет сообщений для суммаризации.',
      };
    }

    // Build context for AI
    let context = '';
    for (const chat of chatData) {
      const chatLabel = chat.otherUser
        ? `Чат с ${chat.otherUser.displayName || chat.otherUser.username}`
        : `Чат ${chat.chatId}`;

      context += `\n\n=== ${chatLabel} ===\n`;
      const messagesText = chat.messages
        .map(m => `${m.sender_id}: ${m.text}`)
        .join('\n');
      context += messagesText;
    }

    const prompt = `Ты — ассистент для суммаризации переписок в мессенджере.
Твоя задача — кратко пересказать суть каждой переписки, выделив самое важное.

КРИТИЧЕСКИЕ ТРЕБОВАНИЯ:
1. Ответ должен быть ОЧЕНЬ кратким (максимум 2-3 предложения на чат)
2. Используй Markdown форматирование
3. Раздели ответ по чатам, указав название каждого
4. Выдели ключевые темы и решения
5. Приоритет: сначала важные/срочные чаты

Формат ответа:
### [Название чата]
- Краткая суть (1-2 предложения)
- Ключевые моменты (если есть)

---

Контекст переписки:${context}

Суммаризируй переписки:`;

    try {
      const result = await streamText({
        model: openrouter(config.llm.model),
        prompt,
        temperature: 0.3,
        maxTokens: 1000,
      });

      // Collect full text
      let fullText = '';
      const chunks: string[] = [];

      for await (const textPart of result.textStream) {
        fullText += textPart;
        chunks.push(textPart);
      }

      // Parse per-chat summaries from the full text
      const summaries = this.parseChatSummaries(fullText, chatData);

      return {
        summaries,
        fullSummary: fullText,
      };
    } catch (error) {
      console.error('[AgentService] Error during summarization:', error);
      throw new Error('Ошибка при работе с ИИ');
    }
  }

  /**
   * Parse AI response into per-chat summaries
   */
  private parseChatSummaries(
    fullText: string,
    chatData: Array<{ chatId: string; chatKey: string; otherUser?: { id: string; username: string; displayName: string | null } }>,
  ): ChatSummary[] {
    const summaries: ChatSummary[] = [];

    // Simple parsing: split by chat headers
    const lines = fullText.split('\n');
    let currentChatIndex = -1;
    let currentSummary = '';

    for (const line of lines) {
      const headerMatch = line.match(/^###\s+(.+)$/);
      if (headerMatch && currentChatIndex < chatData.length - 1) {
        // Save previous summary
        if (currentChatIndex >= 0 && currentSummary.trim()) {
          const chat = chatData[currentChatIndex];
          summaries.push({
            chatId: chat.chatId,
            chatKey: chat.chatKey,
            otherUser: chat.otherUser,
            summary: currentSummary.trim(),
            messageCount: chat.messages.length,
          });
        }

        currentChatIndex++;
        currentSummary = '';
      } else if (currentChatIndex >= 0) {
        currentSummary += line + '\n';
      }
    }

    // Save last summary
    if (currentChatIndex >= 0 && currentSummary.trim()) {
      const chat = chatData[currentChatIndex];
      summaries.push({
        chatId: chat.chatId,
        chatKey: chat.chatKey,
        otherUser: chat.otherUser,
        summary: currentSummary.trim(),
        messageCount: chat.messages.length,
      });
    }

    return summaries;
  }

  /**
   * Stream chat summary to client via callback
   * Callback receives chunks as they arrive
   */
  async streamSummary(
    chatData: Array<{
      chatId: string;
      chatKey: string;
      messages: Array<{ sender_id: string; text: string; created_at: string }>;
      otherUser?: { id: string; username: string; displayName: string | null };
    }>,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    if (chatData.length === 0) {
      onChunk('Нет сообщений для суммаризации.');
      onComplete();
      return;
    }

    // Build context for AI
    let context = '';
    for (const chat of chatData) {
      const chatLabel = chat.otherUser
        ? `Чат с ${chat.otherUser.displayName || chat.otherUser.username}`
        : `Чат ${chat.chatId}`;

      context += `\n\n=== ${chatLabel} ===\n`;
      const messagesText = chat.messages
        .map(m => `${m.sender_id}: ${m.text}`)
        .join('\n');
      context += messagesText;
    }

    const prompt = `Ты — ассистент для суммаризации переписок в мессенджере.
Твоя задача — кратко пересказать суть каждой переписки, выделив самое важное.

КРИТИЧЕСКИЕ ТРЕБОВАНИЯ:
1. Ответ должен быть ОЧЕНЬ кратким (максимум 2-3 предложения на чат)
2. Используй Markdown форматирование
3. Раздели ответ по чатам, указав название каждого
4. Выдели ключевые темы и решения
5. Приоритет: сначала важные/срочные чаты

Формат ответа:
### [Название чата]
- Краткая суть (1-2 предложения)
- Ключевые моменты (если есть)

---

Контекст переписки:${context}

Суммаризируй переписки:`;

    try {
      const result = await streamText({
        model: openrouter(config.llm.model),
        prompt,
        temperature: 0.3,
        maxTokens: 1000,
      });

      // Stream chunks to client
      for await (const textPart of result.textStream) {
        onChunk(textPart);
      }

      onComplete();
    } catch (error) {
      console.error('[AgentService] Error during streaming summary:', error);
      onError(error instanceof Error ? error : new Error('Ошибка при работе с ИИ'));
    }
  }
}

// Singleton instance
export const agentService = new AgentService();
