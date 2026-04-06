import { useCallback, useRef, useState } from 'react';

interface UseInfiniteScrollOptions<T> {
  /** Async function that fetches a page of data. Receives the `to` cursor (or undefined for first page). */
  fetchFn: (to?: string) => Promise<{ items: T[]; hasMore: boolean; lastCursor: string | null }>;
  /** Items to prepend (newer items arrive at the end, we prepend older ones) */
  direction?: 'older';
}

interface UseInfiniteScrollResult<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  /** Load next (older) page */
  loadMore: () => void;
  /** Reset and reload from scratch */
  reset: () => void;
  /** Ref to attach IntersectionObserver for auto load-more */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function useInfiniteScroll<T>(
  options: UseInfiniteScrollOptions<T>,
): UseInfiniteScrollResult<T> {
  const { fetchFn } = options;

  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cursor pointing to the oldest loaded item (used for `to` param)
  const [cursor, setCursor] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  cursorRef.current = cursor;

  const loadingRef = useRef(false);

  const loadPage = useCallback(
    async (isAppend: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (isAppend) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const toCursor = isAppend ? cursorRef.current ?? undefined : undefined;
        const result = await fetchFn(toCursor);

        setItems((prev) => (isAppend ? [...prev, ...result.items] : result.items));
        setCursor(result.lastCursor);
        cursorRef.current = result.lastCursor;
        setHasMore(result.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [fetchFn],
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current) return;
    loadPage(true);
  }, [hasMore, loadPage]);

  const reset = useCallback(() => {
    setItems([]);
    setCursor(null);
    cursorRef.current = null;
    setHasMore(true);
    setError(null);
    // Defer to avoid state batching conflict
    setTimeout(() => loadPage(false), 0);
  }, [loadPage]);

  // Sentinel ref for IntersectionObserver-based auto load-more
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);

  const stableLoadMore = useRef(loadMore);
  stableLoadMore.current = loadMore;
  const stableHasMore = useRef(hasMore);
  stableHasMore.current = hasMore;

  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && stableHasMore.current) {
          stableLoadMore.current();
        }
      },
      { rootMargin: '200px' },
    );

    const el = sentinelRef.current;
    if (el) observerRef.current.observe(el);
  }, []);

  // Set up observer once
  const [observerSetup, setObserverSetup] = useState(false);
  if (!observerSetup) {
    setObserverSetup(true);
    // Use rAF so the DOM is ready
    requestAnimationFrame(() => setupObserver());
  }

  // Initial load
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  if (!initialLoadDone) {
    setInitialLoadDone(true);
    loadPage(false);
  }

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    reset,
    sentinelRef,
  };
}
