import { GoogleGenAI } from '@google/genai';

export type InvoiceAiLocale = 'en' | 'zh-TW';

export type InvoiceAiExtraction = {
  rawText: string;
  invoice: {
    direction?: 'sale' | 'purchase';
    status?: 'draft' | 'open' | 'paid' | 'overdue';
    invoiceNumber?: string;
    counterpartyName?: string;
    description?: string;
    currency?: string;
    total?: number;
    paid?: number;
    issueDate?: string;
    dueDate?: string;
    deliveryDate?: string;
    items?: Array<{
      description: string;
      quantity?: number;
      unitPrice?: number;
      lineTotal?: number;
    }>;
  };
  confidence?: number;
  warnings?: string[];
  provider: 'gemini' | 'mock';
  model?: string;
};

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GENERATIVE_LANGUAGE_API_KEY ||
  '';

const INVOICE_MODEL = process.env.GEMINI_INVOICE_MODEL || 'gemini-2.5-flash';

const coerceNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
};

const ensureImageForModel = async (input: Buffer) => {
  // Gemini image inline data works best when the image is not huge.
  // Resize and convert to JPEG to keep payload small and consistent.
  // `sharp` is a native dependency; load lazily so non-scan routes don't crash if it's unavailable.
  try {
    const { default: sharp } = await import('sharp');
    const image = sharp(input, { failOnError: false });
    const meta = await image.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const maxDim = Math.max(width, height);
    const shouldResize = maxDim > 1800;
    const pipeline = shouldResize ? image.resize({ width: 1800, height: 1800, fit: 'inside' }) : image;
    return pipeline.jpeg({ quality: 80 }).toBuffer();
  } catch (error) {
    console.warn('[invoice-ai] sharp unavailable; sending original bytes', error);
    return input;
  }
};

const stripDataUrl = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], dataBase64: match[2] };
  return { mimeType: undefined, dataBase64: trimmed };
};

export const extractInvoiceFromImageBase64 = async (input: {
  dataBase64: string;
  mimeType?: string;
  locale?: InvoiceAiLocale;
}): Promise<InvoiceAiExtraction> => {
  const { dataBase64, mimeType, locale } = input;

  if (!dataBase64 || typeof dataBase64 !== 'string') {
    throw new Error('Missing image dataBase64.');
  }

  const langInstruction =
    locale === 'zh-TW'
      ? '欄位值請保持原始文件語言；JSON 欄位名稱固定使用英文鍵名。'
      : 'Keep field values in the original document language; JSON keys must be English.';

  if (!GEMINI_API_KEY) {
    return {
      provider: 'mock',
      model: undefined,
      rawText: '',
      invoice: {
        status: 'draft',
        currency: 'USD',
      },
      confidence: 0,
      warnings: ['Missing GEMINI_API_KEY on server.'],
    };
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const bytes = Buffer.from(dataBase64, 'base64');
  const imageBytes = await ensureImageForModel(bytes);

  const systemPrompt = [
    'You are an invoice extraction engine.',
    'Output ONLY strict JSON. No markdown, no commentary.',
    'Return this JSON schema:',
    '{',
    '  "rawText": string,',
    '  "invoice": {',
    '    "direction": "sale"|"purchase",',
    '    "status": "draft"|"open"|"paid"|"overdue",',
    '    "invoiceNumber": string,',
    '    "counterpartyName": string,',
    '    "description": string,',
    '    "currency": string,',
    '    "total": number,',
    '    "paid": number,',
    '    "issueDate": "YYYY-MM-DD",',
    '    "dueDate": "YYYY-MM-DD",',
    '    "deliveryDate": "YYYY-MM-DD",',
    '    "items": [ { "description": string, "quantity": number, "unitPrice": number, "lineTotal": number } ]',
    '  },',
    '  "confidence": number,',
    '  "warnings": string[]',
    '}',
    'Rules:',
    '- If a field is missing, use empty string for strings, 0 for numbers, empty array for items.',
    '- rawText should include the most important detected text (invoice number, dates, totals, line items).',
    '- confidence is 0..1, estimate your extraction confidence.',
    `- ${langInstruction}`,
  ].join('\n');

  const response = await ai.models.generateContent({
    model: INVOICE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              mimeType: mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
              data: imageBytes.toString('base64'),
            },
          },
        ],
      },
    ],
  });

  const text =
    response.text ||
    response.candidates?.[0]?.content?.parts
      ?.map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('') ||
    '';

  const parsed = (() => {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse Gemini JSON: ${(error as Error).message}`);
    }
  })();

  const invoice = parsed?.invoice ?? {};
  const extraction: InvoiceAiExtraction = {
    provider: 'gemini',
    model: INVOICE_MODEL,
    rawText: typeof parsed?.rawText === 'string' ? parsed.rawText : '',
    invoice: {
      direction: invoice.direction === 'purchase' ? 'purchase' : 'sale',
      status:
        invoice.status === 'open' || invoice.status === 'paid' || invoice.status === 'overdue' ? invoice.status : 'draft',
      invoiceNumber: typeof invoice.invoiceNumber === 'string' ? invoice.invoiceNumber : '',
      counterpartyName: typeof invoice.counterpartyName === 'string' ? invoice.counterpartyName : '',
      description: typeof invoice.description === 'string' ? invoice.description : '',
      currency: typeof invoice.currency === 'string' ? invoice.currency : 'USD',
      total: coerceNumber(invoice.total) ?? 0,
      paid: coerceNumber(invoice.paid) ?? 0,
      issueDate: normalizeDate(invoice.issueDate) ?? '',
      dueDate: normalizeDate(invoice.dueDate),
      deliveryDate: normalizeDate(invoice.deliveryDate),
      items: Array.isArray(invoice.items)
        ? invoice.items
            .map((item: any) => ({
              description: typeof item?.description === 'string' ? item.description : '',
              quantity: coerceNumber(item?.quantity),
              unitPrice: coerceNumber(item?.unitPrice),
              lineTotal: coerceNumber(item?.lineTotal),
            }))
            .filter((item: any) => item.description)
        : [],
    },
    confidence: coerceNumber(parsed?.confidence),
    warnings: Array.isArray(parsed?.warnings) ? parsed.warnings.map((w: any) => String(w)) : [],
  };

  return extraction;
};

export const parseScanPayload = (body: any): { mimeType?: string; dataBase64: string; locale?: InvoiceAiLocale } => {
  const localeRaw = typeof body?.locale === 'string' ? body.locale.trim() : '';
  const locale = localeRaw === 'zh-TW' || localeRaw === 'zh_tw' || localeRaw === 'zh-TW' ? 'zh-TW' : 'en';

  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : undefined;
  const rawData =
    typeof body?.dataBase64 === 'string'
      ? body.dataBase64
      : typeof body?.dataUrl === 'string'
        ? body.dataUrl
        : '';

  const { mimeType: fromUrl, dataBase64 } = stripDataUrl(rawData);
  return { mimeType: mimeType || fromUrl, dataBase64, locale };
};
