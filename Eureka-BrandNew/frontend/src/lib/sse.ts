/**
 * lib/sse — EventSource wrapper with typed event dispatch + auto-reconnect.
 *
 * Used by:
 *  - useChat (M2): subscribes to a POST-then-stream pattern, but for native
 *    EventSource we hit `/api/chat/stream?session_id=…` GET endpoints.
 *  - useNotifications (M6): subscribes to /api/notifications/stream
 *
 * Backend currently emits SSE for /api/chat as a POST → stream (not standard
 * EventSource POST support); for that case useChat parses fetch streaming
 * directly. This helper is for true GET-EventSource streams.
 */

export interface SseHandlers {
  /** Called for every event regardless of `event:` name. */
  onMessage?: (event: { type: string; data: string; id?: string }) => void;
  /** Called when the underlying connection opens. */
  onOpen?: () => void;
  /** Called on hard errors; reconnect logic decides whether to retry. */
  onError?: (err: Error) => void;
  /** Called when subscription is closed (manually or after retry budget). */
  onClose?: () => void;
}

export interface SseOptions {
  /** Map of `event:` name → handler. Falls back to `onMessage`. */
  events?: Record<string, (data: string, id?: string) => void>;
  /** Reconnect strategy. */
  reconnect?: {
    enabled?: boolean;
    initialDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number;
  };
}

export interface SseSubscription {
  close: () => void;
}

const DEFAULT_RECONNECT = {
  enabled: true,
  initialDelayMs: 1_000,
  maxDelayMs: 15_000,
  maxAttempts: Infinity,
};

/**
 * Open an SSE subscription. Auto-reconnects on transient errors with
 * exponential backoff. Returns an object with .close() to tear down.
 *
 * NB: EventSource is GET-only. For POST→stream (current /api/chat), do not use
 * this; fetch + ReadableStream is the right tool (see useChat).
 */
export function openSse(url: string, handlers: SseHandlers, opts: SseOptions = {}): SseSubscription {
  const reconnect = { ...DEFAULT_RECONNECT, ...(opts.reconnect ?? {}) };
  let attempt = 0;
  let closed = false;
  let es: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (closed) return;
    es = new EventSource(url);

    es.onopen = () => {
      attempt = 0; // reset on successful connect
      handlers.onOpen?.();
    };

    es.onmessage = (ev) => {
      handlers.onMessage?.({ type: "message", data: ev.data, id: ev.lastEventId });
    };

    es.onerror = (ev) => {
      const err = new Error("SSE connection error");
      handlers.onError?.(err);
      es?.close();
      es = null;
      // Browser EventSource auto-retries, but we want explicit control to
      // surface errors and cap attempts.
      if (closed) return;
      if (!reconnect.enabled || attempt >= reconnect.maxAttempts) {
        handlers.onClose?.();
        return;
      }
      const delay = Math.min(
        reconnect.initialDelayMs * 2 ** attempt,
        reconnect.maxDelayMs,
      );
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
      void ev; // silence unused
    };

    // Named events from `events:` map
    for (const [name, fn] of Object.entries(opts.events ?? {})) {
      es.addEventListener(name, (ev) => {
        const me = ev as MessageEvent;
        fn(me.data, me.lastEventId);
      });
    }
  }

  connect();

  return {
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      handlers.onClose?.();
    },
  };
}
