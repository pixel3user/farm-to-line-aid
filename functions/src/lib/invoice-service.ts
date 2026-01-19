import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import admin from './firebaseAdmin';
import { Invoice } from '../types/invoice';

const firestore = admin.firestore();
const nowTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const normalizeDateString = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // accept YYYY-MM-DD, otherwise return as-is (caller can fix)
  return trimmed;
};

export class InvoiceService {
  static async createInvoice(userId: string, invoiceData: Partial<Invoice>): Promise<{ id: string }> {
    if (!userId) {
      throw new Error('userId is required to create an invoice');
    }

    const docRef = firestore.collection('invoices').doc();
    const createdAt = new Date().toISOString();
    const payload: Invoice = {
      id: docRef.id,
      userId,
      direction: invoiceData.direction === 'purchase' ? 'purchase' : 'sale',
      status: invoiceData.status === 'paid' || invoiceData.status === 'open' || invoiceData.status === 'overdue' ? invoiceData.status : 'draft',
      invoiceNumber: invoiceData.invoiceNumber || docRef.id,
      counterpartyName: invoiceData.counterpartyName || '',
      description: invoiceData.description || '',
      currency: invoiceData.currency || 'USD',
      total: typeof invoiceData.total === 'number' ? invoiceData.total : 0,
      paid: typeof invoiceData.paid === 'number' ? invoiceData.paid : 0,
      issueDate: normalizeDateString(invoiceData.issueDate) || normalizeDateString((invoiceData as any).date) || new Date().toISOString().slice(0, 10),
      dueDate: normalizeDateString(invoiceData.dueDate) || undefined,
      deliveryDate: normalizeDateString(invoiceData.deliveryDate) || undefined,
      items: Array.isArray(invoiceData.items) ? invoiceData.items : undefined,
      attachmentCount: typeof invoiceData.attachmentCount === 'number' ? invoiceData.attachmentCount : undefined,
      rawText: invoiceData.rawText,
      createdAt,
      updatedAt: createdAt,
      extraction: invoiceData.extraction,
    };

    await docRef.set(payload);

    return { id: docRef.id };
  }

  static async getInvoicesByUser(userId: string): Promise<Invoice[]> {
    if (!userId) return [];
    const snapshot = await firestore
      .collection('invoices')
      .where('userId', '==', userId)
      .orderBy('issueDate', 'desc')
      .get();
    return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ ...(doc.data() as Invoice), id: doc.id }));
  }

  static async updateInvoice(userId: string, invoiceId: string, updates: Partial<Invoice>): Promise<void> {
    if (!userId || !invoiceId) {
      throw new Error('userId and invoiceId are required to update an invoice');
    }
    const ref = firestore.collection('invoices').doc(invoiceId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return;
    }
    const data = snapshot.data() as Invoice;
    if (data.userId !== userId) {
      throw new Error('Permission denied to update this invoice');
    }

    const payload: Record<string, unknown> = {};

    if (typeof updates.direction === 'string') {
      payload.direction = updates.direction === 'purchase' ? 'purchase' : 'sale';
    }
    if (typeof updates.status === 'string') {
      payload.status =
        updates.status === 'paid' || updates.status === 'open' || updates.status === 'overdue' ? updates.status : 'draft';
    }
    if (typeof updates.invoiceNumber === 'string') {
      payload.invoiceNumber = updates.invoiceNumber;
    }
    if (typeof updates.counterpartyName === 'string') {
      payload.counterpartyName = updates.counterpartyName;
    }
    if (typeof updates.description === 'string') {
      payload.description = updates.description;
    }
    if (typeof updates.currency === 'string') {
      payload.currency = updates.currency;
    }
    if (typeof updates.total === 'number') {
      payload.total = updates.total;
    }
    if (typeof updates.paid === 'number') {
      payload.paid = updates.paid;
    }
    if (typeof updates.issueDate === 'string') {
      payload.issueDate = updates.issueDate;
    }
    if (typeof updates.dueDate === 'string') {
      payload.dueDate = updates.dueDate;
    }
    if (typeof updates.deliveryDate === 'string') {
      payload.deliveryDate = updates.deliveryDate;
    }
    if (Array.isArray(updates.items)) {
      payload.items = updates.items;
    }
    if (typeof updates.attachmentCount === 'number') {
      payload.attachmentCount = updates.attachmentCount;
    }
    if (updates.rawText) {
      payload.rawText = updates.rawText;
    }
    if (updates.extraction) {
      payload.extraction = updates.extraction;
    }

    payload.updatedAt = new Date().toISOString();

    if (!Object.keys(payload).length) {
      return;
    }

    await ref.update(payload);
  }

  static async deleteInvoice(userId: string, invoiceId: string): Promise<void> {
    if (!userId || !invoiceId) return;
    const ref = firestore.collection('invoices').doc(invoiceId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return;
    }
    const data = snapshot.data() as Invoice;
    if (data.userId !== userId) {
      throw new Error('Permission denied to delete this invoice');
    }
    await ref.delete();
  }
}

export default InvoiceService;
