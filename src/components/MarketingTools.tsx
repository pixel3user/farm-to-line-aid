import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Clipboard, Download, Image as ImageIcon, Loader2, Sparkles, X } from 'lucide-react';

type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; base64: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

const languageLabel = (language: string) => (language === 'zh-TW' ? 'Traditional Chinese' : 'English');

const readImageFile = (file: File) =>
  new Promise<{ previewUrl: string; base64: string; mimeType: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read image file.'));
        return;
      }
      const previewUrl = reader.result;
      const base64 = previewUrl.split(',')[1] ?? '';
      if (!base64) {
        reject(new Error('Unable to extract image data.'));
        return;
      }
      resolve({ previewUrl, base64, mimeType: file.type || 'image/png' });
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });

const MarketingTools: React.FC = () => {
  const { userProducts } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [uploadedImage, setUploadedImage] = useState<{
    name: string;
    previewUrl: string;
    base64: string;
    mimeType: string;
  } | null>(null);

  const [outputText, setOutputText] = useState('');
  const [outputImages, setOutputImages] = useState<Array<{ base64: string; mimeType: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userProducts?.length) return;
    if (!selectedProductId || !userProducts.some((item) => item.id === selectedProductId)) {
      setSelectedProductId(userProducts[0].id);
    }
  }, [userProducts, selectedProductId]);

  const selectedProduct = useMemo(
    () => userProducts?.find((item) => item.id === selectedProductId),
    [userProducts, selectedProductId]
  );

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast({
        title: t('farmer.marketing.copied') ?? 'Copied',
        description: t('farmer.marketing.contentCopied') ?? 'Content copied to clipboard.'
      });
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      toast({
        title: t('farmer.marketing.generationFailed') ?? 'Copy failed',
        description: (err as Error).message,
        variant: 'destructive'
      });
    }
  };

  const handleDownloadImage = (image: { base64: string; mimeType: string }, index: number) => {
    const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `marketing-image-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      toast({
        title: 'Image too large',
        description: 'Please upload an image under 8MB.',
        variant: 'destructive'
      });
      event.target.value = '';
      return;
    }

    try {
      const data = await readImageFile(file);
      setUploadedImage({ name: file.name, ...data });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: (err as Error).message,
        variant: 'destructive'
      });
      event.target.value = '';
    }
  };

  const clearUpload = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const generate = async () => {
    if (!selectedProduct) {
      toast({
        title: 'Select a product',
        description: 'Add at least one product before generating marketing content.'
      });
      return;
    }

    setIsGenerating(true);
    setOutputText('');
    setOutputImages([]);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/marketing/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          product: {
            name: selectedProduct.name,
            category: selectedProduct.category,
            description: selectedProduct.description
          },
          image: uploadedImage
            ? {
                base64: uploadedImage.base64,
                mimeType: uploadedImage.mimeType
              }
            : undefined
        })
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(trimmed) as StreamEvent;
          } catch {
            continue;
          }

          if (event.type === 'text') {
            setOutputText((prev) => prev + event.text);
          } else if (event.type === 'image') {
            setOutputImages((prev) => [...prev, { base64: event.base64, mimeType: event.mimeType }]);
          } else if (event.type === 'error') {
            setError(event.message);
          } else if (event.type === 'done') {
            // no-op
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="flex items-center gap-3 text-3xl font-semibold">
          <Sparkles className="h-7 w-7 text-primary" />
          {t('farmer.marketing.title') ?? 'AI Marketing Tools'}
        </h1>
        <p className="text-muted-foreground">
          {t('farmer.marketing.subtitle') ?? 'Generate marketing text and an image for your product.'}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Generate marketing image + text
          </CardTitle>
          <CardDescription>
            Uses Gemini Flash Image to improve an uploaded photo or generate a new one, plus marketing copy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!userProducts?.length ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              Add at least one product to start.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Product</label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {userProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProduct?.category ? (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedProduct.category}</Badge>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Optional image</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      {uploadedImage ? 'Change image' : 'Upload image'}
                    </Button>
                    {uploadedImage ? (
                      <Button type="button" variant="ghost" onClick={clearUpload}>
                        <X className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {uploadedImage ? uploadedImage.name : 'Leave empty to generate a new image.'}
                    </span>
                  </div>
                  {uploadedImage?.previewUrl ? (
                    <div className="overflow-hidden rounded-lg border bg-background p-2">
                      <img src={uploadedImage.previewUrl} alt={uploadedImage.name} className="h-32 w-full object-cover" />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Prompt (optional)</label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Premium, clean studio look. Emphasize freshness. Add a short headline + CTA."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Language: {languageLabel(language)}. The system instruction for image improvement is fixed.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={generate} disabled={isGenerating || !selectedProductId} className="flex items-center gap-2">
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isGenerating ? 'Generating…' : 'Generate'}
                </Button>
                {isGenerating ? (
                  <Button type="button" variant="outline" onClick={stop}>
                    Stop
                  </Button>
                ) : null}
              </div>
            </>
          )}

          {error ? (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive-foreground">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {(outputText || outputImages.length > 0) && (
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Output</CardTitle>
              <CardDescription>Marketing text and generated image(s).</CardDescription>
            </div>
            {outputText ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(outputText, 'output')}
                className="flex items-center gap-2"
              >
                <Clipboard className="h-4 w-4" />
                {copiedId === 'output' ? 'Copied' : 'Copy text'}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {outputText ? (
              <div className="rounded-lg border bg-background p-4 text-sm leading-relaxed whitespace-pre-line">{outputText}</div>
            ) : (
              <div className="text-sm text-muted-foreground">No text yet.</div>
            )}

            {outputImages.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {outputImages.map((img, index) => {
                  const dataUrl = `data:${img.mimeType};base64,${img.base64}`;
                  return (
                    <div key={index} className="overflow-hidden rounded-xl border bg-muted/30 p-3">
                      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-background">
                        <img src={dataUrl} alt={`Generated ${index + 1}`} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleDownloadImage(img, index)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No image yet.</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MarketingTools;

