import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { socketService } from '../services/socketService';
import styles from './SummaryPage.module.scss';
import { Icon } from '@iconify/react';
import { chatApi } from '../api/chat';
import type { Message } from '../types/chat';

interface ChatHistoryEntry {
  sender: string;
  text: string;
}

export const SummaryPage: React.FC = () => {
  const { token, isAuthenticated, isLoading: authLoading, requireAuth, user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAnswerStreaming, setIsAnswerStreaming] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const summaryRef = useRef('');
  const answerRef = useRef('');

  // Auth guard
  if (!authLoading && !isAuthenticated) {
    requireAuth('/login');
    return null;
  }

  if (authLoading || !token) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <SummaryPageContent
      token={token}
      currentUserId={user?.id ?? 0}
      summary={summary}
      setSummary={setSummary}
      isStreaming={isStreaming}
      setIsStreaming={setIsStreaming}
      error={error}
      setError={setError}
      question={question}
      setQuestion={setQuestion}
      answer={answer}
      setAnswer={setAnswer}
      isAnswerStreaming={isAnswerStreaming}
      setIsAnswerStreaming={setIsAnswerStreaming}
      chatHistory={chatHistory}
      setChatHistory={setChatHistory}
      isLoadingHistory={isLoadingHistory}
      setIsLoadingHistory={setIsLoadingHistory}
      summaryRef={summaryRef}
      answerRef={answerRef}
      navigate={navigate}
    />
  );
};

interface SummaryPageContentProps {
  token: string;
  currentUserId: number;
  summary: string;
  setSummary: (s: string) => void;
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;
  question: string;
  setQuestion: (q: string) => void;
  answer: string;
  setAnswer: (a: string) => void;
  isAnswerStreaming: boolean;
  setIsAnswerStreaming: (v: boolean) => void;
  chatHistory: ChatHistoryEntry[];
  setChatHistory: (h: ChatHistoryEntry[]) => void;
  isLoadingHistory: boolean;
  setIsLoadingHistory: (v: boolean) => void;
  summaryRef: React.MutableRefObject<string>;
  answerRef: React.MutableRefObject<string>;
  navigate: ReturnType<typeof useNavigate>;
}

const SummaryPageContent: React.FC<SummaryPageContentProps> = ({
  token,
  currentUserId,
  summary,
  setSummary,
  isStreaming,
  setIsStreaming,
  error,
  setError,
  question,
  setQuestion,
  answer,
  setAnswer,
  isAnswerStreaming,
  setIsAnswerStreaming,
  chatHistory,
  setChatHistory,
  isLoadingHistory,
  setIsLoadingHistory,
  summaryRef,
  answerRef,
  navigate,
}) => {
  // Load chat history when component mounts
  const loadChatHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const chatsResponse = await chatApi.getChats(token, { limit: 5 });
      const history: ChatHistoryEntry[] = [];

      for (const chat of chatsResponse.chats) {
        if (!chat.otherUser) continue;

        const msgsResponse = await chatApi.getMessages(token, parseInt(chat.otherUser.id), {
          limit: 10,
        });

        for (const msg of msgsResponse.messages) {
          const sender =
            msg.sender_id === String(currentUserId)
              ? 'You'
              : chat.otherUser?.displayName || chat.otherUser?.username || 'Unknown';
          history.push({ sender, text: msg.text });
        }
      }

      setChatHistory(history);
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setError('Не удалось загрузить историю переписки');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token, currentUserId, setChatHistory, setError]);

  // Set up socket listeners for agent events
  useEffect(() => {
    summaryRef.current = '';
    answerRef.current = '';

    const unsubscribeChunk = socketService.onAgentChunk((chunk: string) => {
      summaryRef.current += chunk;
      setSummary(summaryRef.current);
    });

    const unsubscribeError = socketService.onAgentError((err: { message: string }) => {
      setError(err.message || 'Ошибка при работе с ИИ');
      setIsStreaming(false);
    });

    const unsubscribeFinish = socketService.onAgentFinish(() => {
      setIsStreaming(false);
    });

    return () => {
      unsubscribeChunk();
      unsubscribeError();
      unsubscribeFinish();
    };
  }, [setSummary, setError, setIsStreaming]);

  // Load history on mount
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  const handleSummarize = () => {
    if (isStreaming) return;

    summaryRef.current = '';
    setSummary('');
    setError(null);
    setIsStreaming(true);

    socketService.requestSummary();
  };

  const handleAskQuestion = () => {
    if (!question.trim() || isAnswerStreaming) return;

    answerRef.current = '';
    setAnswer('');
    setError(null);
    setIsAnswerStreaming(true);

    // Set up answer listeners
    const unsubscribeChunk = socketService.onAgentChunk((chunk: string) => {
      answerRef.current += chunk;
      setAnswer(answerRef.current);
    });

    const unsubscribeError = socketService.onAgentError((err: { message: string }) => {
      setError(err.message || 'Ошибка при работе с ИИ');
      setIsAnswerStreaming(false);
    });

    const unsubscribeFinish = socketService.onAgentFinish(() => {
      setIsAnswerStreaming(false);
      unsubscribeChunk();
      unsubscribeError();
      unsubscribeFinish();
    });

    socketService.askQuestion(question.trim(), chatHistory.length > 0 ? chatHistory : undefined);
    setQuestion('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/chats')}>
          <Icon icon="mdi:arrow-left" width={20} />
        </button>
        <h1 className={styles.title}>Суммаризация переписки</h1>
      </div>

      <div className={styles.content}>
        {/* Summarize section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Icon icon="mdi:summarize" width={24} />
            <h2>Обзор чатов</h2>
          </div>

          <button
            className={styles.summarizeButton}
            onClick={handleSummarize}
            disabled={isStreaming || isLoadingHistory}
          >
            {isStreaming ? (
              <>
                <Icon icon="mdi:loading" width={18} className={styles.spinner} />
                Генерация...
              </>
            ) : (
              <>
                <Icon icon="mdi:auto-fix" width={18} />
                Суммаризировать
              </>
            )}
          </button>

          {isLoadingHistory && !summary && (
            <div className={styles.loadingText}>Загрузка истории переписки...</div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          {summary && (
            <div className={styles.summaryContent}>
              <SimpleMarkdown text={summary} />
            </div>
          )}
        </div>

        {/* Question section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Icon icon="mdi:comment-question" width={24} />
            <h2>Вопрос о переписке</h2>
          </div>

          <div className={styles.questionForm}>
            <input
              type="text"
              className={styles.questionInput}
              placeholder="Задайте вопрос о переписке..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAskQuestion();
                }
              }}
              disabled={isAnswerStreaming}
            />
            <button
              className={styles.askButton}
              onClick={handleAskQuestion}
              disabled={!question.trim() || isAnswerStreaming}
            >
              {isAnswerStreaming ? (
                <Icon icon="mdi:loading" width={18} className={styles.spinner} />
              ) : (
                <Icon icon="mdi:send" width={18} />
              )}
            </button>
          </div>

          {answer && (
            <div className={styles.answerContent}>
              <SimpleMarkdown text={answer} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Simple markdown renderer supporting basic formatting:
 * - Headers (###, ##, #)
 * - Bold (**text**)
 * - Italic (*text*)
 * - Lists (- item)
 * - Horizontal rules (---)
 * - Code (`code`)
 */
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className={styles.list}>
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Horizontal rule
    if (line.match(/^---+$/)) {
      flushList();
      elements.push(<hr key={`hr-${i}`} className={styles.hr} />);
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      elements.push(
        <Tag key={`h-${i}`} className={styles[`heading${level}`]}>
          <InlineMarkdown text={content} />
        </Tag>
      );
      continue;
    }

    // List items
    const listMatch = line.match(/^-\s+(.+)$/);
    if (listMatch) {
      inList = true;
      listItems.push(
        <li key={`li-${i}`}>
          <InlineMarkdown text={listMatch[1]} />
        </li>
      );
      continue;
    }

    // Regular text
    if (line.trim()) {
      flushList();
      elements.push(
        <p key={`p-${i}`} className={styles.paragraph}>
          <InlineMarkdown text={line} />
        </p>
      );
    } else {
      flushList();
      elements.push(<div key={`br-${i}`} className={styles.br} />);
    }
  }

  flushList();

  return <div className={styles.markdown}>{elements}</div>;
};

/**
 * Inline markdown for bold, italic, and code
 */
const InlineMarkdown: React.FC<{ text: string }> = ({ text }) => {
  // Split by markdown patterns
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Code
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(
        <code key={key++} className={styles.code}>
          {codeMatch[2]}
        </code>
      );
      remaining = codeMatch[3];
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(
        <strong key={key++} className={styles.bold}>
          {boldMatch[2]}
        </strong>
      );
      remaining = boldMatch[3];
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^(.*?)\*([^*]+)\*(.*)$/);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>);
      parts.push(
        <em key={key++} className={styles.italic}>
          {italicMatch[2]}
        </em>
      );
      remaining = italicMatch[3];
      continue;
    }

    // No more patterns
    parts.push(<span key={key++}>{remaining}</span>);
    remaining = '';
  }

  return <>{parts}</>;
};
