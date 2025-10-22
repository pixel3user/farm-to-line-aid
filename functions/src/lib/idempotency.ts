import crypto from 'crypto';
import admin from './firebaseAdmin';

interface EventIdentity {
  type?: string;
  replyToken?: string;
  source?: unknown;
  message?: unknown;
  timestamp?: number;
}

const TTL_MS = 5 * 60 * 1000;
const COLLECTION_NAME = 'webhook_event_dedupe';

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

function hashIdentity(identity: EventIdentity): string {
  return crypto.createHash('sha256').update(serialiseIdentity(identity)).digest('hex');
}

export class EventDeduper {
  private static get collection() {
    return admin.firestore().collection(COLLECTION_NAME);
  }

  static async acquire(identity: EventIdentity): Promise<boolean> {
    const key = hashIdentity(identity);
    const docRef = this.collection.doc(key);

    try {
      await docRef.create({
        key,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + TTL_MS),
      });
      return true;
    } catch (error: any) {
      const code = error?.code ?? error?.details;
      const message: string = error?.message || '';
      if (code === 6 || message.includes('ALREADY_EXISTS')) {
        // Document already exists meaning this event was processed recently
        console.warn('[EventDeduper] Duplicate event detected in Firestore. Suppressing re-processing.');
        return false;
      }

      console.error('[EventDeduper] Failed to acquire Firestore lock', error);
      throw error;
    }
  }

  static async markCompleted(identity: EventIdentity): Promise<void> {
    const key = hashIdentity(identity);
    const docRef = this.collection.doc(key);

    try {
      await docRef.set(
        {
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + TTL_MS),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('[EventDeduper] Failed to extend Firestore lock expiry', error);
    }
  }
}
