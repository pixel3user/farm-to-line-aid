import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import resolveApiBaseUrl from '@/lib/api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Camera, ChevronDown, FileText, Scan, Upload } from 'lucide-react';

type InvoiceStatus = 'Draft' | 'Paid' | 'Overdue' | 'Open';
type InvoiceDirection = 'sale' | 'purchase';

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      if (commaIndex >= 0) {
        resolve(result.slice(commaIndex + 1));
      } else {
        resolve(result);
      }
    };
    reader.readAsDataURL(file);
  });

const toApiStatus = (status: InvoiceStatus): 'draft' | 'open' | 'paid' | 'overdue' => {
  switch (status) {
    case 'Paid':
      return 'paid';
    case 'Overdue':
      return 'overdue';
    case 'Open':
      return 'open';
    default:
      return 'draft';
  }
};

const InvoiceCreate = () => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [client, setClient] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('Draft');
  const [direction, setDirection] = useState<InvoiceDirection>('sale');
  const [image, setImage] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [rawOpen, setRawOpen] = useState(false);
  const { user, firebaseUser } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiBaseUrl = resolveApiBaseUrl();
  const apiUrl = useMemo(() => (path: string) => `${apiBaseUrl}/api${path.startsWith('/') ? path : `/${path}`}`, [apiBaseUrl]);

  const isFarmer = user?.role !== 'market';
  const counterpartyLabel = isFarmer ? t('invoices.buyer') : t('invoices.supplier');

  useEffect(() => {
    setDirection(isFarmer ? 'sale' : 'purchase');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFarmer]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImage(file);
      handleOcr(file);
    }
  };

  const handleOcr = async (file: File) => {
    if (!firebaseUser) {
      toast({ title: t('common.signInRequired'), description: t('invoices.scanSignIn'), variant: 'destructive' });
      return;
    }

    setIsExtracting(true);
    setExtractProgress(10);
    setRawText('');
    setRawOpen(false);

    const runProgress = (steps: number[]) => {
      steps.forEach((p, idx) => window.setTimeout(() => setExtractProgress(p), 250 + idx * 350));
    };
    runProgress([25, 45, 65, 85]);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error(t('invoices.scanImagesOnly'));
      }

      const dataBase64 = await readFileAsBase64(file);
      const response = await fetch(apiUrl('/invoices/scan'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        },
        body: JSON.stringify({
          mimeType: file.type,
          dataBase64,
          locale: language,
          createInvoice: false,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || t('invoices.scanFailed'));
      }
      const payload = await response.json();
      const extraction = payload?.extraction;
      const inv = extraction?.invoice || {};

      setDescription(String(inv.description || t('invoices.scannedInvoiceDesc')));
      setAmount(String(typeof inv.total === 'number' ? inv.total : 0));
      setDate(String(inv.issueDate || new Date().toISOString().slice(0, 10)));
      setRawText(String(extraction?.rawText || ''));
      setClient(String(inv.counterpartyName || ''));
      setInvoiceNumber(String(inv.invoiceNumber || ''));
      setDirection(inv.direction === 'purchase' ? 'purchase' : isFarmer ? 'sale' : 'purchase');
      setStatus('Draft');
      setExtractProgress(100);
      setIsExtracting(false);
      toast({ title: t('invoices.scanComplete'), description: t('invoices.scanCompleteDesc') });
    } catch (error) {
      setIsExtracting(false);
      toast({ title: t('invoices.scanFailed'), description: (error as Error).message, variant: 'destructive' });
    }

  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firebaseUser) {
      toast({ title: t('common.signInRequired'), description: t('invoices.saveSignIn'), variant: 'destructive' });
      return;
    }

    const idToken = await firebaseUser.getIdToken();
    const payload = {
      direction,
      description,
      total: parseFloat(amount),
      issueDate: date,
      counterpartyName: client,
      invoiceNumber,
      status: toApiStatus(status),
      rawText,
      currency: 'USD',
    };

    const response = await fetch(apiUrl('/invoices'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      navigate('/invoices');
    } else {
      console.error('Failed to create invoice');
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('invoiceCreate.title')}</h1>
          <div className="text-sm text-muted-foreground">{t('invoiceCreate.subtitle')}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {t('invoiceCreate.upload')}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/invoices')}>
            {t('invoiceCreate.back')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Card
              className="border-dashed"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                setImage(file);
                handleOcr(file);
              }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scan className="h-4 w-4 text-muted-foreground" />
                  {t('invoiceCreate.scanTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="justify-start">
                    <Upload className="mr-2 h-4 w-4" />
                    {t('invoiceCreate.uploadImage')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="justify-start"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {t('invoiceCreate.useCamera')}
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {isExtracting ? (
                  <div className="rounded-md border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{t('invoiceCreate.extracting')}</div>
                      <div className="text-xs text-muted-foreground">{extractProgress}%</div>
                    </div>
                    <div className="mt-2">
                      <Progress value={extractProgress} className="h-2" />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {t('invoiceCreate.extractingHint')}
                    </div>
                  </div>
                ) : null}

                {image ? (
                  <div className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{image.name}</div>
                        <div className="text-xs text-muted-foreground">{Math.round(image.size / 1024)} KB</div>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => handleOcr(image)}>
                        {t('invoiceCreate.rerun')}
                      </Button>
                    </div>
                    {image.type.startsWith('image/') ? (
                      <div className="mt-3 overflow-hidden rounded-md border">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={t('invoiceCreate.previewAlt')}
                          className="h-auto w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        {t('invoiceCreate.pdfPreviewUnavailable')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                    {t('invoiceCreate.dropHere')}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-7">
            <Card>
              <CardHeader>
                <CardTitle>{t('invoices.detailsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="direction">{t('invoices.type')}</Label>
                    <Select value={direction} onValueChange={(v) => setDirection(v as InvoiceDirection)}>
                      <SelectTrigger id="direction">
                        <SelectValue placeholder={t('invoiceCreate.selectTypePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">{isFarmer ? t('invoices.typeSalesInvoice') : t('invoices.typeOutgoingInvoice')}</SelectItem>
                        <SelectItem value="purchase">{isFarmer ? t('invoices.typePurchaseBill') : t('invoices.typeSupplierInvoice')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">{t('invoices.status')}</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
                      <SelectTrigger id="status">
                        <SelectValue placeholder={t('invoiceCreate.selectStatusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">{t('invoices.statusDraft')}</SelectItem>
                        <SelectItem value="Open">{t('invoices.statusOpen')}</SelectItem>
                        <SelectItem value="Paid">{t('invoices.statusPaid')}</SelectItem>
                        <SelectItem value="Overdue">{t('invoices.statusOverdue')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="invoiceNumber">{t('invoices.invoiceNumber')}</Label>
                    <Input id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="date">{t('invoices.issueDate')}</Label>
                    <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>
                </div>

                <div>
                  <Label htmlFor="client">{counterpartyLabel}</Label>
                  <Input id="client" value={client} onChange={(e) => setClient(e.target.value)} required />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="amount">{t('invoices.total')}</Label>
                    <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="description">{t('invoices.description')}</Label>
                    <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} required />
                  </div>
                </div>

                <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      {t('invoiceCreate.rawOcr')}
                      <ChevronDown className={`h-4 w-4 transition-transform ${rawOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 rounded-md border bg-muted/20 p-3">
                      <pre className="max-h-[240px] whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {rawText || t('invoiceCreate.rawOcrEmpty')}
                      </pre>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => navigate('/invoices')} className="w-full sm:w-auto">
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="w-full sm:w-auto" disabled={isExtracting}>
                  {t('invoiceCreate.save')}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InvoiceCreate;
