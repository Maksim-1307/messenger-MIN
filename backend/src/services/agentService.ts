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
   * Build the prompt text for summarization
   */
  buildSummaryPrompt(
    chatData: Array<{
      chatId: string;
      chatKey: string;
      messages: Array<{ sender_id: string; text: string; created_at: string }>;
      otherUser?: { id: string; username: string; displayName: string | null };
    }>,
  ): string {
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

    return `Ты — ассистент для суммаризации переписок в мессенджере.
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
  }

  /**
   * Fetch OpenRouter summary and return the full text (non-streaming)
   */
  async fetchSummary(prompt: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.llm.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Messenger MIN',
      },
      body: JSON.stringify({
        model: config.llm.model,
        messages: [
          { role: 'user', content: prompt },
        ],
        stream: false,
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Fetch OpenRouter summary with streaming, calling onChunk for each token
   * Returns the full text when complete
   */
  async streamSummary(
    prompt: string,
    onChunk: (text: string) => Promise<void>,
  ): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.llm.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Messenger MIN',
      },
      body: JSON.stringify({
        model: config.llm.model,
        messages: [
          { role: 'user', content: prompt },
        ],
        stream: true,
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            chunkCount++;
            if (chunkCount % 10 === 1) {
              console.log(`[AgentService] SSE chunk #${chunkCount}: "${content.substring(0, 30)}..."`);
            }
            // Use nextTick to ensure each chunk is emitted in its own event loop cycle
            await new Promise<void>((resolve) => process.nextTick(resolve));
            await onChunk(content);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    console.log(`[AgentService] Streaming complete. Total chunks: ${chunkCount}`);
    return fullText;
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

}

// Singleton instance
export const agentService = new AgentService();
