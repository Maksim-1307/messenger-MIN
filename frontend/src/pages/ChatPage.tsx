import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { chatApi } from '../api/chat';
import { userApi, toFullUrl } from '../api/users';
import { socketService } from '../services/socketService';
import type { Message } from '../types/chat';
import styles from './ChatPage.module.scss';
import { Icon } from '@iconify/react';

const MSG_LIMIT = 30;

export const ChatPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { token, isAuthenticated, isLoading: authLoading, requireAuth } = useAuth();
  const navigate = useNavigate();

  if (!authLoading && !isAuthenticated) {
    requireAuth('/login');
    return null;
  }

  if (authLoading || !token || !userId) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return <ChatPageContent token={token} targetUserId={parseInt(userId)} navigate={navigate} />;
};

interface ChatPageContentProps {
  token: string;
  targetUserId: number;
  navigate: ReturnType<typeof useNavigate>;
}

const ChatPageContent: React.FC<ChatPageContentProps> = ({ token, targetUserId, navigate }) => {
  const { user: currentUser, sendMessageViaSocket } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [targetAvatarUrl, setTargetAvatarUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  // Scroll to bottom on initial load or new message
  const scrollToBottom = useCallback((smooth = false) => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant',
      });
    }
  }, []);

  // Load a page of messages (older)
  const loadMessages = useCallback(
    async (append: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);

      try {
        const response = await chatApi.getMessages(token, targetUserId, {
          limit: MSG_LIMIT,
          to: append ? cursor ?? undefined : undefined,
        });

        const newMsgs = response.messages;

        // Determine the other user's display name from the first message
        if (!targetUsername && newMsgs.length > 0 && currentUser) {
          console.log('Target username is not set, setting it to User ' + targetUserId);
          setTargetUsername((prev) => !prev ? `User ${targetUserId}` : prev);
        }

        setMessages((prev) => {
          // 1. Собираем все сообщения в один массив
          // Если append=true (грузим старые), новые из API ставим В НАЧАЛО
          const combined = append ? [...newMsgs, ...prev] : [...prev, ...newMsgs];

          // 2. Дедуплицируем через Map по id
          const map = new Map();
          combined.forEach((m) => {
            if (m && m.id) {
              map.set(m.id, m);
            }
          });

          // 3. Возвращаем отсортированный массив (по времени), 
          // чтобы порядок не развалился при перемешивании старых и новых
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

        if (newMsgs.length > 0) {
          setCursor(newMsgs[0].id);
        }
        setHasMore(response.pagination.hasMore);

        // If it's the first load, scroll to bottom (latest messages)
        if (!append) {
          setTimeout(() => scrollToBottom(false), 100);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [token, targetUserId, cursor, targetUsername, currentUser, scrollToBottom],
  );

  // Fetch user profile for avatar and name
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await userApi.getUserProfile(token, String(targetUserId));
        setTargetUsername(response.user.displayName);
        setTargetAvatarUrl(response.user.avatarUrl);
        console.log('Target username set to ' + response.user.displayName);
      } catch (err) {
        console.error('Failed to load user profile:', err);
      }
    };

    fetchUserProfile();
  }, [token, targetUserId]);

  // Listen for incoming messages via socket
  useEffect(() => {
    const handleSocketMessage = (message: Message) => {
      if (
        (message.sender_id === String(targetUserId) && message.recipient_id === String(currentUser?.id)) ||
        (message.sender_id === String(currentUser?.id) && message.recipient_id === String(targetUserId))
      ) {
        setMessages((prev) => {
          const seen = new Map<string, Message>();
          prev.forEach((m) => seen.set(m.id, m));
          if (!seen.has(message.id)) seen.set(message.id, message);
          return [...seen.values()];
        });
        setTimeout(() => scrollToBottom(true), 50);
      }
    };

    const unsubscribe = socketService.onMessage(handleSocketMessage);

    return () => {
      unsubscribe();
    };
  }, [targetUserId, currentUser, scrollToBottom]);

  // Initial load
  useEffect(() => {
    loadMessages(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  // IntersectionObserver for loading older messages
  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current && hasMore) {
          loadMessages(true);
        }
      },
      { rootMargin: '300px' },
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);

    return () => observer.disconnect();
  }, [hasMore, loadMessages]);

  // Send message via WebSocket (with REST fallback)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      try {
        // Send via WebSocket — the socket event handler will add the message
        // to state when the backend emits it back
        await sendMessageViaSocket(targetUserId, text);
      } catch {
        // Fallback to REST — manually add the message
        const response = await chatApi.sendMessage(token, targetUserId, text);
        const newMsg = response.data;
        if (newMsg) {
          setMessages((prev) => [...prev, newMsg]);
        }
      }
      setInputText('');
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading conversation...</div>;
  }

  return (
    <div className={styles['chat__wrapper']}>
      <div className={styles.chat}>
        {/* Header */}
        <div className={styles.chat__header}>
          <button className={`${styles.chat__back} glass`} onClick={() => navigate('/chats')}>
            <Icon icon="tabler:arrow-left" width={20} />
          </button>
          <div className={`${styles.chat__userInfo} glass`}>
            <h2 className={styles.chat__title}>{targetUsername ?? `User ${targetUserId}`}</h2>
          </div>
          <button
            className={`${styles['chat__user-avatar']} glass`}
            onClick={() => navigate(`/chats/${targetUserId}/info`)}
          >
              {targetAvatarUrl ? (
                <img src={toFullUrl(targetAvatarUrl) ?? ''} alt="Avatar" />
              ) : (
                <span>{targetUsername?.charAt(0).toUpperCase()}</span>
              )}
          </button>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className={styles.chat__messages}>
          {messages.length === 0 && !isLoading ? (
            <div className={styles.empty}>
              <Icon icon="ph:chat-circle-text" width={48} />
              <p>No messages yet. Say hello!</p>
            </div>
          ) : (
            <>
              {isLoadingMore && <div className={styles.chat__loader}>Loading older messages...</div>}
              {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

              <MessageList messages={messages} currentUserId={currentUser?.id ?? 0} />

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Error */}
        {error && <div className={styles.chat__error}>{error}</div>}

        {/* Input */}
        <form className={styles.chat__input} onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Type a message..."
            className='glass'
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isSending}
          />
          <button className='accent-glass' type="submit" disabled={isSending || !inputText.trim()}>
            {isSending ? (
              <Icon icon="svg-spinners:ring-resize" />
            ) : (
              <Icon icon="tabler:send" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

interface MessageListProps {
  messages: Message[];
  currentUserId: number;
}

const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId }) => {
  // Deduplicate at render level as final safety net
  const uniqueMessages = messages;//[...new Map(messages.map((m) => [m.id, m])).values()];

  return (
    <div className={styles.messageList}>
      {uniqueMessages.map((msg) => {
        const isMine = msg.sender_id === String(currentUserId);
        return (
          <div
            key={msg.id} 
            className={`${styles.message} ${isMine ? styles['message--mine'] : styles['message--theirs']}`}
          >
            <div className={styles.message__bubble}>
              <span>{msg.text}</span>
            </div>
            <span className={styles.message__time}>
              {new Date(msg.created_at.endsWith('Z') ? msg.created_at : msg.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </div>
        );
      })}
    </div>
  );
};
