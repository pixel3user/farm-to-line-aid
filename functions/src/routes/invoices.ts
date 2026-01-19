import express, { Request, Response } from "express";
import { getAuthorizedUserId } from "./api";
import { InvoiceService } from "../lib/invoice-service";
import { Invoice } from "../types/invoice";
import { extractInvoiceFromImageBase64, parseScanPayload } from "../lib/invoice-ai";

const router = express.Router();

// Get all invoices for the user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = await getAuthorizedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const invoices = await InvoiceService.getInvoicesByUser(userId);
    res.json(invoices);
  } catch (error) {
    console.error("Invoices error:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// Create a new invoice
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = await getAuthorizedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const invoiceData = req.body as Partial<Invoice>;
    const result = await InvoiceService.createInvoice(userId, invoiceData);
    res.status(201).json({ success: true, result });
  } catch (error) {
    console.error("Create invoice error:", error);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

// Update an invoice
router.put("/:id", async (req: Request, res: Response) => {
    try {
        const userId = await getAuthorizedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { id } = req.params;
        const invoiceData = req.body as Partial<Invoice>;
        await InvoiceService.updateInvoice(userId, id, invoiceData);
        res.json({ success: true });
    } catch (error) {
        console.error("Update invoice error:", error);
        res.status(500).json({ error: "Failed to update invoice" });
    }
});


// Delete an invoice
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const userId = await getAuthorizedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { id } = req.params;
        await InvoiceService.deleteInvoice(userId, id);
        res.json({ success: true });
    } catch (error) {
        console.error("Delete invoice error:", error);
        res.status(500).json({ error: "Failed to delete invoice" });
    }
});

const createCsv = (rows: Array<Record<string, unknown>>, columns: Array<{ key: string; header: string }>) => {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const header = columns.map((c) => escape(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(','));
  return [header, ...lines].join('\n');
};

const handleInvoiceScan = async (req: Request, res: Response) => {
    try {
        const userId = await getAuthorizedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { mimeType, dataBase64, locale } = parseScanPayload(req.body);
        if (!dataBase64) {
          return res.status(400).json({ error: "dataBase64 (or dataUrl) is required" });
        }

        const createInvoice = Boolean(req.body?.createInvoice);
        const extraction = await extractInvoiceFromImageBase64({ dataBase64, mimeType, locale });

        let created: { id: string } | null = null;
        if (createInvoice) {
          const inv = extraction.invoice;
          const issueDate = inv.issueDate && inv.issueDate.length >= 8 ? inv.issueDate : new Date().toISOString().slice(0, 10);
          created = await InvoiceService.createInvoice(userId, {
            direction: inv.direction ?? 'sale',
            status: inv.status ?? 'draft',
            invoiceNumber: inv.invoiceNumber || '',
            counterpartyName: inv.counterpartyName || '',
            description: inv.description || '',
            currency: inv.currency || 'USD',
            total: typeof inv.total === 'number' ? inv.total : 0,
            paid: typeof inv.paid === 'number' ? inv.paid : 0,
            issueDate,
            dueDate: inv.dueDate,
            deliveryDate: inv.deliveryDate,
            items: inv.items,
            attachmentCount: 1,
            rawText: extraction.rawText,
            extraction: {
              provider: extraction.provider,
              model: extraction.model,
              confidence: extraction.confidence,
              warnings: extraction.warnings,
            },
          });
        }

        res.json({ extraction, created });
    } catch (error) {
        console.error("Invoice scan error:", error);
        const message = (error as Error)?.message || String(error);
        res.status(500).json({
          error: "Failed to scan invoice",
          message,
          hint:
            "Check server logs. Common causes: missing/invalid GEMINI_API_KEY, unsupported image, or blocked outbound network in emulator/runtime.",
        });
    }
};

// AI scan + extraction (image base64)
router.post("/scan", handleInvoiceScan);

// Backward-compatible OCR route (deprecated)
router.post("/ocr", async (req: Request, res: Response) => {
  req.body = { ...req.body, createInvoice: false };
  return handleInvoiceScan(req, res);
});

// Export to CSV (Excel-compatible)
router.get("/export", async (req: Request, res: Response) => {
    try {
        const userId = await getAuthorizedUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const invoices = await InvoiceService.getInvoicesByUser(userId);
        const rows = invoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          counterpartyName: inv.counterpartyName,
          direction: inv.direction,
          status: inv.status,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate || '',
          deliveryDate: inv.deliveryDate || '',
          currency: inv.currency,
          total: inv.total,
          paid: inv.paid,
          balance: (inv.total || 0) - (inv.paid || 0),
        }));

        const csv = createCsv(rows, [
          { key: 'invoiceNumber', header: 'Invoice #' },
          { key: 'counterpartyName', header: 'Buyer/Supplier' },
          { key: 'direction', header: 'Type' },
          { key: 'status', header: 'Status' },
          { key: 'issueDate', header: 'Issue Date' },
          { key: 'dueDate', header: 'Due Date' },
          { key: 'deliveryDate', header: 'Delivery Date' },
          { key: 'currency', header: 'Currency' },
          { key: 'total', header: 'Total' },
          { key: 'paid', header: 'Paid' },
          { key: 'balance', header: 'Balance' },
        ]);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=invoices.csv');
        res.status(200).send(csv);

    } catch (error) {
        console.error("Export error:", error);
        res.status(500).json({ error: "Failed to export invoices" });
    }
});

export default router;
