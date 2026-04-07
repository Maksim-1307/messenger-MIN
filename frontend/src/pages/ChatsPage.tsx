import { useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { chatApi } from '../api/chat';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { toFullUrl } from '../utils/api';
import type { EnrichedChat } from '../types/chat';
import styles from './ChatsPage.module.scss';
import { Icon } from '@iconify/react';

function formatRelativeTime(dateStr: string): string {
  // Append 'Z' to treat the timestamp as UTC since backend stores naive timestamps in UTC
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString();
}

const CHAT_LIMIT = 20;

export const ChatsPage: React.FC = () => {
  const { token, isAuthenticated, isLoading: authLoading, requireAuth } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  if (!authLoading && !isAuthenticated) {
    requireAuth('/login');
    return null;
  }

  if (authLoading || !token) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return <ChatsPageContent token={token} navigate={navigate} />;
};

interface ChatsPageContentProps {
  token: string;
  navigate: ReturnType<typeof useNavigate>;
}

const ChatsPageContent: React.FC<ChatsPageContentProps> = ({ token, navigate }) => {
  const fetchChats = useCallback(
    async (to?: string) => {
      const response = await chatApi.getChats(token, { limit: CHAT_LIMIT, to });
      const chats = response.chats;
      return {
        items: chats,
        hasMore: response.pagination.hasMore,
        lastCursor: chats.length > 0 ? chats[chats.length - 1].updated_at : null,
      };
    },
    [token],
  );

  const { items: chats, isLoading, isLoadingMore, hasMore, error, sentinelRef } =
    useInfiniteScroll<EnrichedChat>({ fetchFn: fetchChats });

  if (isLoading) {
    return <div className={styles.loading}>Loading chats...</div>;
  }

  if (error) {
    return <div className={styles.error}>Failed to load chats: {error}</div>;
  }

  if (chats.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon icon="ph:chats-circle" width={64} />
        <h2>No chats yet</h2>
        <p>Start a conversation to see it here</p>
      </div>
    );
  }

  return (
    <div className={styles.chats}>
      <div className={styles['chats__header']}>
        <h1 className={styles.chats__title}>Chats</h1>
        <div className={styles.chats__summarize}>
          <span>Summarize</span>
          <Icon icon="mdi:stars"/>
        </div>
      </div>
      <div className={styles.chats__list}>
        {chats.map((chat) => (
          <ChatItem key={chat.id} chat={chat} onClick={() => {
            if (chat.otherUser) {
              navigate(`/chat/${chat.otherUser.id}`);
            }
          }} />
        ))}
      </div>
      {isLoadingMore && <div className={styles.chats__loader}>Loading more...</div>}
      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
    </div>
  );
};

interface ChatItemProps {
  chat: EnrichedChat;
  onClick: () => void;
}

const ChatItem: React.FC<ChatItemProps> = ({ chat, onClick }) => {
  const displayName = chat.otherUser?.displayName ?? chat.otherUser?.username ?? 'Chat';
  const avatarUrl = chat.otherUser?.avatarUrl
    ? toFullUrl(chat.otherUser.avatarUrl)
    : null;

  const lastMsg = chat.lastMessage;
  const isUnread = chat.unreadCount > 0;

  return (
    <Link
      to={`/chat/${chat.otherUser?.id}`}
      className={`${styles.chatItem} ${isUnread ? styles['chatItem--unread'] : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
    >
      <div className={styles.chatItem__avatar}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} />
        ) : (
          <span>{displayName.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className={styles.chatItem__content}>
        <div className={styles.chatItem__header}>
          <span className={styles.chatItem__name}>{displayName}</span>
          {lastMsg && (
            <span className={styles.chatItem__time}>
              {formatRelativeTime(lastMsg.created_at)}
            </span>
          )}
        </div>
        <div className={styles.chatItem__footer}>
          <span className={styles.chatItem__preview}>
            {lastMsg ? lastMsg.text : 'No messages yet'}
          </span>
          {isUnread && (
            <span className={styles.chatItem__badge}>{chat.unreadCount}</span>
          )}
        </div>
      </div>
    </Link>
  );
};
