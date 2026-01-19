import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import resolveApiBaseUrl from '@/lib/api';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Columns3,
  Download,
  FileText,
  Filter,
  MoreHorizontal,
  Plus,
  Scan,
  Search,
  Upload,
} from 'lucide-react';

type InvoiceStatus = 'paid' | 'overdue' | 'open' | 'draft';
type InvoiceDirection = 'sale' | 'purchase';

type InvoiceRow = {
  id: string;
  direction: InvoiceDirection;
  status: InvoiceStatus;
  invoiceNumber: string;
  counterpartyName: string;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  deliveryDate?: string; // YYYY-MM-DD
  currency: string;
  total: number;
  paid: number;
  items: number;
  attachmentCount: number;
  notes?: string;
};

type ScanJobStatus = 'queued' | 'scanning' | 'extracting' | 'ready' | 'failed';
type ScanJob = {
  id: string;
  fileName: string;
  status: ScanJobStatus;
  progress: number;
  extracted?: Partial<InvoiceRow>;
  error?: string;
};

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`);

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

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const StatusPill: React.FC<{ status: InvoiceStatus; t: (key: string) => string }> = ({ status, t }) => {
  const { label, className } = useMemo(() => {
    switch (status) {
      case 'paid':
        return { label: t('invoices.statusPaid'), className: 'border-green-200 bg-green-50 text-green-700' };
      case 'overdue':
        return { label: t('invoices.statusOverdue'), className: 'border-red-200 bg-red-50 text-red-700' };
      case 'open':
        return { label: t('invoices.statusOpen'), className: 'border-amber-200 bg-amber-50 text-amber-700' };
      case 'draft':
        return { label: t('invoices.statusDraft'), className: 'border-gray-200 bg-gray-50 text-gray-700' };
      default:
        return { label: status, className: '' };
    }
  }, [status, t]);

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
};

const DirectionPill: React.FC<{ direction: InvoiceDirection; isFarmer: boolean; t: (key: string) => string }> = ({
  direction,
  isFarmer,
  t,
}) => {
  const label =
    direction === 'sale'
      ? isFarmer
        ? t('invoices.typeSales')
        : t('invoices.typeOutgoing')
      : isFarmer
        ? t('invoices.typePurchases')
        : t('invoices.typeSupplier');
  const className =
    direction === 'sale' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-purple-200 bg-purple-50 text-purple-700';
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
};

const allColumns = [
  { key: 'status', label: 'Status' },
  { key: 'direction', label: 'Type' },
  { key: 'invoiceNumber', label: 'Invoice #' },
  { key: 'counterpartyName', label: 'Buyer / Supplier' },
  { key: 'issueDate', label: 'Issue Date' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'deliveryDate', label: 'Delivery' },
  { key: 'items', label: 'Items' },
  { key: 'total', label: 'Total' },
  { key: 'paid', label: 'Paid' },
  { key: 'balance', label: 'Balance' },
  { key: 'attachmentCount', label: 'Files' },
] as const;

type ColumnKey = (typeof allColumns)[number]['key'];
type SortKey = Exclude<ColumnKey, 'balance'> | 'balance';
type SortDirection = 'asc' | 'desc';

const InvoiceList: React.FC = () => {
  const { user, firebaseUser } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const apiBaseUrl = resolveApiBaseUrl();
  const apiUrl = useMemo(() => (path: string) => `${apiBaseUrl}/api${path.startsWith('/') ? path : `/${path}`}`, [apiBaseUrl]);

  const isFarmer = user?.role !== 'market';
  const pageLabel = isFarmer ? t('invoices.titleFarmer') : t('invoices.titleBuyer');

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [direction, setDirection] = useState<InvoiceDirection | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('issueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [detailsInvoiceId, setDetailsInvoiceId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(() => {
    const base: Record<ColumnKey, boolean> = {
      status: true,
      direction: !isMobile,
      invoiceNumber: true,
      counterpartyName: true,
      issueDate: true,
      dueDate: !isMobile,
      deliveryDate: !isMobile,
      items: !isMobile,
      total: true,
      paid: !isMobile,
      balance: true,
      attachmentCount: !isMobile,
    };
    return base;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanJobs, setScanJobs] = useState<ScanJob[]>([]);

  useEffect(() => {
    const loadInvoices = async () => {
      if (!firebaseUser) {
        setInvoices([]);
        return;
      }
      try {
        const response = await fetch(apiUrl('/invoices'), {
          headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
        });
        if (!response.ok) throw new Error('Failed to fetch invoices');
        const data = await response.json();
        const mapped: InvoiceRow[] = Array.isArray(data)
          ? data.map((inv: any) => {
              const total = typeof inv.total === 'number' ? inv.total : typeof inv.amount === 'number' ? inv.amount : 0;
              const paid = typeof inv.paid === 'number' ? inv.paid : 0;
              const issueDate =
                typeof inv.issueDate === 'string'
                  ? inv.issueDate
                  : typeof inv.date === 'string'
                    ? String(inv.date).slice(0, 10)
                    : new Date().toISOString().slice(0, 10);
              return {
                id: String(inv.id || newId()),
                direction: inv.direction === 'purchase' ? 'purchase' : 'sale',
                status:
                  inv.status === 'paid' || inv.status === 'open' || inv.status === 'overdue' || inv.status === 'draft'
                    ? inv.status
                    : 'draft',
                invoiceNumber: String(inv.invoiceNumber || inv.id || ''),
                counterpartyName: String(inv.counterpartyName || inv.client || ''),
                issueDate,
                dueDate: typeof inv.dueDate === 'string' ? inv.dueDate : undefined,
                deliveryDate: typeof inv.deliveryDate === 'string' ? inv.deliveryDate : undefined,
                currency: String(inv.currency || 'USD'),
                total,
                paid,
                items: Array.isArray(inv.items) ? inv.items.length : typeof inv.items === 'number' ? inv.items : 0,
                attachmentCount: typeof inv.attachmentCount === 'number' ? inv.attachmentCount : inv.imageUrl ? 1 : 0,
                notes: typeof inv.description === 'string' ? inv.description : undefined,
              } satisfies InvoiceRow;
            })
          : [];
        setInvoices(mapped.length ? mapped : []);
      } catch (error) {
        console.warn('Failed to load invoices', error);
        setInvoices([]);
      }
    };
    void loadInvoices();
  }, [firebaseUser]);

  useEffect(() => {
    if (!isMobile) return;
    setColumns((current) => ({
      ...current,
      direction: false,
      dueDate: false,
      deliveryDate: false,
      items: false,
      paid: false,
      attachmentCount: false,
    }));
  }, [isMobile]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.counterpartyName.toLowerCase().includes(q) ||
        inv.notes?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchesDirection = direction === 'all' || inv.direction === direction;
      return matchesSearch && matchesStatus && matchesDirection;
    });
  }, [direction, invoices, search, statusFilter]);

  const sortedInvoices = useMemo(() => {
    const list = [...filteredInvoices];
    const dir = sortDirection === 'asc' ? 1 : -1;
    const getValue = (inv: InvoiceRow): string | number => {
      if (sortKey === 'balance') return inv.total - inv.paid;
      const value = (inv as any)[sortKey];
      return value ?? '';
    };
    list.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return list;
  }, [filteredInvoices, sortDirection, sortKey]);

  const totals = useMemo(() => {
    const currency = 'USD';
    const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const paid = invoices.reduce((sum, inv) => sum + inv.paid, 0);
    const overdue = invoices.filter((inv) => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.total - inv.paid), 0);
    const open = invoices.filter((inv) => inv.status === 'open').reduce((sum, inv) => sum + (inv.total - inv.paid), 0);
    return { currency, total, paid, overdue, open, balance: total - paid };
  }, [invoices]);

  const columnLabels = useMemo<Record<ColumnKey, string>>(
    () => ({
      status: t('invoices.status'),
      direction: t('invoices.type'),
      invoiceNumber: t('invoices.invoiceNumber'),
      counterpartyName: isFarmer ? t('invoices.buyer') : t('invoices.supplier'),
      issueDate: t('invoices.issueDate'),
      dueDate: t('invoices.dueDate'),
      deliveryDate: t('invoices.deliveryDate'),
      items: t('invoices.items'),
      total: t('invoices.total'),
      paid: t('invoices.paid'),
      balance: t('invoices.balance'),
      attachmentCount: t('invoices.files'),
    }),
    [isFarmer, t],
  );

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection('asc');
      return;
    }
    setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  const handleExport = async () => {
    if (!firebaseUser) {
      toast({ title: t('common.signInRequired'), description: t('invoices.exportSignIn'), variant: 'destructive' });
      return;
    }
    try {
      const response = await fetch(apiUrl('/invoices/export'), {
        headers: {
          Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        },
      });
      if (!response.ok) {
        toast({ title: t('invoices.exportFailed'), description: t('invoices.exportFailedDesc'), variant: 'destructive' });
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoices.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error('Error exporting invoices:', error);
      toast({ title: t('invoices.exportFailed'), description: t('common.tryAgain'), variant: 'destructive' });
    }
  };

  const enqueueScanFiles = (files: File[]) => {
    const nextJobs: ScanJob[] = files.map((file) => ({
      id: newId(),
      fileName: file.name,
      status: 'queued',
      progress: 0,
    }));
    setScanJobs((current) => [...nextJobs, ...current].slice(0, 8));

    nextJobs.forEach((job, index) => {
      const file = files[index];
      void (async () => {
        try {
          setScanJobs((current) =>
            current.map((j) => (j.id === job.id ? { ...j, status: 'scanning', progress: 15 } : j)),
          );

          if (!firebaseUser) {
            throw new Error(t('common.signInRequired'));
          }

          if (!(file.type.startsWith('image/'))) {
            throw new Error(t('invoices.scanImagesOnly'));
          }

          const dataBase64 = await readFileAsBase64(file);
          setScanJobs((current) =>
            current.map((j) => (j.id === job.id ? { ...j, status: 'extracting', progress: 55 } : j)),
          );

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
          const extracted: Partial<InvoiceRow> = {
            direction: inv.direction === 'purchase' ? 'purchase' : isFarmer ? 'sale' : 'purchase',
            status:
              inv.status === 'paid' || inv.status === 'open' || inv.status === 'overdue' || inv.status === 'draft'
                ? inv.status
                : 'draft',
            invoiceNumber: String(inv.invoiceNumber || ''),
            counterpartyName: String(inv.counterpartyName || ''),
            issueDate: String(inv.issueDate || new Date().toISOString().slice(0, 10)),
            dueDate: inv.dueDate ? String(inv.dueDate) : undefined,
            deliveryDate: inv.deliveryDate ? String(inv.deliveryDate) : undefined,
            currency: String(inv.currency || 'USD'),
            total: typeof inv.total === 'number' ? inv.total : 0,
            paid: typeof inv.paid === 'number' ? inv.paid : 0,
            items: Array.isArray(inv.items) ? inv.items.length : 0,
            attachmentCount: 1,
            notes: typeof inv.description === 'string' ? inv.description : undefined,
          };

          setScanJobs((current) =>
            current.map((j) => (j.id === job.id ? { ...j, status: 'ready', progress: 100, extracted } : j)),
          );
        } catch (error) {
          setScanJobs((current) =>
            current.map((j) =>
              j.id === job.id ? { ...j, status: 'failed', progress: 100, error: (error as Error).message } : j,
            ),
          );
        }
      })();
    });
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    enqueueScanFiles(Array.from(fileList));
  };

  const addExtractedToList = (job: ScanJob) => {
    if (!job.extracted) return;
    const extracted = job.extracted;
    void (async () => {
      const draftInvoice: InvoiceRow = {
        id: newId(),
        direction: extracted.direction ?? (isFarmer ? 'sale' : 'purchase'),
        status: extracted.status ?? 'draft',
        invoiceNumber: extracted.invoiceNumber ?? `DRAFT-${Date.now()}`,
        counterpartyName: extracted.counterpartyName ?? '',
        issueDate: extracted.issueDate ?? new Date().toISOString().slice(0, 10),
        dueDate: extracted.dueDate,
        deliveryDate: extracted.deliveryDate,
        currency: extracted.currency ?? 'USD',
        total: extracted.total ?? 0,
        paid: extracted.paid ?? 0,
        items: extracted.items ?? 0,
        attachmentCount: extracted.attachmentCount ?? 1,
        notes: extracted.notes,
      };

      try {
        if (!firebaseUser) throw new Error(t('common.signInRequired'));
        const response = await fetch(apiUrl('/invoices'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
          },
          body: JSON.stringify({
            direction: draftInvoice.direction,
            status: draftInvoice.status,
            invoiceNumber: draftInvoice.invoiceNumber,
            counterpartyName: draftInvoice.counterpartyName,
            description: draftInvoice.notes || '',
            currency: draftInvoice.currency,
            total: draftInvoice.total,
            paid: draftInvoice.paid,
            issueDate: draftInvoice.issueDate,
            dueDate: draftInvoice.dueDate,
            deliveryDate: draftInvoice.deliveryDate,
            items: [],
            attachmentCount: draftInvoice.attachmentCount,
          }),
        });
        if (!response.ok) throw new Error(t('common.tryAgain'));
        const payload = await response.json().catch(() => ({}));
        const createdId = payload?.result?.id;
        setInvoices((current) => [{ ...draftInvoice, id: String(createdId || draftInvoice.id) }, ...current]);
        setScanJobs((current) => current.filter((j) => j.id !== job.id));
        toast({ title: t('common.success'), description: draftInvoice.invoiceNumber });
      } catch (error) {
        setInvoices((current) => [draftInvoice, ...current]);
        setScanJobs((current) => current.filter((j) => j.id !== job.id));
        toast({ title: t('invoices.scanFailed'), description: (error as Error).message, variant: 'destructive' });
      }
    })();
  };

  const Filters: React.FC = () => (
    <div className="grid gap-3 md:grid-cols-12">
      <div className="md:col-span-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('invoices.searchPlaceholder')}
            className="pl-9"
          />
        </div>
      </div>
      <div className="md:col-span-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger>
            <SelectValue placeholder={t('invoices.selectStatusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices.statusAll')}</SelectItem>
            <SelectItem value="open">{t('invoices.statusOpen')}</SelectItem>
            <SelectItem value="overdue">{t('invoices.statusOverdue')}</SelectItem>
            <SelectItem value="paid">{t('invoices.statusPaid')}</SelectItem>
            <SelectItem value="draft">{t('invoices.statusDraft')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-4">
        <Tabs value={direction} onValueChange={(v) => setDirection(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1 min-w-0 truncate">
              {t('invoices.typeAll')}
            </TabsTrigger>
            <TabsTrigger value="sale" className="flex-1 min-w-0 truncate">
              {isFarmer ? t('invoices.typeSales') : t('invoices.typeOutgoing')}
            </TabsTrigger>
            <TabsTrigger value="purchase" className="flex-1 min-w-0 truncate">
              {isFarmer ? t('invoices.typePurchases') : t('invoices.typeSupplier')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );

  const selectedInvoice = useMemo(
    () => (detailsInvoiceId ? invoices.find((inv) => inv.id === detailsInvoiceId) ?? null : null),
    [detailsInvoiceId, invoices],
  );

  return (
    <div className="mx-auto w-full max-w-7xl p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{pageLabel}</h1>
          <Badge variant="secondary">{isFarmer ? t('invoices.badgeFarmerTools') : t('invoices.badgeBuyerTools')}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Scan className="mr-2 h-4 w-4" />
            {t('invoices.scan')}
          </Button>
          <Button onClick={() => navigate('/invoices/new')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('invoices.new')}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t('invoices.export')}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('invoices.statOpenBalance')}</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatMoney(totals.open, totals.currency)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('invoices.statusOverdue')}</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatMoney(totals.overdue, totals.currency)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('invoices.statusPaid')}</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatMoney(totals.paid, totals.currency)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('invoices.total')}</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatMoney(totals.total, totals.currency)}</CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {t('invoices.overviewTitle')}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {t('invoices.overviewHint')}
                  </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="md:hidden">
                        <Filter className="mr-2 h-4 w-4" />
                        {t('invoices.filters')}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="max-h-[85vh]">
                      <SheetHeader>
                        <SheetTitle>{t('invoices.filters')}</SheetTitle>
                      </SheetHeader>
                      <div className="mt-4">
                        <Filters />
                      </div>
                    </SheetContent>
                  </Sheet>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="hidden md:inline-flex">
                        <Columns3 className="mr-2 h-4 w-4" />
                        {t('invoices.columns')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>{t('invoices.columnsShowHide')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {allColumns.map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col.key}
                          checked={columns[col.key]}
                          onCheckedChange={(checked) =>
                            setColumns((current) => ({ ...current, [col.key]: Boolean(checked) }))
                          }
                        >
                          {columnLabels[col.key]}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="hidden md:block">
                <Filters />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isMobile ? (
                <div className="space-y-2 p-3">
                  {sortedInvoices.length ? (
                    sortedInvoices.map((inv) => {
                      const balance = inv.total - inv.paid;
                      return (
                        <button
                          key={inv.id}
                          type="button"
                          className="w-full rounded-lg border bg-background p-3 text-left hover:bg-muted/20"
                          onClick={() => setDetailsInvoiceId(inv.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <StatusPill status={inv.status} t={t} />
                                <DirectionPill direction={inv.direction} isFarmer={isFarmer} t={t} />
                              </div>
                              <div className="mt-2 truncate text-sm font-semibold">{inv.invoiceNumber || t('invoices.invoiceNumber')}</div>
                              <div className="mt-1 truncate text-sm text-muted-foreground">{inv.counterpartyName || '—'}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-semibold">{formatMoney(balance, inv.currency)}</div>
                              <div className="text-xs text-muted-foreground">{formatDate(inv.issueDate)}</div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div className="truncate">
                              {t('invoices.total')}: {formatMoney(inv.total, inv.currency)}
                            </div>
                            <div className="truncate text-right">
                              {t('invoices.dueDate')}: {formatDate(inv.dueDate)}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border bg-background p-6 text-center">
                      <div className="text-sm font-semibold">{t('invoices.emptyTitle')}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{t('invoices.emptyDesc')}</div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <Scan className="mr-2 h-4 w-4" />
                          {t('invoices.scan')}
                        </Button>
                        <Button onClick={() => navigate('/invoices/new')}>
                          <Plus className="mr-2 h-4 w-4" />
                          {t('invoices.new')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-h-[60vh] w-full max-w-full overflow-auto">
                  <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      {columns.status && (
                        <TableHead className="whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('status')}
                            className="inline-flex items-center gap-1"
                          >
                            {columnLabels.status}
                            {sortKey === 'status' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </button>
                        </TableHead>
                      )}
                      {columns.direction && <TableHead className="whitespace-nowrap">{columnLabels.direction}</TableHead>}
                      {columns.invoiceNumber && (
                        <TableHead className="whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('invoiceNumber')}
                            className="inline-flex items-center gap-1"
                          >
                            {columnLabels.invoiceNumber}
                            {sortKey === 'invoiceNumber' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </button>
                        </TableHead>
                      )}
                      {columns.counterpartyName && (
                        <TableHead className="whitespace-nowrap">{columnLabels.counterpartyName}</TableHead>
                      )}
                      {columns.issueDate && (
                        <TableHead className="whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('issueDate')}
                            className="inline-flex items-center gap-1"
                          >
                            {columnLabels.issueDate}
                            {sortKey === 'issueDate' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </button>
                        </TableHead>
                      )}
                      {columns.dueDate && <TableHead className="whitespace-nowrap">{columnLabels.dueDate}</TableHead>}
                      {columns.deliveryDate && (
                        <TableHead className="whitespace-nowrap">
                          <Calendar className="mr-1 inline h-4 w-4 text-muted-foreground" />
                          {columnLabels.deliveryDate}
                        </TableHead>
                      )}
                      {columns.items && <TableHead className="whitespace-nowrap text-right">{columnLabels.items}</TableHead>}
                      {columns.total && (
                        <TableHead className="whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('total')}
                            className="inline-flex items-center gap-1"
                          >
                            {columnLabels.total}
                            {sortKey === 'total' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </button>
                        </TableHead>
                      )}
                      {columns.paid && <TableHead className="whitespace-nowrap text-right">{columnLabels.paid}</TableHead>}
                      {columns.balance && (
                        <TableHead className="whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort('balance')}
                            className="inline-flex items-center gap-1"
                          >
                            {columnLabels.balance}
                            {sortKey === 'balance' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </button>
                        </TableHead>
                      )}
                      {columns.attachmentCount && (
                        <TableHead className="whitespace-nowrap text-right">{columnLabels.attachmentCount}</TableHead>
                      )}
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedInvoices.map((inv) => {
                      const balance = inv.total - inv.paid;
                      return (
                        <TableRow
                          key={inv.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setDetailsInvoiceId(inv.id)}
                        >
                          {columns.status && (
                            <TableCell className="whitespace-nowrap">
                              <StatusPill status={inv.status} t={t} />
                            </TableCell>
                          )}
                          {columns.direction && (
                            <TableCell className="whitespace-nowrap">
                              <DirectionPill direction={inv.direction} isFarmer={isFarmer} t={t} />
                            </TableCell>
                          )}
                          {columns.invoiceNumber && (
                            <TableCell className="max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap font-medium sm:max-w-none">
                              {inv.invoiceNumber}
                            </TableCell>
                          )}
                          {columns.counterpartyName && (
                            <TableCell className="max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap sm:max-w-none">
                              {inv.counterpartyName}
                            </TableCell>
                          )}
                          {columns.issueDate && <TableCell className="whitespace-nowrap">{formatDate(inv.issueDate)}</TableCell>}
                          {columns.dueDate && <TableCell className="whitespace-nowrap">{formatDate(inv.dueDate)}</TableCell>}
                          {columns.deliveryDate && <TableCell className="whitespace-nowrap">{formatDate(inv.deliveryDate)}</TableCell>}
                          {columns.items && <TableCell className="whitespace-nowrap text-right">{inv.items}</TableCell>}
                          {columns.total && (
                            <TableCell className="whitespace-nowrap text-right">{formatMoney(inv.total, inv.currency)}</TableCell>
                          )}
                          {columns.paid && (
                            <TableCell className="whitespace-nowrap text-right">{formatMoney(inv.paid, inv.currency)}</TableCell>
                          )}
                          {columns.balance && (
                            <TableCell className="whitespace-nowrap text-right">{formatMoney(balance, inv.currency)}</TableCell>
                          )}
                          {columns.attachmentCount && (
                            <TableCell className="whitespace-nowrap text-right">{inv.attachmentCount}</TableCell>
                          )}
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>{t('invoices.actions')}</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => setDetailsInvoiceId(inv.id)}>{t('invoices.viewDetails')}</DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    toast({ title: t('common.comingSoon'), description: t('invoices.pdfSoon') })
                                  }
                                >
                                  {t('invoices.downloadPdf')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() =>
                                    toast({ title: t('common.comingSoon'), description: t('invoices.aiToolsSoon') })
                                  }
                                >
                                  {isFarmer ? t('invoices.sendReminder') : t('invoices.approvePayment')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!sortedInvoices.length ? (
                      <TableRow>
                        <TableCell colSpan={999} className="py-10 text-center text-sm text-muted-foreground">
                          {t('invoices.noResults')}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card
            className="border-dashed"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files || []).filter((f) =>
                ['application/pdf'].includes(f.type) || f.type.startsWith('image/'),
              );
              if (!files.length) return;
              enqueueScanFiles(files);
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                {t('invoices.scannerTitle')}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {t('invoices.scannerHint')}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                  <Scan className="mr-2 h-4 w-4" />
                  {t('invoices.scanUpload')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    toast({
                      title: t('common.comingSoon'),
                      description: isFarmer ? t('invoices.comingSoonFarmer') : t('invoices.comingSoonBuyer'),
                    })
                  }
                >
                  {isFarmer ? t('invoices.matchDeliveries') : t('invoices.approveAndPay')}
                </Button>
              </div>

              {scanJobs.length ? (
                <div className="space-y-2">
                  {scanJobs.map((job) => (
                    <div key={job.id} className="rounded-md border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{job.fileName}</div>
                          <div className="text-xs text-muted-foreground">
                            {job.status === 'queued'
                              ? t('invoices.scanQueued')
                              : job.status === 'scanning'
                                ? t('invoices.scanScanning')
                                : job.status === 'extracting'
                                  ? t('invoices.scanExtracting')
                                  : job.status === 'ready'
                                    ? t('invoices.scanReady')
                                    : t('invoices.scanFailed')}
                          </div>
                        </div>
                        {job.status === 'ready' ? (
                          <Button size="sm" onClick={() => addExtractedToList(job)}>
                            {t('common.add')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              toast({ title: t('invoices.scanScanning'), description: t('invoices.scannerHint') })
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-2">
                        <Progress value={job.progress} className="h-2" />
                      </div>
                      {job.status === 'ready' && job.extracted ? (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div className="truncate">#{job.extracted.invoiceNumber}</div>
                          <div className="truncate text-right">{job.extracted.counterpartyName}</div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                  {t('invoices.scanTip')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Columns3 className="h-4 w-4 text-muted-foreground" />
                {t('invoices.roleToolsTitle')}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {isFarmer ? t('invoices.roleToolsHintFarmer') : t('invoices.roleToolsHintBuyer')}
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Button
                variant="outline"
                onClick={() => toast({ title: t('common.comingSoon'), description: t('invoices.comingSoonReminders') })}
                className="justify-start"
              >
                {isFarmer ? t('invoices.sendReminders') : t('invoices.requestCorrections')}
              </Button>
              <Button
                variant="outline"
                onClick={() => toast({ title: t('common.comingSoon'), description: t('invoices.comingSoonBulk') })}
                className="justify-start"
              >
                {isFarmer ? t('invoices.reconcilePayouts') : t('invoices.matchToDeliveries') }
              </Button>
              <Button
                variant="outline"
                onClick={() => toast({ title: t('common.comingSoon'), description: t('invoices.comingSoonTags') })}
                className="justify-start"
              >
                {t('invoices.addTags')}
              </Button>
              <Button
                variant="outline"
                onClick={() => toast({ title: t('common.comingSoon'), description: t('invoices.comingSoonInsights') })}
                className="justify-start"
              >
                {t('invoices.aiInsights')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={Boolean(detailsInvoiceId)} onOpenChange={(open) => (!open ? setDetailsInvoiceId(null) : undefined)}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'max-h-[85vh]' : 'w-[420px]'}>
          <SheetHeader>
            <SheetTitle>{t('invoices.detailsTitle')}</SheetTitle>
          </SheetHeader>
          {selectedInvoice ? (
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={selectedInvoice.status} />
                <DirectionPill direction={selectedInvoice.direction} isFarmer={isFarmer} />
                <Badge variant="secondary">{selectedInvoice.invoiceNumber}</Badge>
              </div>

              <div className="grid gap-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">{isFarmer ? t('invoices.buyer') : t('invoices.supplier')}</div>
                  <div className="font-medium">{selectedInvoice.counterpartyName}</div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">{t('invoices.issueDate')}</div>
                  <div className="font-medium">{formatDate(selectedInvoice.issueDate)}</div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">{t('invoices.dueDate')}</div>
                  <div className="font-medium">{formatDate(selectedInvoice.dueDate)}</div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">{t('invoices.deliveryDate')}</div>
                  <div className="font-medium">{formatDate(selectedInvoice.deliveryDate)}</div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">{t('invoices.items')}</div>
                  <div className="font-medium">{selectedInvoice.items}</div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">{t('invoices.total')}</div>
                  <div className="font-semibold">{formatMoney(selectedInvoice.total, selectedInvoice.currency)}</div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">{t('invoices.paid')}</div>
                  <div className="font-medium">{formatMoney(selectedInvoice.paid, selectedInvoice.currency)}</div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">{t('invoices.balance')}</div>
                  <div className="font-semibold">
                    {formatMoney(selectedInvoice.total - selectedInvoice.paid, selectedInvoice.currency)}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">{t('invoices.files')}</div>
                  <div className="font-medium">{selectedInvoice.attachmentCount}</div>
                </div>
              </div>

              {selectedInvoice.notes ? (
                <div className="rounded-md border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Notes</div>
                  <div className="mt-1">{selectedInvoice.notes}</div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => toast({ title: t('common.comingSoon'), description: t('invoices.comingSoonEdit') })}
                >
                  {t('common.edit')}
                </Button>
                <Button
                  onClick={() =>
                    toast({
                      title: t('common.comingSoon'),
                      description: isFarmer ? t('invoices.comingSoonPayLinks') : t('invoices.comingSoonApprove'),
                    })
                  }
                >
                  {isFarmer ? t('invoices.sendReminder') : t('invoices.approve')}
                </Button>
                <Button variant="secondary" onClick={() => setDetailsInvoiceId(null)}>
                  {t('common.close')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-sm text-muted-foreground">{t('invoices.detailsEmpty')}</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default InvoiceList;
