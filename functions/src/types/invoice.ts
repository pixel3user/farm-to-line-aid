export interface Invoice {
  id: string;
  userId: string;
  direction: 'sale' | 'purchase';
  status: 'draft' | 'open' | 'paid' | 'overdue';
  invoiceNumber: string;
  counterpartyName: string;
  description: string;
  currency: string;
  total: number;
  paid: number;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  deliveryDate?: string; // YYYY-MM-DD
  items?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    lineTotal?: number;
  }>;
  attachmentCount?: number;
  // Raw text from OCR
  rawText?: string;
  createdAt?: string;
  updatedAt?: string;
  extraction?: {
    provider: 'gemini' | 'mock';
    model?: string;
    confidence?: number;
    warnings?: string[];
  };
}
