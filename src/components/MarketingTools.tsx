import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { DatabaseService, MarketingMaterial, Product } from '@/lib/database';
import {
  MarketingAssetContent,
  MarketingCampaignIdea,
  MarketingObjective,
  MarketingTone,
  ProductMarketingSummary,
  geminiService,
  geminiImageService,
  GeneratedMarketingImage,
  MarketingImageRequest
} from '@/lib/gemini';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clipboard,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  Megaphone,
  Sparkles,
  Tag,
  Image as ImageIcon
} from 'lucide-react';

const languageLabel = (language: string) => (language === 'zh-TW' ? 'Traditional Chinese' : 'English');

const OBJECTIVE_TO_TYPE: Record<MarketingObjective, MarketingMaterial['type']> = {
  social_post: 'social_media',
  farm_flyer: 'flyer',
  newsletter: 'flyer',
  recipe_card: 'recipe_card'
};

type ObjectiveOption = {
  value: MarketingObjective;
  label: string;
  description: string;
  channelHint: string;
};

type AudienceOption = {
  value: string;
  label: string;
  description: string;
};

type ToneOption = {
  value: MarketingTone;
  label: string;
  description: string;
};

interface ParsedMaterialContent {
  version?: string;
  generatedAt?: string;
  locale?: string;
  objective?: string;
  tone?: string;
  audience?: string;
  product?: ProductMarketingSummary;
  asset?: MarketingAssetContent;
  images?: Array<{
    mimeType: string;
    base64: string;
    prompt?: string;
    aspectRatio?: string;
  }>;
  content?: unknown;
}

interface StoredMaterial {
  raw: MarketingMaterial;
  parsed: ParsedMaterialContent | null;
  createdAtLabel: string;
}

const DEFAULT_AUDIENCES: AudienceOption[] = [
  {
    value: 'local_restaurants',
    label: 'Local restaurants & cafes',
    description: 'Chefs who want reliable supply, traceable origin and bold flavour.'
  },
  {
    value: 'grocery_buyers',
    label: 'Grocery buyers & wholesalers',
    description: 'Buyers focused on volume, quality consistency and clear pricing.'
  },
  {
    value: 'families',
    label: 'Families & household consumers',
    description: 'Households looking for trustworthy, healthy ingredients.'
  },
  {
    value: 'online_customers',
    label: 'Online followers & community',
    description: 'Digital audience discovering farm products via LINE or social media.'
  }
];

const TONE_OPTIONS: ToneOption[] = [
  { value: 'friendly', label: 'Friendly', description: 'Warm, community-focused voice.' },
  { value: 'professional', label: 'Professional', description: 'Confident, quality-driven tone.' },
  { value: 'playful', label: 'Playful', description: 'Energetic copy that sparks curiosity.' },
  { value: 'premium', label: 'Premium', description: 'Refined language for high-value buyers.' }
];

const OBJECTIVE_VISUAL_STYLES: Record<MarketingObjective, string> = {
  social_post: 'Vibrant social-media-ready hero shot with bold lighting and clean background.',
  farm_flyer: 'Inviting farm-to-table scene highlighting authenticity, fresh produce and farm setting.',
  newsletter: 'Polished storytelling composition featuring product close-up with contextual lifestyle details.',
  recipe_card: 'Step-by-step culinary presentation showing plated dish featuring the hero ingredient.'
};

const TONE_VISUAL_DESCRIPTORS: Record<MarketingTone, string> = {
  friendly: 'Warm natural lighting, approachable styling, inviting atmosphere.',
  professional: 'Crisp studio lighting, balanced composition, premium polish.',
  playful: 'Dynamic angles, lively colours, energetic props.',
  premium: 'Luxurious mood, dramatic lighting, elegant negative space.'
};

const AUDIENCE_VISUAL_CONTEXT: Record<string, string> = {
  local_restaurants: 'In a professional kitchen or chef plating environment to appeal to culinary buyers.',
  grocery_buyers: 'On-shelf or packaging-focused shot emphasising consistency and freshness.',
  families: 'Cozy kitchen or dining table scene that feels wholesome and trustworthy.',
  online_customers: 'Modern digital aesthetic with clean background, perfect for social timelines.'
};

const ASPECT_RATIO_OPTIONS: MarketingImageRequest['aspectRatio'][] = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const IMAGE_COUNT_OPTIONS = [1, 2, 3, 4];
const DEFAULT_NEGATIVE_PROMPT = 'text, lettering, watermark, logo, caption, poster text, typography';

const getObjectiveOptions = (t: (key: string) => string): ObjectiveOption[] => [
  {
    value: 'social_post',
    label: t('farmer.marketing.objective.socialPost') ?? 'Social media post',
    description:
      t('farmer.marketing.objective.socialPostDescription') ??
      'Short-form caption optimised for LINE, Instagram or Facebook.',
    channelHint: 'LINE, Instagram, Facebook'
  },
  {
    value: 'farm_flyer',
    label: t('farmer.marketing.objective.flyer') ?? 'Farm flyer or poster',
    description:
      t('farmer.marketing.objective.flyerDescription') ??
      'Copy designed for printed flyers, market stands or community boards.',
    channelHint: t('farmer.marketing.objective.flyerChannel') ?? 'Farm shop, markets, printed flyers'
  },
  {
    value: 'newsletter',
    label: t('farmer.marketing.objective.newsletter') ?? 'Email / LINE broadcast',
    description:
      t('farmer.marketing.objective.newsletterDescription') ??
      'Longer update for loyal buyers, co-ops or subscription lists.',
    channelHint: t('farmer.marketing.objective.newsletterChannel') ?? 'Email, LINE broadcast'
  },
  {
    value: 'recipe_card',
    label: t('farmer.marketing.objective.recipe') ?? 'Recipe card',
    description:
      t('farmer.marketing.objective.recipeDescription') ??
      'Recipe-style content highlighting the product as the hero ingredient.',
    channelHint: t('farmer.marketing.objective.recipeChannel') ?? 'Social carousel, blog, packaging insert'
  }
];

const toDateFromFirestore = (value: unknown): Date | null => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.toDate === 'function') {
      return (record.toDate as () => Date)();
    }
    if (typeof record.seconds === 'number') {
      return new Date(record.seconds * 1000);
    }
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const parseStoredContent = (content?: string): ParsedMaterialContent | null => {
  if (!content) return null;
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned) as ParsedMaterialContent;
  } catch {
    return null;
  }
};

const joinAssetForCopy = (asset: MarketingAssetContent) => {
  const sections = [
    asset.title,
    asset.hook,
    asset.primaryMessage,
    asset.supportingPoints.map((point) => `- ${point}`).join('\n'),
    asset.callToAction,
    asset.hashtags.length ? `#${asset.hashtags.join(' #')}` : ''
  ];
  return sections.filter(Boolean).join('\n\n');
};

interface ImagePromptBuilderInput {
  summary: ProductMarketingSummary;
  asset: MarketingAssetContent;
  objective: MarketingObjective;
  tone: MarketingTone;
  audienceValue: string;
  audienceLabel: string;
  specialOffer?: string;
  preferredChannel?: string;
  additionalNotes?: string;
  allowPeople: boolean;
}

const buildMarketingImagePrompt = ({
  summary,
  asset,
  objective,
  tone,
  audienceValue,
  audienceLabel,
  specialOffer,
  preferredChannel,
  additionalNotes,
  allowPeople
}: ImagePromptBuilderInput) => {
  const uniquePoints = summary.uniqueSellingPoints?.filter(Boolean).slice(0, 4) ?? [];
  const audienceContext = AUDIENCE_VISUAL_CONTEXT[audienceValue] ?? '';

  const fragments = [
    `High-resolution marketing image for "${summary.name}"${summary.category ? `, a ${summary.category}` : ''}.`,
    OBJECTIVE_VISUAL_STYLES[objective],
    `Visual tone: ${TONE_VISUAL_DESCRIPTORS[tone]}.`,
    audienceContext ? `Target audience context: ${audienceContext}` : `Target audience: ${audienceLabel}.`,
    uniquePoints.length > 0 ? `Highlight selling points: ${uniquePoints.join(', ')}.` : null,
    summary.storyAngle ? `Farm story angle: ${summary.storyAngle}.` : null,
    asset.primaryMessage ? `Core message: ${asset.primaryMessage}` : null,
    specialOffer ? `Include gentle nod to promotion: ${specialOffer}.` : null,
    preferredChannel ? `Optimise composition for ${preferredChannel}.` : null,
    additionalNotes ? `Additional creative direction: ${additionalNotes}.` : null,
    allowPeople ? 'Including people is allowed if it strengthens the story.' : 'Keep the scene focused on the product without people.',
    'Use cinematic lighting, crisp focus and natural textures so the product feels premium and authentic.',
    'No text, lettering, watermarks, packaging labels, logos or typography in the frame.'
  ];

  return fragments.filter(Boolean).join(' ');
};

const MarketingTools: React.FC = () => {
  const { t, language } = useLanguage();
  const { user, userProducts, userMarketingMaterials, refreshUserData } = useAuth();
  const { toast } = useToast();

  const [selectedProductId, setSelectedProductId] = useState('');
  const [objective, setObjective] = useState<MarketingObjective>('social_post');
  const [audience, setAudience] = useState('local_restaurants');
  const [tone, setTone] = useState<MarketingTone>('friendly');
  const [specialOffer, setSpecialOffer] = useState('');
  const [preferredChannel, setPreferredChannel] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<ProductMarketingSummary | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<MarketingAssetContent | null>(null);
  const [campaignIdeas, setCampaignIdeas] = useState<MarketingCampaignIdea[] | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [allowPeople, setAllowPeople] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<NonNullable<MarketingImageRequest['aspectRatio']>>('1:1');
  const [imageCount, setImageCount] = useState<number>(2);
  const [generatedImages, setGeneratedImages] = useState<GeneratedMarketingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [copiedImageKey, setCopiedImageKey] = useState<string | null>(null);

  const objectiveOptions = useMemo(() => getObjectiveOptions(t), [t]);
  const selectedAudienceOption = useMemo(
    () => DEFAULT_AUDIENCES.find((item) => item.value === audience) ?? DEFAULT_AUDIENCES[0],
    [audience]
  );

  useEffect(() => {
    if (userProducts && userProducts.length > 0) {
      if (!selectedProductId || !userProducts.some((item) => item.id === selectedProductId)) {
        setSelectedProductId(userProducts[0].id);
      }
    }
  }, [userProducts, selectedProductId]);

  const selectedProduct = useMemo<Product | undefined>(
    () => userProducts?.find((item) => item.id === selectedProductId),
    [userProducts, selectedProductId]
  );

  const savedMaterials: StoredMaterial[] = useMemo(() => {
    if (!userMarketingMaterials) return [];

    return userMarketingMaterials
      .map((material) => {
        const parsed = parseStoredContent(material.content);
        const createdAt = toDateFromFirestore(material.createdAt);

        return {
          raw: material,
          parsed,
          createdAtLabel: createdAt ? createdAt.toLocaleString() : ''
        };
      })
      .sort((a, b) => {
        const aTime = toDateFromFirestore(a.raw.createdAt)?.getTime() ?? 0;
        const bTime = toDateFromFirestore(b.raw.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      });
  }, [userMarketingMaterials]);

  const handleCopy = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id ?? 'preview');
      toast({
        title: t('farmer.marketing.copied') ?? 'Copied',
        description: t('farmer.marketing.contentCopied') ?? 'Content copied to clipboard.'
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: t('farmer.marketing.generationFailed') ?? 'Copy failed',
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  };

  const handleDownloadImage = (image: GeneratedMarketingImage, index: number) => {
    const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `marketing-visual-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyImage = async (image: GeneratedMarketingImage, key: string) => {
    try {
      const response = await fetch(`data:${image.mimeType};base64,${image.base64}`);
      const blob = await response.blob();
      if (typeof window.ClipboardItem === 'undefined') {
        throw new Error('Clipboard image copy is not supported in this browser.');
      }
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
      setCopiedImageKey(key);
      toast({
        title: t('farmer.marketing.copied') ?? 'Copied',
        description: t('farmer.marketing.imageCopied') ?? 'Image copied to clipboard.'
      });
      setTimeout(() => setCopiedImageKey(null), 2000);
    } catch (error) {
      toast({
        title: t('farmer.marketing.generationFailed') ?? 'Copy failed',
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  };

  const generateContent = async () => {
    if (!user || !selectedProduct) {
      toast({
        title: 'Select a product',
        description: 'Add at least one product before generating marketing content.'
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedAsset(null);
    setCampaignIdeas(null);
    setGeneratedImages([]);
    setImageError(null);
    setCopiedImageKey(null);

    try {
      const summary = await geminiService.generateProductInfo({
        name: selectedProduct.name,
        category: selectedProduct.category,
        description: selectedProduct.description ?? '',
        unit: selectedProduct.unit ?? '',
        price: selectedProduct.price ?? '',
        locale: language
      });

      const asset = await geminiService.generateMarketingMaterial({
        product: summary,
        objective,
        audience,
        tone,
        locale: language,
        specialOffer: specialOffer.trim() || undefined,
        preferredChannel: preferredChannel.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined
      });

      setGeneratedSummary(summary);
      setGeneratedAsset(asset);

      let imageGenerationMessage: string | null = null;

      if (includeImages) {
        try {
          const prompt = buildMarketingImagePrompt({
            summary,
            asset,
            objective,
            tone,
            audienceValue: audience,
            audienceLabel: selectedAudienceOption?.label ?? audience,
            specialOffer: specialOffer.trim() || undefined,
            preferredChannel: preferredChannel.trim() || undefined,
            additionalNotes: additionalNotes.trim() || undefined,
            allowPeople
          });

          const visuals = await geminiImageService.generateMarketingImages({
            prompt,
            aspectRatio: imageAspectRatio,
            sampleCount: imageCount,
            personGeneration: allowPeople ? 'allow_adult' : 'dont_allow',
            negativePrompt: DEFAULT_NEGATIVE_PROMPT
          });

          setGeneratedImages(visuals);
          setImageError(null);
        } catch (imageError) {
          console.error('Imagen generation failed:', imageError);
          const message = (imageError as Error).message;
          setGeneratedImages([]);
          setImageError(message);
          imageGenerationMessage = message;
        }
      } else {
        setGeneratedImages([]);
        setImageError(null);
      }

      if (imageGenerationMessage) {
        toast({
          title:
            t('farmer.marketing.imageGenerationPartial') ?? 'Copy ready, but images could not be created',
          description: imageGenerationMessage,
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('farmer.marketing.contentGenerated') ?? 'Content generated',
          description: includeImages
            ? t('farmer.marketing.reviewAndEditVisuals') ??
              'Review the copy and visuals before sharing or saving.'
            : t('farmer.marketing.reviewAndEdit') ?? 'Review the copy before sharing or saving.'
        });
      }
    } catch (error) {
      console.error('Gemini generation failed:', error);
      setGeneratedImages([]);
      setImageError((error as Error).message);
      toast({
        title: t('farmer.marketing.generationFailed') ?? 'Generation failed',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveGeneratedContent = async () => {
    if (!user || !selectedProduct || !generatedAsset) {
      toast({
        title: 'Nothing to save',
        description: 'Generate marketing content before saving.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const payload = {
        version: 'v1',
        generatedAt: new Date().toISOString(),
        locale: language,
        objective,
        tone,
        audience,
        product: generatedSummary,
        asset: generatedAsset,
        images: generatedImages.length
          ? generatedImages.map((image) => ({
              mimeType: image.mimeType,
              base64: image.base64,
              prompt: image.prompt,
              aspectRatio: image.aspectRatio
            }))
          : undefined
      };

      const primaryImage = generatedImages[0]
        ? `data:${generatedImages[0].mimeType};base64,${generatedImages[0].base64}`
        : undefined;

      await DatabaseService.createMarketingMaterial(user.id, {
        productId: selectedProductId,
        type: OBJECTIVE_TO_TYPE[objective],
        title: generatedAsset.title,
        content: JSON.stringify(payload, null, 2),
        generatedBy: 'gemini',
        imageUrl: primaryImage
      });

      toast({
        title: t('farmer.marketing.generationComplete') ?? 'Saved to library',
        description: t('farmer.marketing.contentReady') ?? 'You can reuse this material from the history below.'
      });

      await refreshUserData();
    } catch (error) {
      console.error('Saving marketing material failed:', error);
      toast({
        title: t('farmer.marketing.generationFailed') ?? 'Save failed',
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  };

  const fetchCampaignIdeas = async () => {
    if (!selectedProduct) {
      toast({
        title: 'Select a product',
        description: 'Choose a product before generating campaign ideas.'
      });
      return;
    }

    try {
      setIdeasLoading(true);

      const summary =
        generatedSummary ||
        (await geminiService.generateProductInfo({
          name: selectedProduct.name,
          category: selectedProduct.category,
          description: selectedProduct.description ?? '',
          unit: selectedProduct.unit ?? '',
          price: selectedProduct.price ?? '',
          locale: language
        }));

      setGeneratedSummary(summary);

      const seasonLabel = new Intl.DateTimeFormat(language === 'zh-TW' ? 'zh-TW' : 'en', { month: 'long' }).format(
        new Date()
      );

      const ideas = await geminiService.generateCampaignIdeas({
        product: summary,
        locale: language,
        season: seasonLabel,
        objective
      });

      setCampaignIdeas(ideas);
    } catch (error) {
      console.error('Campaign idea generation failed:', error);
      toast({
        title: 'Unable to fetch ideas',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIdeasLoading(false);
    }
  };

  const renderCampaignIdeas = () => (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            {t('farmer.marketing.aiInsights') ?? 'AI campaign ideas'}
          </CardTitle>
          <CardDescription>
            {t('farmer.marketing.personalizedRecommendations') ?? 'Ask Gemini for channel-specific campaign ideas.'}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          onClick={fetchCampaignIdeas}
          disabled={ideasLoading || !selectedProductId}
          className="flex items-center gap-2"
        >
          {ideasLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {t('farmer.marketing.generateInsights') ?? 'Generate ideas'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {ideasLoading && (
          <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('farmer.marketing.generatingInsights') ?? 'Gathering campaign suggestions...'}
          </div>
        )}
        {!ideasLoading && campaignIdeas && campaignIdeas.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {campaignIdeas.map((idea, index) => (
              <div key={index} className="rounded-xl border bg-muted/30 p-4">
                <h4 className="mb-2 text-base font-semibold">{idea.title}</h4>
                <p className="mb-3 text-sm text-muted-foreground">{idea.summary}</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">
                      {t('farmer.marketing.keyMessage') ?? 'Key message'}:
                    </span>{' '}
                    {idea.keyMessage}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">
                      {t('farmer.marketing.channels') ?? 'Channels'}:
                    </span>{' '}
                    {idea.recommendedChannels.join(', ')}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">
                      {t('farmer.marketing.timing') ?? 'Timing'}:
                    </span>{' '}
                    {idea.timing}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">
                      {t('farmer.marketing.successMetric') ?? 'Measure success'}:
                    </span>{' '}
                    {idea.successMetric}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!ideasLoading && (!campaignIdeas || campaignIdeas.length === 0) && (
          <p className="text-sm text-muted-foreground">
            {t('farmer.marketing.generateInsightHint') ??
              'Generate marketing copy first, then ask for tailored campaign suggestions.'}
          </p>
        )}
      </CardContent>
    </Card>
  );

  const renderGeneratedAsset = () => {
    if (!generatedAsset) return null;

    const contentForCopy = joinAssetForCopy(generatedAsset);

    return (
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-orange-500" />
              {t('farmer.marketing.generatedContent') ?? 'Generated content'}
            </CardTitle>
            <CardDescription>
              {t('farmer.marketing.reviewAndEdit') ?? 'Review, edit and save the generated copy.'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(contentForCopy)}
              className="flex items-center gap-2"
            >
              <Clipboard className="h-4 w-4" />
              {copiedId === 'preview'
                ? t('farmer.marketing.copied') ?? 'Copied'
                : t('farmer.marketing.copy') ?? 'Copy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateContent}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t('farmer.marketing.regenerate') ?? 'Regenerate'}
            </Button>
            <Button size="sm" onClick={saveGeneratedContent} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {t('farmer.marketing.saveToLibrary') ?? 'Save to library'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 text-xl font-semibold">{generatedAsset.title}</h3>
            <p className="mb-4 text-lg text-muted-foreground">{generatedAsset.hook}</p>
            <p className="whitespace-pre-line text-base leading-relaxed">{generatedAsset.primaryMessage}</p>
          </div>

          {generatedAsset.supportingPoints.length > 0 && (
            <div>
              <h4 className="mb-2 font-semibold">
                {t('farmer.marketing.supportingPoints') ?? 'Supporting points'}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {generatedAsset.supportingPoints.map((point, index) => (
                  <li key={index} className="flex gap-2">
                    <span>-</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-4">
            <h4 className="mb-2 flex items-center gap-2 font-semibold">
              <Megaphone className="h-4 w-4 text-green-600" />
              {t('farmer.marketing.callToAction') ?? 'Call to action'}
            </h4>
            <p>{generatedAsset.callToAction}</p>
          </div>

          {generatedAsset.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {generatedAsset.hashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </Badge>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-semibold">
                <Megaphone className="h-4 w-4 text-blue-600" />
                {t('farmer.marketing.channelRecommendations') ?? 'Channel recommendations'}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {generatedAsset.channelRecommendations.map((item, index) => (
                  <li key={index}>
                    <span className="font-semibold text-foreground">{item.channel}:</span> {item.idea}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-semibold">
                <Calendar className="h-4 w-4 text-purple-600" />
                {t('farmer.marketing.scheduleIdeas') ?? 'Schedule ideas'}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {generatedAsset.scheduleIdeas.map((idea, index) => (
                  <li key={index}>{idea}</li>
                ))}
              </ul>
            </div>
          </div>

          {generatedAsset.designNotes.length > 0 && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-semibold">
                <FileText className="h-4 w-4 text-orange-500" />
                {t('farmer.marketing.designNotes') ?? 'Design notes'}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {generatedAsset.designNotes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
      </CardContent>
    </Card>
  );
};

  const renderGeneratedVisuals = () => {
    if (!includeImages && generatedImages.length === 0 && !imageError) {
      return null;
    }

    const showPlaceholder = includeImages && generatedImages.length === 0 && !imageError;

    return (
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ImageIcon className="h-5 w-5 text-primary" />
              {t('farmer.marketing.generatedVisuals') ?? 'Generated visuals'}
            </CardTitle>
            <CardDescription>
              {t('farmer.marketing.visualsDescription') ??
                'Download or copy the AI-generated visuals for your marketing materials.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatedImages.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {generatedImages.map((image, index) => {
                const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
                return (
                  <div key={index} className="overflow-hidden rounded-xl border bg-muted/30 p-4">
                    <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-background">
                      <img
                        src={dataUrl}
                        alt={image.prompt}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {t('farmer.marketing.aspectRatio') ?? 'Aspect'}: {image.aspectRatio}
                      </span>
                      <span>
                        {t('farmer.marketing.model') ?? 'Model'}: Gemini 2.5 Flash Image (preview)
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyImage(image, `generated-${index}`)}
                        className="flex items-center gap-2"
                      >
                        <Clipboard className="h-4 w-4" />
                        {copiedImageKey === `generated-${index}`
                          ? t('farmer.marketing.copied') ?? 'Copied'
                          : t('farmer.marketing.copy') ?? 'Copy'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadImage(image, index)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        {t('farmer.marketing.download') ?? 'Download'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showPlaceholder && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
              {t('farmer.marketing.visualsPending') ??
                'Visuals will appear here after generation completes.'}
            </div>
          )}

          {imageError && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium">
                  {t('farmer.marketing.imageGenerationFailed') ?? 'Image generation failed'}
                </p>
                <p>{imageError}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSavedMaterials = () => (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            {t('farmer.marketing.marketingMaterials') ?? 'Saved marketing materials'}
          </CardTitle>
          <CardDescription>
            {t('farmer.marketing.useAiDescription') ?? 'Copy or reuse marketing assets you generated earlier.'}
          </CardDescription>
        </div>
        <Badge variant="outline">
          {savedMaterials.length} {t('farmer.marketing.materials') ?? 'materials'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {savedMaterials.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">
              {t('farmer.marketing.noMaterialsYet') ?? 'No saved materials yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('farmer.marketing.useAiToGenerate') ?? 'Generate content to build your marketing library.'}
            </p>
          </div>
        ) : (
          savedMaterials.map(({ raw, parsed, createdAtLabel }) => {
            const asset = parsed?.asset;
            const visuals = parsed?.images ?? [];
            const objectiveLabel = parsed?.objective
              ? objectiveOptions.find((item) => item.value === parsed.objective)?.label ?? parsed.objective
              : raw.type;
            const body =
              (asset && joinAssetForCopy(asset)) ||
              (typeof raw.content === 'string' ? raw.content : '');

            return (
              <Card key={raw.id} className="border bg-muted/30">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{asset?.title ?? raw.title}</h3>
                        <Badge variant="secondary">{objectiveLabel}</Badge>
                        {parsed?.tone && <Badge variant="outline">{parsed.tone}</Badge>}
                      </div>
                      {asset?.hook && <p className="mt-1 text-sm text-muted-foreground">{asset.hook}</p>}
                    </div>
                    <div className="text-right">
                      {createdAtLabel && <p className="text-xs text-muted-foreground">{createdAtLabel}</p>}
                      {parsed?.product?.name && (
                        <p className="text-xs text-muted-foreground">
                          {t('farmer.marketing.productLabel') ?? 'Product'}: {parsed.product.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background p-4 text-sm leading-relaxed whitespace-pre-line">
                    {body}
                  </div>

                  {visuals.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {visuals.map((visual, index) => {
                        const normalized: GeneratedMarketingImage = {
                          base64: visual.base64,
                          mimeType: visual.mimeType ?? 'image/png',
                          prompt: visual.prompt ?? asset?.title ?? raw.title,
                          aspectRatio: visual.aspectRatio ?? '1:1',
                          safetyAttributes: []
                        };
                        const savedKey = `saved-${raw.id}-${index}`;
                        const dataUrl = `data:${normalized.mimeType};base64,${normalized.base64}`;
                        return (
                          <div key={savedKey} className="overflow-hidden rounded-xl border bg-muted/30 p-3">
                            <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-background">
                              <img src={dataUrl} alt={normalized.prompt} className="h-full w-full object-cover" />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>
                                {t('farmer.marketing.aspectRatio') ?? 'Aspect'}: {normalized.aspectRatio}
                              </span>
                              <span>{t('farmer.marketing.generatedOn') ?? 'Saved visual'}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyImage(normalized, savedKey)}
                                className="flex items-center gap-2"
                              >
                                <Clipboard className="h-4 w-4" />
                                {copiedImageKey === savedKey
                                  ? t('farmer.marketing.copied') ?? 'Copied'
                                  : t('farmer.marketing.copy') ?? 'Copy'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadImage(normalized, index)}
                                className="flex items-center gap-2"
                              >
                                <Download className="h-4 w-4" />
                                {t('farmer.marketing.download') ?? 'Download'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(body, raw.id)}
                      className="flex items-center gap-2"
                    >
                      <Clipboard className="h-4 w-4" />
                      {copiedId === raw.id
                        ? t('farmer.marketing.copied') ?? 'Copied'
                        : t('farmer.marketing.copy') ?? 'Copy'}
                    </Button>
                    {asset?.hashtags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {asset.hashtags.map((tag) => (
                          <Badge key={tag} variant="outline" className="bg-background">
                            #{tag.replace(/^#/, '')}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="flex items-center gap-3 text-3xl font-semibold">
          <Sparkles className="h-7 w-7 text-primary" />
          {t('farmer.marketing.title') ?? 'AI Marketing Tools'}
        </h1>
        <p className="text-muted-foreground">
          {t('farmer.marketing.subtitle') ??
            'Create social posts, newsletters and printable materials with Gemini-powered suggestions.'}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {t('farmer.marketing.generateMaterial') ?? 'Generate marketing material'}
          </CardTitle>
          <CardDescription>
            {t('farmer.marketing.aiGenerator') ??
              'Pick a product, audience and tone. Gemini will craft channel-ready copy in your selected language.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(!userProducts || userProducts.length === 0) ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              {t('farmer.marketing.noProductsWarning') ??
                'Add at least one product to your catalogue to start generating marketing materials.'}
            </div>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t('farmer.marketing.selectProduct') ?? 'Product'}
                    </label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('farmer.marketing.selectProductPlaceholder') ?? 'Choose a product'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {userProducts?.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t('farmer.marketing.objective') ?? 'Objective'}
                    </label>
                    <Select value={objective} onValueChange={(value) => setObjective(value as MarketingObjective)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('farmer.marketing.selectObjective') ?? 'Select an objective'} />
                      </SelectTrigger>
                      <SelectContent>
                        {objectiveOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{objectiveOptions.find((opt) => opt.value === objective)?.description}</p>
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t('farmer.marketing.audience') ?? 'Audience'}
                    </label>
                    <Select value={audience} onValueChange={setAudience}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('farmer.marketing.selectAudience') ?? 'Select audience'} />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_AUDIENCES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{selectedAudienceOption?.description}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t('farmer.marketing.tone') ?? 'Tone'}
                    </label>
                    <Select value={tone} onValueChange={(value) => setTone(value as MarketingTone)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('farmer.marketing.selectTone') ?? 'Select tone'} />
                      </SelectTrigger>
                      <SelectContent>
                        {TONE_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {TONE_OPTIONS.find((item) => item.value === tone)?.description}
                    </p>
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t('farmer.marketing.specialOffer') ?? 'Special offer (optional)'}
                    </label>
                    <Input
                      value={specialOffer}
                      onChange={(event) => setSpecialOffer(event.target.value)}
                      placeholder={t('farmer.marketing.specialOfferPlaceholder') ?? 'e.g. Limited-time farm box discount'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t('farmer.marketing.preferredChannel') ?? 'Preferred channel (optional)'}
                    </label>
                    <Input
                      value={preferredChannel}
                      onChange={(event) => setPreferredChannel(event.target.value)}
                      placeholder={t('farmer.marketing.channelPlaceholder') ?? 'e.g. Instagram carousel, LINE broadcast'}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t('farmer.marketing.additionalNotes') ?? 'Additional creative notes'}
                    </label>
                    <Textarea
                      value={additionalNotes}
                      onChange={(event) => setAdditionalNotes(event.target.value)}
                      placeholder={t('farmer.marketing.additionalNotesPlaceholder') ?? 'Tell Gemini about farm story angle, seasonal mentions or visual cues you want to highlight.'}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {t('farmer.marketing.generateVisuals') ?? 'Generate visuals'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('farmer.marketing.generateVisualsDescription') ??
                            'Add image concepts tailored to your product and audience.'}
                        </p>
                      </div>
                      <Switch checked={includeImages} onCheckedChange={(checked) => setIncludeImages(checked)} />
                    </div>
                    {includeImages && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">
                            {t('farmer.marketing.aspectRatio') ?? 'Aspect ratio'}
                          </label>
                          <Select
                            value={imageAspectRatio}
                            onValueChange={(value) =>
                              setImageAspectRatio(value as NonNullable<MarketingImageRequest['aspectRatio']>)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASPECT_RATIO_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">
                            {t('farmer.marketing.imageCount') ?? 'Images to generate'}
                          </label>
                          <Select
                            value={String(imageCount)}
                            onValueChange={(value) => setImageCount(Number(value))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {IMAGE_COUNT_OPTIONS.map((option) => (
                                <SelectItem key={option} value={String(option)}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          <div className="flex items-center justify-between gap-4 rounded-md border bg-background/80 px-3 py-2">
                            <div>
                              <p className="text-xs font-medium text-foreground">
                                {t('farmer.marketing.allowPeople') ?? 'Allow people in visuals'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t('farmer.marketing.allowPeopleDescription') ??
                                  'Enable if you want the scene to include farmers or customers.'}
                              </p>
                            </div>
                            <Switch checked={allowPeople} onCheckedChange={(checked) => setAllowPeople(checked)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  {selectedProduct ? (
                    <>
                      <div>
                        <p className="text-base font-semibold text-foreground">{selectedProduct.name}</p>
                        {selectedProduct.description && <p className="mt-1">{selectedProduct.description}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-foreground">
                        {selectedProduct.category && <Badge variant="outline">{selectedProduct.category}</Badge>}
                        {selectedProduct.unit && <Badge variant="secondary">{selectedProduct.unit}</Badge>}
                        {selectedProduct.price ? (
                          <Badge variant="outline">{`${selectedProduct.price} ${selectedProduct.unit ?? ''}`.trim()}</Badge>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  <div className="rounded-md bg-background/80 p-3 text-xs">
                    <p className="font-medium text-foreground">
                      {t('farmer.marketing.language') ?? 'Language'}: {languageLabel(language)}
                    </p>
                    <p>
                      {t('farmer.marketing.localeHint') ??
                        'Text copy follows your preferred dashboard language. Imagen currently responds best to English prompts, so we generate visual directions automatically.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('farmer.marketing.generatorHint') ??
                    'Gemini will summarise your product, craft channel-ready copy, and optionally create visuals in one request.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={generateContent} disabled={isGenerating || !selectedProductId} className="flex items-center gap-2">
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isGenerating
                      ? t('farmer.marketing.generating') ?? 'Generating...'
                      : t('farmer.marketing.generateMaterial') ?? 'Generate marketing material'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {renderGeneratedAsset()}
      {renderGeneratedVisuals()}
      {renderCampaignIdeas()}
      {renderSavedMaterials()}
    </div>
  );
};

export default MarketingTools;
