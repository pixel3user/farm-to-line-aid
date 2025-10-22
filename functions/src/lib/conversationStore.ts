import admin from './firebaseAdmin';

const firestore = admin.firestore();

const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_DOCS = 200;
const MAX_TEXT_LENGTH = 2000;

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: admin.firestore.Timestamp;
}

const historyCollection = (userId: string) =>
  firestore.collection('line_users').doc(userId).collection('conversation_history');

export class ConversationStore {
  static async getRecentTurns(userId: string, limit: number = MAX_HISTORY_TURNS): Promise<ConversationTurn[]> {
    const snapshot = await historyCollection(userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs
      .map(doc => doc.data() as ConversationTurn)
      .reverse();
  }

  static async appendTurns(userId: string, turns: ConversationTurn[]): Promise<void> {
    if (!turns.length) return;

    const batch = firestore.batch();
    const collectionRef = historyCollection(userId);

    turns.forEach(turn => {
      if (!turn.text?.trim()) {
        return;
      }

      const trimmedText = turn.text.slice(0, MAX_TEXT_LENGTH);

      const docRef = collectionRef.doc();
      batch.set(docRef, {
        role: turn.role,
        text: trimmedText,
        timestamp: turn.timestamp ?? admin.firestore.Timestamp.now(),
      });
    });

    await batch.commit();
    await this.trimHistory(userId);
  }

  private static async trimHistory(userId: string): Promise<void> {
    const snapshot = await historyCollection(userId)
      .orderBy('timestamp', 'desc')
      .offset(MAX_HISTORY_DOCS)
      .limit(50)
      .get();

    if (snapshot.empty) return;

    const batch = firestore.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}
