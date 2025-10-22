interface EventIdentity {
  type?: string;
  replyToken?: string;
  source?: unknown;
  message?: unknown;
  timestamp?: number;
}

interface StoredEvent {
  key: string;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const memoryStore: Map<string, StoredEvent> = new Map();

function serialiseIdentity(identity: EventIdentity): string {
  const payload = {
    type: identity.type || 'unknown',
    replyToken: identity.replyToken || 'none',
    source: identity.source,
    message: identity.message,
    timestamp: identity.timestamp || 0,
  };

  return JSON.stringify(payload);
}

function cleanupExpired(now: number): void {
  for (const [key, stored] of memoryStore.entries()) {
    if (stored.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}

export class EventDeduper {
  static async acquire(identity: EventIdentity): Promise<boolean> {
    const now = Date.now();
    cleanupExpired(now);

    const key = serialiseIdentity(identity);
    const existing = memoryStore.get(key);
    if (existing && existing.expiresAt > now) {
      return false;
    }

    memoryStore.set(key, { key, expiresAt: now + TTL_MS });
    return true;
  }

  static async markCompleted(identity: EventIdentity): Promise<void> {
    const key = serialiseIdentity(identity);
    const existing = memoryStore.get(key);
    if (existing) {
      memoryStore.set(key, { ...existing, expiresAt: Date.now() + TTL_MS });
    }
  }
}
