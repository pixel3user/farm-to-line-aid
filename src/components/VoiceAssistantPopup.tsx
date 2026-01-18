import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mic,
  X,
  Loader2,
  Square,
  PlayCircle,
  Package,
  ListChecks,
  PlusCircle,
  TrendingUp,
  Search,
  Image,
  MapPin,
  FileText,
  Sparkles,
  BarChart3,
  Store,
  LayoutDashboard,
  UserCheck,
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import resolveApiBaseUrl from '@/lib/api';
import { DIALOG_TOGGLE_EVENT } from '@/lib/dialogEvents';

type TextEntry = {
  id: number;
  role: 'user' | 'assistant' | 'system';
  text: string;
  ts: number;
  kind: 'text';
};

type ToolUiIcon = 'list' | 'add' | 'edit' | 'stock' | 'search' | 'spark' | 'stats';

type ToolUiItem = {
  title: string;
  description: string;
  prompt: string;
  icon: ToolUiIcon;
};

type ToolUiAction = {
  label: string;
  prompt?: string;
  href?: string;
};

type ToolUiProduct = {
  id?: string;
  name: string;
  price?: number;
  unit?: string;
  stock?: number;
  category?: string;
  imageUrl?: string;
  imageCount?: number;
  description?: string;
  pickup?: {
    address?: string;
    contactName?: string;
    contactTel?: string;
    contactMobile?: string;
    postNumber?: string;
    yamatoZipCode?: string;
  };
  href?: string;
};

type ToolUiStore = {
  id?: string;
  name: string;
  type?: string;
  location?: string;
  status?: string;
  href?: string;
};

type ToolUiMarketingItem = {
  id?: string;
  title: string;
  type?: string;
  imageUrl?: string;
  href?: string;
  date?: string;
};

type ToolUiStat = {
  label: string;
  value: string | number;
  hint?: string;
};

type ToolUiEmptyState = {
  title: string;
  description: string;
  actions?: ToolUiAction[];
};

type ToolUiToolkit = {
  kind: 'product_tools' | 'store_tools' | 'marketing_tools' | 'analytics_tools' | 'help_options';
  title: string;
  description: string;
  items: ToolUiItem[];
  actions: ToolUiAction[];
};

type ToolUiProductList = {
  kind: 'product_list';
  title: string;
  description?: string;
  context: 'mine' | 'market';
  items: ToolUiProduct[];
  actions?: ToolUiAction[];
  emptyState?: ToolUiEmptyState;
};

type ToolUiProductCreated = {
  kind: 'product_created';
  title: string;
  description?: string;
  product: ToolUiProduct;
  actions?: ToolUiAction[];
};

type ToolUiProductUpdated = {
  kind: 'product_updated';
  title: string;
  description?: string;
  product: ToolUiProduct;
  actions?: ToolUiAction[];
};

type ToolUiStoreList = {
  kind: 'store_list';
  title: string;
  description?: string;
  context: 'mine' | 'market';
  items: ToolUiStore[];
  actions?: ToolUiAction[];
  emptyState?: ToolUiEmptyState;
};

type ToolUiStoreCreated = {
  kind: 'store_created';
  title: string;
  description?: string;
  store: ToolUiStore;
  actions?: ToolUiAction[];
};

type ToolUiMarketingList = {
  kind: 'marketing_list';
  title: string;
  description?: string;
  items: ToolUiMarketingItem[];
  actions?: ToolUiAction[];
  emptyState?: ToolUiEmptyState;
};

type ToolUiStats = {
  kind: 'stats';
  title: string;
  description?: string;
  items: ToolUiStat[];
  actions?: ToolUiAction[];
};

type ToolUiMarketplaceStats = {
  kind: 'marketplace_stats';
  title: string;
  description?: string;
  items: ToolUiStat[];
  actions?: ToolUiAction[];
};

type ToolUiDashboard = {
  kind: 'dashboard_link';
  title: string;
  description?: string;
  url: string;
  actionLabel: string;
};

type ToolUiRole = {
  kind: 'role_set';
  title: string;
  description?: string;
  role: 'farmer' | 'market';
  actions?: ToolUiAction[];
};

type ToolUi =
  | ToolUiToolkit
  | ToolUiProductList
  | ToolUiProductCreated
  | ToolUiProductUpdated
  | ToolUiStoreList
  | ToolUiStoreCreated
  | ToolUiMarketingList
  | ToolUiStats
  | ToolUiMarketplaceStats
  | ToolUiDashboard
  | ToolUiRole;

type ToolCardEntry = {
  id: number;
  ts: number;
  kind: 'tool-card';
  card: ToolUi;
};

type ChatEntry = TextEntry | ToolCardEntry;

type Status = 'idle' | 'connecting' | 'ready' | 'listening' | 'processing' | 'error';

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type VoiceAssistantResponse = {
  messages?: Array<{ role: 'assistant' | 'system'; text: string }>;
  ui?: ToolUi;
  error?: string;
};

type VoiceTranscriptionResponse = {
  transcript?: string;
  error?: string;
};

type LiveEventPayload = {
  type: 'text' | 'tool' | 'status' | 'audio' | 'turnComplete';
  text?: string;
  name?: string;
  toolCallId?: string;
  messages?: Array<{ role: 'assistant' | 'system'; text: string }>;
  phase?: 'start' | 'done' | 'error';
  ui?: ToolUi;
  status?: string;
  reason?: string;
  message?: string;
  data?: string;
  mimeType?: string;
};

const TARGET_SAMPLE_RATE = 16000;
const MIC_LEVEL_GAIN = 6;
const MIC_LEVEL_SMOOTHING = 0.7;
const LIVE_CHUNK_INTERVAL_MS = 200;
const LAUNCHER_HIDE_THRESHOLD_PX = 24;

const STATUS_LABELS = {
  'zh-TW': {
    idle: '待命',
    connecting: '連線中',
    ready: '已就緒',
    listening: '聆聽中',
    processing: '處理中',
    error: '需要重試',
  },
  en: {
    idle: 'Idle',
    connecting: 'Connecting',
    ready: 'Ready',
    listening: 'Listening',
    processing: 'Processing',
    error: 'Retry needed',
  },
} as const;

const COPY = {
  'zh-TW': {
    popupTitle: '語音助理',
    waitingReply: '等待語音回覆…',
    assistantLabel: '助理',
    userLabel: '你',
    systemLabel: '系統',
    micStart: '開始說話',
    micStop: '停止',
    micUnsupportedTitle: '瀏覽器不支援語音辨識',
    micUnsupportedDesc: '請使用支援語音辨識的瀏覽器或更新版本。',
    micPermissionDeniedTitle: '麥克風權限已拒絕',
    micPermissionDeniedDesc: '請在瀏覽器設定中允許麥克風權限後再試。',
    insecureContextTitle: '需要 HTTPS',
    insecureContextDesc: '請使用 HTTPS 或 localhost 才能存取麥克風。',
    micUnavailableTitle: '麥克風無法使用',
    micUnavailableDesc: '請檢查瀏覽器麥克風權限。',
    connectErrorTitle: '語音請求失敗',
    connectErrorDesc: '請稍後再試。',
    listeningTitle: '聆聽中',
    listeningDesc: '正在接收你的語音…',
    thinkingTitle: '思考中',
    thinkingDesc: '正在整理回覆…',
    listeningBadge: '聆聽中',
    thinkingBadge: '思考中',
    authRequiredTitle: '需要登入',
    authRequiredDesc: '請先登入後使用語音助理。',
    readyMessage: '已就緒，請開始說話。',
    reconnect: '重新啟動',
    connecting: '連線中',
    launcherCaption: 'AI 語音助理',
    startTutorial: '開始導覽',
  },
  en: {
    popupTitle: 'Voice Assistant',
    waitingReply: 'Waiting for voice…',
    assistantLabel: 'Assistant',
    userLabel: 'You',
    systemLabel: 'System',
    micStart: 'Start speaking',
    micStop: 'Stop',
    micUnsupportedTitle: 'Voice recognition not supported',
    micUnsupportedDesc: 'Use a browser that supports speech recognition or update it.',
    micPermissionDeniedTitle: 'Microphone permission denied',
    micPermissionDeniedDesc: 'Allow microphone access in your browser settings and try again.',
    insecureContextTitle: 'HTTPS required',
    insecureContextDesc: 'Use HTTPS or localhost to access the microphone.',
    micUnavailableTitle: 'Microphone unavailable',
    micUnavailableDesc: 'Check your browser microphone permissions.',
    connectErrorTitle: 'Voice request failed',
    connectErrorDesc: 'Please try again.',
    listeningTitle: 'Listening',
    listeningDesc: 'Capturing your voice…',
    thinkingTitle: 'Thinking',
    thinkingDesc: 'Crafting a response…',
    listeningBadge: 'Listening',
    thinkingBadge: 'Thinking',
    authRequiredTitle: 'Sign in required',
    authRequiredDesc: 'Sign in before using the voice assistant.',
    readyMessage: 'Ready. Start speaking.',
    reconnect: 'Restart',
    connecting: 'Connecting',
    launcherCaption: 'AI Voice Assistant',
    startTutorial: 'Start tutorial',
  },
} as const;

const TOOL_ICON_MAP = {
  list: ListChecks,
  add: PlusCircle,
  edit: Edit,
  stock: TrendingUp,
  search: Search,
  spark: Sparkles,
  stats: BarChart3,
} as const;

const TOOL_ACCENTS = {
  list: {
    border: 'border-sky-200/70',
    bg: 'bg-sky-100/80',
    text: 'text-sky-700',
  },
  add: {
    border: 'border-emerald-200/70',
    bg: 'bg-emerald-100/80',
    text: 'text-emerald-700',
  },
  edit: {
    border: 'border-teal-200/70',
    bg: 'bg-teal-100/80',
    text: 'text-teal-700',
  },
  stock: {
    border: 'border-amber-200/70',
    bg: 'bg-amber-100/80',
    text: 'text-amber-700',
  },
  search: {
    border: 'border-indigo-200/70',
    bg: 'bg-indigo-100/80',
    text: 'text-indigo-700',
  },
  spark: {
    border: 'border-fuchsia-200/70',
    bg: 'bg-fuchsia-100/80',
    text: 'text-fuchsia-700',
  },
  stats: {
    border: 'border-orange-200/70',
    bg: 'bg-orange-100/80',
    text: 'text-orange-700',
  },
} as const;

const CARD_STYLES = {
  product: {
    border: 'border-emerald-100/80',
    header: 'from-emerald-600 via-emerald-500 to-emerald-600',
    action: 'border-emerald-200 text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-700',
    muted: 'text-emerald-700/80',
  },
  store: {
    border: 'border-orange-100/80',
    header: 'from-orange-500 via-amber-500 to-orange-500',
    action: 'border-orange-200 text-orange-900',
    badge: 'bg-orange-100 text-orange-700',
    muted: 'text-orange-700/80',
  },
  marketing: {
    border: 'border-fuchsia-100/80',
    header: 'from-fuchsia-600 via-pink-500 to-fuchsia-500',
    action: 'border-fuchsia-200 text-fuchsia-900',
    badge: 'bg-fuchsia-100 text-fuchsia-700',
    muted: 'text-fuchsia-700/80',
  },
  stats: {
    border: 'border-slate-200/80',
    header: 'from-slate-800 via-slate-700 to-slate-600',
    action: 'border-slate-300 text-slate-900',
    badge: 'bg-slate-100 text-slate-700',
    muted: 'text-slate-600',
  },
  marketplace: {
    border: 'border-sky-200/80',
    header: 'from-sky-600 via-indigo-500 to-sky-500',
    action: 'border-sky-200 text-sky-900',
    badge: 'bg-sky-100 text-sky-700',
    muted: 'text-sky-700/80',
  },
  neutral: {
    border: 'border-emerald-100/80',
    header: 'from-emerald-600 via-emerald-500 to-emerald-600',
    action: 'border-emerald-200 text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-700',
    muted: 'text-emerald-700/80',
  },
} as const;

type VoicePageContext = {
  routeKey: string;
  prompt: string;
  context: string;
};

type OpenAssistantOptions = {
  autoPrompt?: string;
  startListening?: boolean;
};

type PageContextParts = {
  title?: string;
  overview?: string;
  navigation?: string;
  actions?: string[];
  tips?: string[];
};

const buildContextText = ({ title, overview, navigation, actions, tips }: PageContextParts) => {
  const lines: string[] = [];
  if (title) lines.push(`Page: ${title}`);
  if (overview) lines.push(`Overview: ${overview}`);
  if (navigation) lines.push(`Navigation: ${navigation}`);
  if (actions?.length) lines.push(`Key actions: ${actions.filter(Boolean).join('; ')}`);
  if (tips?.length) lines.push(`Tips: ${tips.filter(Boolean).join(' ')}`);
  return lines.join('\n');
};

const buildPromptText = (title?: string, desc?: string, cta?: string) => {
  const parts = [title, desc, cta ? `${cta}?` : undefined].filter(Boolean);
  return parts.join(' ');
};

const normalizePath = (pathname: string) => {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

const getVoicePageContext = (pathname: string, t: (key: string) => string): VoicePageContext | null => {
  const path = normalizePath(pathname);
  const farmerPrompt = buildPromptText(
    t('tutorial.farmer.prompt.title'),
    t('tutorial.farmer.prompt.desc'),
    t('tutorial.farmer.prompt.start')
  );
  const marketPrompt = buildPromptText(
    t('tutorial.market.prompt.title'),
    t('tutorial.market.prompt.desc'),
    t('tutorial.market.prompt.start')
  );

  if (path === '/') {
    const prompt = buildPromptText(t('home.role.heading'), t('home.description'));
    return {
      routeKey: 'home',
      prompt,
      context: buildContextText({
        title: t('home.title'),
        overview: t('home.description'),
        navigation: t('home.role.heading'),
        actions: [t('home.farmers.cta'), t('home.markets.cta'), t('home.cta.line')],
      }),
    };
  }

  if (path === '/farmer') {
    return {
      routeKey: 'farmer-dashboard',
      prompt: farmerPrompt,
      context: buildContextText({
        title: t('tutorial.farmer.steps.dashboard.title'),
        overview: t('tutorial.farmer.steps.dashboard.desc'),
        navigation: t('tutorial.farmer.steps.dashboard.nav'),
        actions: [t('tutorial.farmer.steps.dashboard.cta')],
        tips: [t('tutorial.farmer.steps.dashboard.demo1'), t('tutorial.farmer.steps.dashboard.demo2')],
      }),
    };
  }

  if (path.startsWith('/farmer/products')) {
    return {
      routeKey: 'farmer-products',
      prompt: farmerPrompt,
      context: buildContextText({
        title: t('tutorial.farmer.steps.product.title'),
        overview: t('tutorial.farmer.steps.product.desc'),
        navigation: t('tutorial.farmer.steps.product.nav'),
        actions: [t('tutorial.farmer.steps.product.cta')],
        tips: [t('tutorial.farmer.steps.product.demo1'), t('tutorial.farmer.steps.product.demo2')],
      }),
    };
  }

  if (path.startsWith('/farmer/stores')) {
    return {
      routeKey: 'farmer-stores',
      prompt: farmerPrompt,
      context: buildContextText({
        title: t('tutorial.farmer.steps.store.title'),
        overview: t('tutorial.farmer.steps.store.desc'),
        navigation: t('tutorial.farmer.steps.store.nav'),
        actions: [t('tutorial.farmer.steps.store.cta')],
        tips: [t('tutorial.farmer.steps.store.demo1'), t('tutorial.farmer.steps.store.demo2')],
      }),
    };
  }

  if (path.startsWith('/farmer/marketing')) {
    return {
      routeKey: 'farmer-marketing',
      prompt: farmerPrompt,
      context: buildContextText({
        title: t('tutorial.farmer.steps.marketing.title'),
        overview: t('tutorial.farmer.steps.marketing.desc'),
        navigation: t('tutorial.farmer.steps.marketing.nav'),
        actions: [t('tutorial.farmer.steps.marketing.cta')],
        tips: [t('tutorial.farmer.steps.marketing.demo1'), t('tutorial.farmer.steps.marketing.demo2')],
      }),
    };
  }

  if (path.startsWith('/farmer/analytics')) {
    return {
      routeKey: 'farmer-analytics',
      prompt: farmerPrompt,
      context: buildContextText({
        title: t('tutorial.farmer.steps.analytics.title'),
        overview: t('tutorial.farmer.steps.analytics.desc'),
        navigation: t('tutorial.farmer.steps.analytics.nav'),
        actions: [t('tutorial.farmer.steps.analytics.cta')],
        tips: [t('tutorial.farmer.steps.analytics.demo1'), t('tutorial.farmer.steps.analytics.demo2')],
      }),
    };
  }

  if (path === '/market') {
    return {
      routeKey: 'market-dashboard',
      prompt: marketPrompt,
      context: buildContextText({
        title: t('tutorial.market.steps.dashboard.title'),
        overview: t('tutorial.market.steps.dashboard.desc'),
        navigation: t('tutorial.market.steps.dashboard.nav'),
        actions: [t('tutorial.market.steps.dashboard.cta')],
        tips: [t('tutorial.market.spot.welcome.body'), t('tutorial.market.spot.products.body')],
      }),
    };
  }

  if (path.startsWith('/market/products')) {
    return {
      routeKey: 'market-products',
      prompt: marketPrompt,
      context: buildContextText({
        title: t('tutorial.market.steps.products.title'),
        overview: t('tutorial.market.steps.products.desc'),
        navigation: t('tutorial.market.steps.products.nav'),
        actions: [t('tutorial.market.steps.products.cta')],
        tips: [t('tutorial.market.spot.search.body'), t('tutorial.market.spot.list.body')],
      }),
    };
  }

  if (path.startsWith('/market/farms')) {
    return {
      routeKey: 'market-farms',
      prompt: marketPrompt,
      context: buildContextText({
        title: t('tutorial.market.steps.farms.title'),
        overview: t('tutorial.market.steps.farms.desc'),
        navigation: t('tutorial.market.steps.farms.nav'),
        actions: [t('tutorial.market.steps.farms.cta')],
        tips: [t('tutorial.market.spot.farmList.body'), t('tutorial.market.spot.map.body')],
      }),
    };
  }

  return null;
};

const isSamePageContext = (
  left: { routeKey: string; context: string } | null,
  right: { routeKey: string; context: string } | null
) => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.routeKey === right.routeKey && left.context === right.context;
};


const debugEnabled =
  (import.meta.env.VITE_GEMINI_DEBUG as string | undefined) === 'true' ||
  (import.meta.env.DEV as boolean | undefined) === true;

const log = (...args: unknown[]) => {
  if (!debugEnabled || typeof console === 'undefined') return;
  console.debug('[VoiceAssistant]', ...args);
};

const getAudioContextCtor = () => {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as any).webkitAudioContext || null;
};

const getSpeechRecognitionCtor = () => {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

const downsampleBuffer = (buffer: Float32Array, inputRate: number, outputRate: number) => {
  if (outputRate >= inputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      sum += buffer[i];
      count += 1;
    }
    result[offsetResult] = count ? sum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
};

const encodeWav = (samples: Float32Array, sampleRate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const floatToInt16 = (input: Float32Array) => {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
};

type WavConversionOptions = {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
};

const base64ToUint8Array = (data: string) => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const parseMimeType = (mimeType: string): WavConversionOptions => {
  const [fileType, ...params] = mimeType.split(';').map((s) => s.trim());
  const [, format] = fileType.split('/');

  const options: Partial<WavConversionOptions> = {
    numChannels: 1,
    bitsPerSample: 16,
  };

  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10);
    if (!Number.isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split('=').map((s) => s.trim());
    if (key === 'rate') {
      options.sampleRate = parseInt(value, 10);
    }
  }

  return options as WavConversionOptions;
};

export default function VoiceAssistantPopup() {
  const { language, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, firebaseUser, lineIdToken, isLoading, isLiffReady, isInLineApp, refreshUserData } = useAuth();
  const langKey = language === 'zh-TW' ? 'zh-TW' : 'en';
  const copy = COPY[langKey];

  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isLauncherMinimized, setIsLauncherMinimized] = useState(false);
  const [isLauncherHidden, setIsLauncherHidden] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoResumeRef = useRef(false);
  const messageIdRef = useRef(1);
  const handledToolIdsRef = useRef(new Set<string>());
  const micLevelRef = useRef(0);
  const micLevelRafRef = useRef<number | null>(null);
  const isOpenRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const lastScrollTargetRef = useRef<EventTarget | null>(null);
  const lastTouchYRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioMutedRef = useRef(false);
  const useServerTranscriptionRef = useRef(false);
  const recordedChunksRef = useRef<Float32Array[]>([]);
  const inputSampleRateRef = useRef(TARGET_SAMPLE_RATE);

  const captureContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const isRecordingRef = useRef(false);

  const liveSessionIdRef = useRef<string | null>(null);
  const pageContextRef = useRef<{ routeKey: string; context: string } | null>(null);
  const liveContextRef = useRef<{ routeKey: string; context: string } | null>(null);
  const liveStreamAbortRef = useRef<AbortController | null>(null);
  const liveEventSourceRef = useRef<EventSource | null>(null);
  const liveChunkQueueRef = useRef<Int16Array[]>([]);
  const liveChunkTimerRef = useRef<number | null>(null);
  const liveSendingRef = useRef(false);
  const useLiveStreamingRef = useRef(false);
  const preferRelayRef = useRef(true);
  const lineIdTokenRef = useRef('');
  const lastAudioLogRef = useRef(0);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlaybackTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const liveSocketRef = useRef<WebSocket | null>(null);
  const liveSocketReadyRef = useRef(false);
  const lastAudioAtRef = useRef(0);
  const openDialogIdsRef = useRef(new Set<string>());
  const dialogPauseStateRef = useRef<{ shouldAutoResume: boolean; audioMuted: boolean } | null>(null);

  useEffect(() => {
    lineIdTokenRef.current = lineIdToken || '';
  }, [lineIdToken]);

  const cleanupCapture = async () => {
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    muteGainRef.current?.disconnect();
    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    muteGainRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (captureContextRef.current) {
      await captureContextRef.current.close().catch(() => {});
      captureContextRef.current = null;
    }
  };

  const ensurePlaybackContext = () => {
    if (playbackContextRef.current) return playbackContextRef.current;
    const AudioCtx = getAudioContextCtor();
    if (!AudioCtx) {
      throw new Error('AudioContext not supported');
    }
    const ctx = new AudioCtx();
    playbackContextRef.current = ctx;
    return ctx;
  };

  const unlockPlayback = async () => {
    try {
      const ctx = ensurePlaybackContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (error) {
      console.warn('Playback unlock skipped', error);
    }
  };

  const stopPlayback = () => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {}
      try {
        source.disconnect();
      } catch {}
    });
    activeSourcesRef.current = [];
    nextPlaybackTimeRef.current = 0;
  };

  const playInlineAudio = async (data: string, mimeType?: string) => {
    if (audioMutedRef.current) return;
    const ctx = ensurePlaybackContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const options = parseMimeType(mimeType ?? 'audio/pcm;rate=24000');
    const sampleRate = options.sampleRate || 24000;
    const bytes = base64ToUint8Array(data);
    const sampleCount = Math.floor(bytes.length / 2);
    if (sampleCount <= 0) return;
    const buffer = ctx.createBuffer(1, sampleCount, sampleRate);
    const channel = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < sampleCount; i += 1) {
      channel[i] = view.getInt16(i * 2, true) / 32768;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((node) => node !== source);
    };
    const startAt = Math.max(ctx.currentTime, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
    activeSourcesRef.current.push(source);
  };

  const getLiveRelayUrl = () => {
    const raw = (import.meta.env.VITE_VOICE_RELAY_URL as string | undefined)?.trim();
    if (!raw) return null;
    const base = raw.replace(/\/+$/, '');
    if (base.startsWith('ws://') || base.startsWith('wss://')) {
      return `${base}/voice/live`;
    }
    if (base.startsWith('http://')) {
      return `ws://${base.slice('http://'.length)}/voice/live`;
    }
    if (base.startsWith('https://')) {
      return `wss://${base.slice('https://'.length)}/voice/live`;
    }
    return `${base}/voice/live`;
  };

  const getLiveRelayHttpBase = () => {
    const raw = (import.meta.env.VITE_VOICE_RELAY_URL as string | undefined)?.trim();
    if (!raw) return null;
    const base = raw.replace(/\/+$/, '');
    if (base.startsWith('ws://')) {
      return `http://${base.slice('ws://'.length)}`;
    }
    if (base.startsWith('wss://')) {
      return `https://${base.slice('wss://'.length)}`;
    }
    if (base.startsWith('http://') || base.startsWith('https://')) {
      return base;
    }
    return `https://${base}`;
  };

  const getLiveHttpEndpoints = () => {
    const relayBase = preferRelayRef.current ? getLiveRelayHttpBase() : null;
    if (relayBase) {
      return { base: relayBase, prefix: '/voice/live' };
    }
    return { base: resolveApiBaseUrl(), prefix: '/api/voice/live' };
  };

  const getAuthToken = async () => {
    if (!firebaseUser) return '';
    try {
      return await firebaseUser.getIdToken(true);
    } catch (error) {
      log('Failed to fetch auth token', error);
      return '';
    }
  };

  const getLineIdToken = async () => {
    if (lineIdTokenRef.current) return lineIdTokenRef.current;
    if (!isInLineApp || !isLiffReady) return '';
    try {
      const liff = (await import('@line/liff')).default;
      const token = typeof liff.getIDToken === 'function' ? liff.getIDToken() : '';
      if (token) {
        lineIdTokenRef.current = token;
      }
      return token || '';
    } catch (error) {
      log('Failed to fetch LIFF ID token', error);
      return '';
    }
  };

  const resolveAuth = async () => {
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        if (token) {
          return { headers: { Authorization: `Bearer ${token}` }, type: 'firebase' as const };
        }
      } catch (error) {
        log('Failed to fetch Firebase token', error);
      }
    }
    const lineIdToken = await getLineIdToken();
    if (lineIdToken) {
      return { headers: { 'X-Line-Id-Token': lineIdToken }, type: 'line' as const };
    }
    return { headers: {}, type: 'none' as const };
  };

  const requireAuth = async () => {
    const auth = await resolveAuth();
    if (auth.type === 'none') {
      toast({
        title: copy.authRequiredTitle,
        description: copy.authRequiredDesc,
        variant: 'destructive',
      });
      setStatus('idle');
      return null;
    }
    return auth;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia) return;
    const media = window.matchMedia('(max-width: 640px)');
    const updateViewport = () => {
      setIsMobileViewport(media.matches);
    };
    updateViewport();
    if (media.addEventListener) {
      media.addEventListener('change', updateViewport);
      return () => media.removeEventListener('change', updateViewport);
    }
    media.addListener(updateViewport);
    return () => media.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const resolveScrollTop = (target: EventTarget | null) => {
      if (!target || target === window || target === document) {
        return (
          window.scrollY ||
          document.documentElement?.scrollTop ||
          document.body?.scrollTop ||
          0
        );
      }
      if (target instanceof HTMLElement) {
        return target.scrollTop;
      }
      return window.scrollY || 0;
    };

    const resolveScrollMetrics = (target: EventTarget | null) => {
      const element =
        target instanceof HTMLElement
          ? target
          : document.scrollingElement ?? document.documentElement;
      if (!element) return null;
      return {
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    };

    const setScrollBaseline = (target: EventTarget | null) => {
      lastScrollTargetRef.current = target;
      lastScrollYRef.current = resolveScrollTop(target);
    };

    const updateLauncherVisibility = (target: EventTarget | null) => {
      if (!isMobileViewport) {
        setIsLauncherHidden(false);
        return;
      }
      const metrics = resolveScrollMetrics(target);
      if (!metrics) {
        setIsLauncherHidden(false);
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = metrics;
      if (scrollHeight <= clientHeight + 1) {
        setIsLauncherHidden(true);
        return;
      }
      const atBottom =
        scrollTop + clientHeight >= scrollHeight - LAUNCHER_HIDE_THRESHOLD_PX;
      setIsLauncherHidden((prev) => (prev === atBottom ? prev : atBottom));
    };

    setScrollBaseline(document.scrollingElement ?? document.documentElement);
    updateLauncherVisibility(document.scrollingElement ?? document.documentElement);

    const applyScrollDelta = (delta: number, currentScroll: number | null) => {
      if (isOpenRef.current) return;
      if (currentScroll !== null && currentScroll <= 8) {
        setIsLauncherMinimized(false);
        return;
      }
      if (delta > 6) {
        setIsLauncherMinimized(true);
      } else if (delta < -6) {
        setIsLauncherMinimized(false);
      }
    };

    const handleScroll = (event?: Event) => {
      if (scrollRafRef.current !== null) return;
      const target = event?.target ?? document.scrollingElement ?? document.documentElement;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const currentScroll = resolveScrollTop(target);

        if (lastScrollTargetRef.current !== target) {
          setScrollBaseline(target);
          return;
        }

        const delta = currentScroll - lastScrollYRef.current;
        applyScrollDelta(delta, currentScroll);
        updateLauncherVisibility(target);

        lastScrollYRef.current = currentScroll;
      });
    };

    const handleScrollEvent = (event: Event) => handleScroll(event);
    const handleTouchStart = (event: TouchEvent) => {
      if (!isInLineApp) return;
      const touch = event.touches[0];
      lastTouchYRef.current = touch ? touch.clientY : null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!isInLineApp) return;
      const touch = event.touches[0];
      if (!touch || lastTouchYRef.current === null) return;
      const delta = lastTouchYRef.current - touch.clientY;
      if (Math.abs(delta) < 6) return;
      applyScrollDelta(delta, null);
      updateLauncherVisibility(document.scrollingElement ?? document.documentElement);
      lastTouchYRef.current = touch.clientY;
    };
    const handleTouchEnd = () => {
      lastTouchYRef.current = null;
    };
    const handleWheel = (event: WheelEvent) => {
      if (!isInLineApp) return;
      if (Math.abs(event.deltaY) < 6) return;
      applyScrollDelta(event.deltaY, null);
      updateLauncherVisibility(document.scrollingElement ?? document.documentElement);
    };

    window.addEventListener('scroll', handleScrollEvent, { passive: true });
    document.addEventListener('scroll', handleScrollEvent, { passive: true, capture: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollEvent);
      document.removeEventListener('scroll', handleScrollEvent, true);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('wheel', handleWheel);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [isInLineApp, isMobileViewport]);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      void cleanupCapture();
      if (micLevelRafRef.current !== null) {
        cancelAnimationFrame(micLevelRafRef.current);
        micLevelRafRef.current = null;
      }
      stopPlayback();
      stopPlayback();
      if (playbackContextRef.current) {
        playbackContextRef.current.close().catch(() => {});
        playbackContextRef.current = null;
      }
      void stopLiveSession();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const raf = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, messages]);

  const appendMessage = (role: TextEntry['role'], text: string) => {
    const id = messageIdRef.current;
    messageIdRef.current += 1;
    setMessages((prev) => [...prev.slice(-20), { id, role, text, ts: Date.now(), kind: 'text' }]);
  };

  const appendToolCard = (card: ToolUi) => {
    const id = messageIdRef.current;
    messageIdRef.current += 1;
    setMessages((prev) => [...prev.slice(-20), { id, ts: Date.now(), kind: 'tool-card', card }]);
  };

  const updateMicLevel = (level: number) => {
    const clamped = Math.max(0, Math.min(1, level));
    micLevelRef.current = clamped;
    if (micLevelRafRef.current !== null) return;
    micLevelRafRef.current = requestAnimationFrame(() => {
      micLevelRafRef.current = null;
      setMicLevel(micLevelRef.current);
    });
  };

  const resetMicLevel = () => {
    micLevelRef.current = 0;
    setMicLevel(0);
  };

  const resumeListeningIfNeeded = () => {
    if (!shouldAutoResumeRef.current) return;
    if (!isOpenRef.current) return;
    if (isRecordingRef.current) return;
    void startRecording();
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    log('Sending text request', { length: trimmed.length });
    appendMessage('user', trimmed);
    setStatus('processing');

    try {
      const auth = await requireAuth();
      if (!auth) return;
      const apiBaseUrl = resolveApiBaseUrl();
      const pageContext = pageContextRef.current;
      const response = await fetch(`${apiBaseUrl}/api/voice/assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...auth.headers,
        },
        body: JSON.stringify({
          message: trimmed,
          locale: langKey,
          userId: (user as any)?.lineUserId || user?.id,
          pageRoute: pageContext?.routeKey,
          pageContext: pageContext?.context,
        }),
      });

      if (response.status === 401) {
        setStatus('error');
        toast({
          title: copy.authRequiredTitle,
          description: copy.authRequiredDesc,
          variant: 'destructive',
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`Voice assistant request failed: ${response.status}`);
      }

      log('Voice assistant response received', { status: response.status });
      const payload = (await response.json()) as VoiceAssistantResponse;
      const replies = payload.messages?.length ? payload.messages : [];
      if (!replies.length) {
        appendMessage('assistant', copy.connectErrorDesc);
        setStatus('ready');
        resumeListeningIfNeeded();
        return;
      }

      for (const reply of replies) {
        appendMessage('assistant', reply.text);
      }
      if (payload.ui) {
        appendToolCard(payload.ui);
        if (payload.ui.kind === 'product_created' || payload.ui.kind === 'product_updated' || payload.ui.kind === 'store_created') {
          void refreshUserData();
        }
      }
      setStatus('ready');
      resumeListeningIfNeeded();
    } catch (error) {
      console.error('Voice assistant error', error);
      setStatus('error');
      toast({
        title: copy.connectErrorTitle,
        description: copy.connectErrorDesc,
        variant: 'destructive',
      });
    }
  };

  const transcribeRecordedAudio = async () => {
    const chunks = recordedChunksRef.current;
    recordedChunksRef.current = [];
    if (!chunks.length) {
      setStatus('idle');
      resumeListeningIfNeeded();
      return;
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const downsampled = downsampleBuffer(combined, inputSampleRateRef.current, TARGET_SAMPLE_RATE);
    const wavBuffer = encodeWav(downsampled, TARGET_SAMPLE_RATE);
    const audioBase64 = arrayBufferToBase64(wavBuffer);

    try {
      const auth = await requireAuth();
      if (!auth) return;
      const apiBaseUrl = resolveApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/voice/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...auth.headers,
        },
        body: JSON.stringify({
          audioBase64,
          mimeType: 'audio/wav',
          locale: langKey,
          userId: (user as any)?.lineUserId || user?.id,
        }),
      });

      if (response.status === 401) {
        setStatus('error');
        toast({
          title: copy.authRequiredTitle,
          description: copy.authRequiredDesc,
          variant: 'destructive',
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`Voice transcription failed: ${response.status}`);
      }

      const payload = (await response.json()) as VoiceTranscriptionResponse;
      const transcript = payload.transcript?.trim() || '';
      if (!transcript) {
        setStatus('ready');
        resumeListeningIfNeeded();
        return;
      }

      await sendMessage(transcript);
    } catch (error) {
      console.error('Voice transcription error', error);
      setStatus('error');
      toast({
        title: copy.connectErrorTitle,
        description: copy.connectErrorDesc,
        variant: 'destructive',
      });
    }
  };

  const flushLiveAudioQueue = async () => {
    if (liveSendingRef.current) return;
    if (!liveChunkQueueRef.current.length) return;
    const relayUrl = getLiveRelayUrl();
    const socketReady = relayUrl && liveSocketRef.current?.readyState === WebSocket.OPEN;
    const hasSession = !!liveSessionIdRef.current;
    if (!socketReady && !hasSession) return;

    const chunks = liveChunkQueueRef.current;
    liveChunkQueueRef.current = [];
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const buffer = combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength);
    const audioBase64 = arrayBufferToBase64(buffer);

    liveSendingRef.current = true;
    try {
      const now = Date.now();
      if (now - lastAudioLogRef.current > 1000) {
        log('Sending live audio chunk', { bytes: buffer.byteLength });
        lastAudioLogRef.current = now;
      }
      if (relayUrl && liveSocketRef.current?.readyState === WebSocket.OPEN) {
        liveSocketRef.current.send(
          JSON.stringify({ type: 'audio', audioBase64, mimeType: 'audio/pcm;rate=16000' })
        );
        return;
      }
      if (!liveSessionIdRef.current) return;
      const { base, prefix } = getLiveHttpEndpoints();
      const auth = await requireAuth();
      if (!auth) return;
      await fetch(`${base}${prefix}/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...auth.headers,
        },
        body: JSON.stringify({
          sessionId: liveSessionIdRef.current,
          audioBase64,
          mimeType: 'audio/pcm;rate=16000',
        }),
      });
    } catch (error) {
      console.error('Live audio send failed', error);
    } finally {
      liveSendingRef.current = false;
    }
  };

  const handleToolPayload = (payload: LiveEventPayload) => {
    if (!payload.ui) return;
    if (payload.phase === 'start') return;
    const toolId = payload.toolCallId;
    if (toolId) {
      if (handledToolIdsRef.current.has(toolId)) return;
      handledToolIdsRef.current.add(toolId);
      if (handledToolIdsRef.current.size > 40) {
        handledToolIdsRef.current.clear();
      }
    }
    appendToolCard(payload.ui);
    if (payload.ui.kind === 'product_created' || payload.ui.kind === 'product_updated' || payload.ui.kind === 'store_created') {
      void refreshUserData();
    }
  };

  const handleLivePayload = (payload: LiveEventPayload) => {
    if (payload.type === 'text' && payload.text) {
      log('Live stream text');
      appendMessage('assistant', payload.text);
      setStatus('ready');
    } else if (payload.type === 'tool') {
      log('Live stream tool response');
      if (payload.phase === 'start') {
        setStatus('processing');
      }
      if (payload.messages?.length) {
        for (const msg of payload.messages) {
          appendMessage('assistant', msg.text);
        }
      }
      handleToolPayload(payload);
      if (payload.phase !== 'start') {
        setStatus('ready');
      }
    } else if (payload.type === 'audio' && payload.data) {
      lastAudioAtRef.current = Date.now();
      void playInlineAudio(payload.data, payload.mimeType);
    } else if (payload.type === 'turnComplete') {
      log('Live stream turn complete');
      setStatus('ready');
      void waitForAudioIdle().then(() => {
        resumeListeningIfNeeded();
      });
    } else if (payload.type === 'status') {
      log('Live stream status', { status: payload.status, code: payload.code, reason: payload.reason });
      if (payload.status === 'open' || payload.status === 'stream-open') {
        setStatus('ready');
      } else if (payload.status === 'error') {
        setStatus('error');
      }
    }
  };

  const startLiveStream = async (sessionId: string) => {
    if (liveStreamAbortRef.current) {
      liveStreamAbortRef.current.abort();
    }
    if (liveEventSourceRef.current) {
      liveEventSourceRef.current.close();
      liveEventSourceRef.current = null;
    }
    const controller = new AbortController();
    liveStreamAbortRef.current = controller;
    log('Starting live stream', { sessionId });

    const { base, prefix } = getLiveHttpEndpoints();
    const streamUrl = `${base}${prefix}/stream?sessionId=${sessionId}`;
    const startEventSource = () => {
      if (typeof EventSource === 'undefined') {
        throw new Error('EventSource not supported');
      }
      const source = new EventSource(streamUrl);
      liveEventSourceRef.current = source;
      source.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data) as LiveEventPayload;
          handleLivePayload(payload);
        } catch (error) {
          console.warn('Live stream parse failed', error);
        }
      };
      source.onerror = () => {
        log('Live stream error (eventsource)');
      };
    };

    try {
      const response = await fetch(streamUrl, {
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          liveSessionIdRef.current = null;
          useLiveStreamingRef.current = false;
        }
        throw new Error(`Live stream failed: ${response.status}`);
      }
      if (!response.body) {
        startEventSource();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let splitIndex = buffer.indexOf('\n\n');
        while (splitIndex !== -1) {
          const rawEvent = buffer.slice(0, splitIndex);
          buffer = buffer.slice(splitIndex + 2);
          const dataLines = rawEvent
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.replace(/^data:\s?/, ''));
          if (dataLines.length) {
            const payloadString = dataLines.join('');
            try {
              const payload = JSON.parse(payloadString) as LiveEventPayload;
              handleLivePayload(payload);
            } catch (error) {
              console.warn('Live stream parse failed', error);
            }
          }
          splitIndex = buffer.indexOf('\n\n');
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      try {
        startEventSource();
        return;
      } catch {}
      console.error('Live stream error', error);
    }
  };

  const connectLiveWebSocket = async () => {
    const relayUrl = getLiveRelayUrl();
    if (!relayUrl || typeof WebSocket === 'undefined') return false;
    if (liveSocketRef.current) {
      if (liveSocketReadyRef.current) {
        useLiveStreamingRef.current = true;
        return true;
      }
      return new Promise<boolean>((resolve) => {
        const start = Date.now();
        const waitForReady = () => {
          if (liveSocketReadyRef.current) {
            resolve(true);
            return;
          }
          if (!liveSocketRef.current || Date.now() - start > 4000) {
            resolve(false);
            return;
          }
          window.setTimeout(waitForReady, 100);
        };
        waitForReady();
      });
    }
    const firebaseToken = await getAuthToken();
    const lineToken = firebaseToken ? '' : await getLineIdToken();
    const userId = (user as any)?.lineUserId || user?.id || '';
    const hasAuth = Boolean(firebaseToken || lineToken);
    if (!hasAuth) {
      preferRelayRef.current = false;
      return false;
    }
    preferRelayRef.current = true;
    log('Auth token availability', {
      hasFirebaseToken: Boolean(firebaseToken),
      hasLineToken: Boolean(lineToken),
      hasUserId: Boolean(userId),
      isLoading,
    });
    const wsUrl = `${relayUrl}?token=${encodeURIComponent(firebaseToken || '')}&lineIdToken=${encodeURIComponent(
      lineToken || ''
    )}&locale=${encodeURIComponent(langKey)}&userId=${encodeURIComponent(userId)}`;
    log('Connecting live relay socket', { url: relayUrl, locale: langKey });
    await unlockPlayback();
    const socket = new WebSocket(wsUrl);
    liveSocketRef.current = socket;
    liveSocketReadyRef.current = false;
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {}
      liveSocketRef.current = null;
      liveSocketReadyRef.current = false;
      useLiveStreamingRef.current = false;
      setStatus('error');
    }, 4000);

    socket.onopen = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      liveSocketReadyRef.current = true;
      useLiveStreamingRef.current = true;
      useServerTranscriptionRef.current = false;
      log('Live relay socket open');
      setStatus('ready');
    };
    socket.onerror = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timeoutId);
      }
      liveSocketReadyRef.current = false;
      useLiveStreamingRef.current = false;
      log('Live relay socket error');
      setStatus('error');
      liveSocketRef.current = null;
    };
    socket.onclose = (event) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timeoutId);
      }
      liveSocketReadyRef.current = false;
      useLiveStreamingRef.current = false;
      log('Live relay socket closed', { code: event.code, reason: event.reason });
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as LiveEventPayload;
        if (payload.type === 'text' && payload.text) {
          log('Live relay text');
          appendMessage('assistant', payload.text);
        } else if (payload.type === 'tool') {
          log('Live relay tool response');
          if (payload.phase === 'start') {
            setStatus('processing');
          }
          if (payload.messages?.length) {
            for (const msg of payload.messages) {
              appendMessage('assistant', msg.text);
            }
          }
          handleToolPayload(payload);
          if (payload.phase !== 'start') {
            setStatus('ready');
          }
        } else if (payload.type === 'audio' && payload.data) {
          lastAudioAtRef.current = Date.now();
          void playInlineAudio(payload.data, payload.mimeType);
        } else if (payload.type === 'turnComplete') {
          log('Live relay turn complete');
          setStatus('ready');
          void waitForAudioIdle().then(() => {
            resumeListeningIfNeeded();
          });
        } else if (payload.type === 'status') {
          log('Live relay status', { status: payload.status, code: payload.code, reason: payload.reason });
          if (payload.status === 'error') {
            setStatus('error');
          }
        }
      } catch (error) {
        console.warn('Live socket parse failed', error);
      }
    };
    return new Promise<boolean>((resolve) => {
      const checkReady = () => {
        if (liveSocketReadyRef.current) {
          resolve(true);
        } else if (settled && !liveSocketReadyRef.current) {
          resolve(false);
        } else {
          window.setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  };

  const ensureLiveSession = async () => {
    log('Ensuring live session');
    const relayUrl = getLiveRelayUrl();
    if (relayUrl) {
      const connected = await connectLiveWebSocket();
      if (connected) return;
    }
    const desiredContext = pageContextRef.current;
    if (liveSessionIdRef.current && !isSamePageContext(liveContextRef.current, desiredContext)) {
      await stopLiveSession();
    }
    if (liveSessionIdRef.current) {
      useLiveStreamingRef.current = true;
      return;
    }
    setStatus('connecting');
    try {
      const auth = await requireAuth();
      if (!auth) return;
      preferRelayRef.current = Boolean(getLiveRelayHttpBase());
      log('Ensuring live session auth', { type: auth.type, isLoading });
      const { base, prefix } = getLiveHttpEndpoints();
      const response = await fetch(`${base}${prefix}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...auth.headers,
        },
        body: JSON.stringify({
          locale: langKey,
          userId: (user as any)?.lineUserId || user?.id,
          pageRoute: desiredContext?.routeKey,
          pageContext: desiredContext?.context,
        }),
      });

      if (!response.ok) {
        throw new Error(`Live session failed: ${response.status}`);
      }

      const payload = (await response.json()) as { sessionId?: string };
      if (!payload.sessionId) {
        throw new Error('Live session missing sessionId');
      }

      liveSessionIdRef.current = payload.sessionId;
      liveContextRef.current = desiredContext ? { ...desiredContext } : null;
      useLiveStreamingRef.current = true;
      useServerTranscriptionRef.current = false;
      log('Live session ready', { sessionId: payload.sessionId });
      void startLiveStream(payload.sessionId);
      setStatus('ready');
    } catch (error) {
      console.error('Live session error', error);
      useLiveStreamingRef.current = false;
      setStatus('ready');
    }
  };

  const stopLiveSession = async () => {
    if (liveSocketRef.current) {
      try {
        liveSocketRef.current.close();
      } catch {}
      liveSocketRef.current = null;
      liveSocketReadyRef.current = false;
    }
    useLiveStreamingRef.current = false;
    if (!liveSessionIdRef.current) return;
    const sessionId = liveSessionIdRef.current;
    liveSessionIdRef.current = null;
    liveContextRef.current = null;
    if (liveStreamAbortRef.current) {
      liveStreamAbortRef.current.abort();
      liveStreamAbortRef.current = null;
    }
    if (liveEventSourceRef.current) {
      liveEventSourceRef.current.close();
      liveEventSourceRef.current = null;
    }
    try {
      const { base, prefix } = getLiveHttpEndpoints();
      const auth = await resolveAuth();
      await fetch(`${base}${prefix}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...auth.headers,
        },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.warn('Live session close failed', error);
    }
  };

  const stopRecording = async (nextStatus: Status = 'idle') => {
    if (!isRecordingRef.current) return;
    log('Stopping recording');
    isRecordingRef.current = false;
    setIsRecording(false);
    resetMicLevel();
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    if (liveChunkTimerRef.current !== null) {
      window.clearInterval(liveChunkTimerRef.current);
      liveChunkTimerRef.current = null;
    }
    await flushLiveAudioQueue();

    await cleanupCapture();
    setStatus(nextStatus);
  };

  const startRecording = async () => {
    if (isRecordingRef.current) return;
    const AudioCtx = getAudioContextCtor();
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    useServerTranscriptionRef.current = !useLiveStreamingRef.current && !SpeechRecognitionCtor;

    if (!AudioCtx || !navigator.mediaDevices?.getUserMedia) {
      toast({
        title: copy.micUnsupportedTitle,
        description: copy.micUnsupportedDesc,
        variant: 'destructive',
      });
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      toast({
        title: copy.insecureContextTitle,
        description: copy.insecureContextDesc,
        variant: 'destructive',
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: TARGET_SAMPLE_RATE },
          sampleSize: { ideal: 16 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      resetMicLevel();
      recordedChunksRef.current = [];
      liveChunkQueueRef.current = [];
      const captureContext = new AudioCtx({ latencyHint: 'interactive' });
      if (captureContext.state === 'suspended') {
        await captureContext.resume();
      }
      captureContextRef.current = captureContext;
      inputSampleRateRef.current = captureContext.sampleRate;
      const source = captureContext.createMediaStreamSource(stream);
      const processor = captureContext.createScriptProcessor(2048, 1, 1);
      const muteGain = captureContext.createGain();
      muteGain.gain.value = 0;
      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(captureContext.destination);

      mediaStreamRef.current = stream;
      sourceNodeRef.current = source;
      processorNodeRef.current = processor;
      muteGainRef.current = muteGain;
      isRecordingRef.current = true;
      setIsRecording(true);
      setStatus('listening');
      log('Audio capture ready', { inputRate: captureContext.sampleRate, targetRate: TARGET_SAMPLE_RATE });

      liveChunkTimerRef.current = window.setInterval(() => {
        if (useLiveStreamingRef.current) {
          void flushLiveAudioQueue();
        }
      }, LIVE_CHUNK_INTERVAL_MS);

      processor.onaudioprocess = (event) => {
        if (!isRecordingRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i += 1) {
          sum += input[i] * input[i];
        }
        const rms = Math.sqrt(sum / input.length);
        const normalized = Math.min(1, rms * MIC_LEVEL_GAIN);
        const smoothed = micLevelRef.current * MIC_LEVEL_SMOOTHING + normalized * (1 - MIC_LEVEL_SMOOTHING);
        updateMicLevel(smoothed);

        if (useLiveStreamingRef.current) {
          const downsampled = downsampleBuffer(input, inputSampleRateRef.current, TARGET_SAMPLE_RATE);
          liveChunkQueueRef.current.push(floatToInt16(downsampled));
        } else if (useServerTranscriptionRef.current) {
          recordedChunksRef.current.push(new Float32Array(input));
        }
      };

      if (!useLiveStreamingRef.current && SpeechRecognitionCtor) {
        const recognition: SpeechRecognitionInstance = new SpeechRecognitionCtor();
        recognition.lang = langKey === 'zh-TW' ? 'zh-TW' : 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event: any) => {
          const transcript = event?.results?.[0]?.[0]?.transcript;
          if (transcript) {
            void stopRecording('processing').then(() => sendMessage(transcript));
          } else {
            void stopRecording('idle');
          }
        };
        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error', event);
          void stopRecording('error');
          toast({
            title: copy.micUnavailableTitle,
            description: copy.micUnavailableDesc,
            variant: 'destructive',
          });
        };
        recognition.onend = () => {
          if (isRecordingRef.current) {
            void stopRecording('idle');
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }
    } catch (error: any) {
      const isPermissionError =
        error?.name === 'NotAllowedError' ||
        error?.name === 'PermissionDeniedError' ||
        error?.name === 'SecurityError';
      toast({
        title: isPermissionError ? copy.micPermissionDeniedTitle : copy.micUnavailableTitle,
        description: error?.message || (isPermissionError ? copy.micPermissionDeniedDesc : copy.micUnavailableDesc),
        variant: 'destructive',
      });
      void cleanupCapture();
      isRecordingRef.current = false;
      setIsRecording(false);
      resetMicLevel();
      setStatus(isPermissionError ? 'idle' : 'error');
    }
  };

  const openAssistant = async (options: OpenAssistantOptions = {}) => {
    if (isOpenRef.current) return;
    const auth = await requireAuth();
    if (!auth) return;
    const { autoPrompt, startListening = true } = options;
    isOpenRef.current = true;
    if (startListening) {
      shouldAutoResumeRef.current = true;
      void startRecording();
    }
    log('Opening assistant');
    audioMutedRef.current = false;
    setIsOpen(true);
    setStatus('ready');
    appendMessage('system', copy.readyMessage);
    if (autoPrompt) {
      appendMessage('assistant', autoPrompt);
    }
    void unlockPlayback();
    void ensureLiveSession();
  };

  const closeAssistant = () => {
    log('Closing assistant');
    isOpenRef.current = false;
    setIsOpen(false);
    shouldAutoResumeRef.current = false;
    audioMutedRef.current = true;
    lastAudioAtRef.current = 0;
    stopPlayback();
    if (isRecordingRef.current) {
      void stopRecording('idle');
    }
    void stopLiveSession();
  };

  const pauseForDialog = () => {
    if (dialogPauseStateRef.current) return;
    dialogPauseStateRef.current = {
      shouldAutoResume: shouldAutoResumeRef.current,
      audioMuted: audioMutedRef.current,
    };
    shouldAutoResumeRef.current = false;
    audioMutedRef.current = true;
    lastAudioAtRef.current = 0;
    stopPlayback();
    if (isRecordingRef.current) {
      void stopRecording('idle');
    }
  };

  const resumeFromDialog = () => {
    const pausedState = dialogPauseStateRef.current;
    if (!pausedState) return;
    dialogPauseStateRef.current = null;
    if (!isOpenRef.current) {
      audioMutedRef.current = true;
      shouldAutoResumeRef.current = false;
      return;
    }
    audioMutedRef.current = pausedState.audioMuted;
    shouldAutoResumeRef.current = pausedState.shouldAutoResume;
    resumeListeningIfNeeded();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleDialogChange = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; open?: boolean }>).detail;
      if (!detail || typeof detail.open !== 'boolean' || !detail.id) return;
      if (detail.open) {
        openDialogIdsRef.current.add(detail.id);
        if (openDialogIdsRef.current.size === 1) {
          pauseForDialog();
        }
        return;
      }
      openDialogIdsRef.current.delete(detail.id);
      if (openDialogIdsRef.current.size === 0) {
        resumeFromDialog();
      }
    };
    window.addEventListener(DIALOG_TOGGLE_EVENT, handleDialogChange);
    return () => window.removeEventListener(DIALOG_TOGGLE_EVENT, handleDialogChange);
  }, []);

  const waitForAudioIdle = async () => {
    const start = Date.now();
    while (Date.now() - start < 6000) {
      const liveAudioRecent = Date.now() - lastAudioAtRef.current < 450;
      const playbackActive = playbackContextRef.current
        ? playbackContextRef.current.currentTime < nextPlaybackTimeRef.current - 0.05
        : false;
      if (!liveAudioRecent && !playbackActive) {
        break;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
    }
  };

  const buildTutorialRequest = () => {
    return langKey === 'zh-TW'
      ? '請開始這個頁面的語音導覽：先簡要介紹，再說明導覽路徑與主要操作。'
      : 'Start a voice walkthrough for this page: give a short overview, navigation, and key actions.';
  };

  const sendLiveText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    await ensureLiveSession();
    if (liveSocketRef.current && liveSocketReadyRef.current) {
      liveSocketRef.current.send(JSON.stringify({ type: 'text', text: trimmed }));
      return true;
    }
    if (!liveSessionIdRef.current) {
      return false;
    }
    const auth = await requireAuth();
    if (!auth) return false;
    const { base, prefix } = getLiveHttpEndpoints();
    await fetch(`${base}${prefix}/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.headers,
      },
      body: JSON.stringify({
        sessionId: liveSessionIdRef.current,
        text: trimmed,
      }),
    });
    return true;
  };

  const handleToolPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setStatus('processing');
    const sent = await sendLiveText(trimmed);
    if (sent) {
      appendMessage('user', trimmed);
      await waitForAudioIdle();
      if (!isRecordingRef.current) {
        void startRecording();
      }
      return;
    }
    await sendMessage(trimmed);
  };

  const handleNavigate = (href: string) => {
    if (!href) return;
    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(href);
  };

  const handleToolAction = (action: ToolUiAction) => {
    if (action.prompt) {
      void handleToolPrompt(action.prompt);
      return;
    }
    if (action.href) {
      handleNavigate(action.href);
    }
  };

  const handleStartTutorial = async () => {
    const page = getVoicePageContext(location.pathname, t);
    if (!page) {
      const fallbackText =
        langKey === 'zh-TW'
          ? '目前這個頁面還沒有可用的語音導覽。'
          : 'There is no tutorial available for this page yet.';
      appendMessage('assistant', fallbackText);
      return;
    }
    if (!isOpenRef.current) {
      await openAssistant({ startListening: false });
    }
    const requestText = buildTutorialRequest();
    setStatus('processing');
    const sent = await sendLiveText(requestText);
    if (!sent) {
      const failText =
        langKey === 'zh-TW'
          ? '目前無法連線到即時語音服務，請稍後再試。'
          : 'Unable to connect to live voice right now. Please try again.';
      appendMessage('assistant', failText);
      setStatus('ready');
      return;
    }
    appendMessage('user', requestText);
    await waitForAudioIdle();
    if (!isRecordingRef.current) {
      void startRecording();
    }
  };

  useEffect(() => {
    if (isLoading) return;
    const page = getVoicePageContext(location.pathname, t);
    if (!page) {
      pageContextRef.current = null;
      return;
    }
    pageContextRef.current = { routeKey: page.routeKey, context: page.context };
    if (isOpenRef.current) {
      void ensureLiveSession();
    }
  }, [isLoading, location.pathname, t]);

  const handleMicClick = () => {
    if (isRecording) {
      shouldAutoResumeRef.current = false;
      if (useLiveStreamingRef.current) {
        void stopRecording('idle');
      } else if (useServerTranscriptionRef.current) {
        void stopRecording('processing').then(() => transcribeRecordedAudio());
      } else {
        void stopRecording('idle');
      }
      return;
    }
    shouldAutoResumeRef.current = true;
    void startRecording();
  };

  const isBusy = status === 'processing' || status === 'connecting';
  const isListening = status === 'listening';
  const isThinking = status === 'processing' || status === 'connecting';
  const activityState = isListening ? 'listening' : isThinking ? 'thinking' : null;
  const activityCopy =
    activityState === 'listening'
      ? { title: copy.listeningTitle, desc: copy.listeningDesc, badge: copy.listeningBadge }
      : activityState === 'thinking'
      ? { title: copy.thinkingTitle, desc: copy.thinkingDesc, badge: copy.thinkingBadge }
      : null;
  const activityStyles =
    activityState === 'listening'
      ? {
          ring: 'border-emerald-300/70',
          glow: 'bg-emerald-200/40',
          core: 'bg-emerald-500/90',
          text: 'text-emerald-950',
          sub: 'text-emerald-700/80',
        }
      : {
          ring: 'border-amber-300/70',
          glow: 'bg-amber-200/40',
          core: 'bg-amber-400/90',
          text: 'text-amber-950',
          sub: 'text-amber-700/80',
        };
  const launcherBottomOffset =
    isInLineApp && isMobileViewport
      ? 'calc(1.5rem + 64px + env(safe-area-inset-bottom))'
      : 'calc(1.5rem + env(safe-area-inset-bottom))';
  const showWave = !isOpen && (isListening || isThinking);
  const showThinkingRing = !isOpen && isThinking;

  const renderToolCard = (card: ToolUi) => {
    const isTraditional = langKey === 'zh-TW';
    const formatPrice = (price?: number, unit?: string) => {
      if (typeof price !== 'number') return isTraditional ? '價格 —' : 'Price —';
      const formatted = price.toLocaleString();
      const suffix = unit ? `/${unit}` : '';
      return `${isTraditional ? 'NT$ ' : '$'}${formatted}${suffix}`;
    };
    const formatStock = (stock?: number) => {
      if (typeof stock !== 'number') return isTraditional ? '庫存 —' : 'Stock —';
      return isTraditional ? `庫存 ${stock}` : `Stock ${stock}`;
    };
    const renderActions = (actions: ToolUiAction[] | undefined, style: (typeof CARD_STYLES)['product']) => {
      if (!actions?.length) return null;
      const cols =
        actions.length >= 3 ? 'grid-cols-3' : actions.length === 2 ? 'grid-cols-2' : 'grid-cols-1';
      return (
        <div className={`grid ${cols} gap-2`}>
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className={`h-9 rounded-lg text-xs font-semibold ${style.action}`}
              onClick={() => handleToolAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      );
    };
    const renderEmptyState = (empty: ToolUiEmptyState | undefined, style: (typeof CARD_STYLES)['product']) => {
      if (!empty) return null;
      return (
        <div className={`rounded-xl border ${style.border} bg-white/80 px-4 py-4 text-center`}>
          <div className="text-sm font-semibold text-slate-900">{empty.title}</div>
          <div className={`mt-1 text-xs ${style.muted}`}>{empty.description}</div>
          {empty.actions?.length ? <div className="mt-3">{renderActions(empty.actions, style)}</div> : null}
        </div>
      );
    };

    const renderToolkitCard = (toolkit: ToolUiToolkit) => {
      const headerMap = {
        product_tools: { icon: Package, style: CARD_STYLES.product },
        store_tools: { icon: Store, style: CARD_STYLES.store },
        marketing_tools: { icon: Sparkles, style: CARD_STYLES.marketing },
        analytics_tools: { icon: BarChart3, style: CARD_STYLES.stats },
        help_options: { icon: ListChecks, style: CARD_STYLES.neutral },
      } as const;
      const header = headerMap[toolkit.kind];
      const HeaderIcon = header.icon;
      const actionCols = toolkit.actions.length >= 3 ? 'grid-cols-3' : 'grid-cols-2';
      return (
        <div className={`rounded-2xl border ${header.style.border} bg-white/90 shadow-[0_20px_45px_-30px_rgba(16,185,129,0.65)] overflow-hidden`}>
          <div className={`flex items-start gap-3 bg-gradient-to-r ${header.style.header} px-4 py-3 text-white`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <HeaderIcon className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{toolkit.title}</div>
              <div className="text-xs text-white/80">{toolkit.description}</div>
            </div>
          </div>
          <div className="space-y-3 p-4">
            {toolkit.items.map((item) => {
              const Icon = TOOL_ICON_MAP[item.icon];
              const accent = TOOL_ACCENTS[item.icon];
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleToolPrompt(item.prompt)}
                  className={`flex w-full items-start gap-3 rounded-xl border ${accent.border} bg-white/80 px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent.bg} ${accent.text}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-600">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-4 pb-4">
            <div className={`grid ${actionCols} gap-2`}>
              {toolkit.actions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  className={`h-9 rounded-lg text-xs font-semibold ${header.style.action}`}
                  onClick={() => handleToolAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      );
    };

    const renderProductListCard = (tool: ToolUiProductList) => {
      const style = tool.context === 'market' ? CARD_STYLES.marketplace : CARD_STYLES.product;
      return (
        <div className={`rounded-2xl border ${style.border} bg-white/90 shadow-[0_20px_45px_-30px_rgba(15,118,110,0.5)] overflow-hidden`}>
          <div className={`flex items-start gap-3 bg-gradient-to-r ${style.header} px-4 py-3 text-white`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Package className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{tool.title}</div>
              {tool.description ? <div className="text-xs text-white/80">{tool.description}</div> : null}
            </div>
          </div>
          <div className="space-y-2 p-4">
            {tool.items.length === 0 ? (
              renderEmptyState(tool.emptyState, style)
            ) : (
              tool.items.map((item) => {
                const name = item.name?.trim() || (isTraditional ? '未命名產品' : 'Untitled product');
                const lowStock = typeof item.stock === 'number' && item.stock <= 10;
                const initial = name.trim()[0]?.toUpperCase() || '?';
                const content = (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-emerald-50/80 text-emerald-700">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold">{initial}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{name}</span>
                        {lowStock ? (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px] border border-amber-200">
                            {isTraditional ? '偏低' : 'Low'}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {[item.category, item.unit].filter(Boolean).join(' · ') || (isTraditional ? '未分類' : 'Uncategorized')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-700">{formatPrice(item.price, item.unit)}</div>
                      <div className="text-xs text-slate-500">{formatStock(item.stock)}</div>
                    </div>
                  </>
                );
                return item.href ? (
                  <button
                    key={item.id || item.name}
                    type="button"
                    onClick={() => handleNavigate(item.href!)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={item.id || item.name}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-2 shadow-sm"
                  >
                    {content}
                  </div>
                );
              })
            )}
          </div>
          {tool.actions?.length ? <div className="px-4 pb-4">{renderActions(tool.actions, style)}</div> : null}
        </div>
      );
    };

    const renderProductCreatedCard = (tool: ToolUiProductCreated | ToolUiProductUpdated) => {
      const style = CARD_STYLES.product;
      const isNewlyCreated = tool.kind === 'product_created';
      const product = tool.product;
      const name = product.name?.trim() || (isTraditional ? '未命名產品' : 'Untitled product');
      const initial = name.trim()[0]?.toUpperCase() || '?';
      const description = product.description?.trim();
      const pickupAddress = product.pickup?.address?.trim();
      const imageCount = product.imageCount ?? (product.imageUrl ? 1 : 0);
      const detailRows = [
        {
          icon: Image,
          label: imageCount
            ? isTraditional
              ? `圖片 ${imageCount} 張`
              : `${imageCount} image${imageCount > 1 ? 's' : ''}`
            : isTraditional
            ? '尚未新增圖片'
            : 'No images yet',
        },
        {
          icon: MapPin,
          label: pickupAddress || (isTraditional ? '尚未設定取貨地址' : 'Pickup address not set'),
        },
      ];
      if (description) {
        detailRows.push({
          icon: FileText,
          label: description.length > 80 ? `${description.slice(0, 80)}…` : description,
        });
      }
      return (
        <div className={`rounded-2xl border ${isNewlyCreated ? 'border-4 border-emerald-400' : style.border} ${isNewlyCreated ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50' : 'bg-white/90'} shadow-[0_20px_45px_-30px_rgba(16,185,129,0.55)] overflow-hidden ${isNewlyCreated ? 'animate-slideIn animate-glow' : ''} relative`}>
          {isNewlyCreated && (
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 via-green-400/20 to-teal-400/20 rounded-2xl animate-shimmer" />
          )}
          <div className={`flex items-start gap-3 bg-gradient-to-r ${isNewlyCreated ? 'from-emerald-500 via-green-500 to-teal-500' : style.header} px-4 py-3 text-white relative z-10`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isNewlyCreated ? 'bg-white/25' : 'bg-white/15'}`} style={isNewlyCreated ? { animation: 'bounce 1s ease-in-out 3' } : undefined}>
              <Package className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{tool.title}</div>
              {tool.description ? <div className="text-xs text-white/80">{tool.description}</div> : null}
            </div>
          </div>
          <div className={`p-4 relative z-10 ${isNewlyCreated ? 'bg-gradient-to-br from-white/90 to-emerald-50/50' : ''}`}>
            {product.href ? (
              <button
                type="button"
                onClick={() => handleNavigate(product.href!)}
                className={`flex w-full items-center gap-4 rounded-xl border ${isNewlyCreated ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50' : 'border-white/70 bg-white/80'} p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isNewlyCreated ? 'hover:border-emerald-400' : ''}`}
              >
                <div className={`h-16 w-16 overflow-hidden rounded-xl border ${isNewlyCreated ? 'border-emerald-300 bg-gradient-to-br from-emerald-100 to-green-100' : 'border-white/70 bg-emerald-50/80'} ${isNewlyCreated ? 'ring-2 ring-emerald-400/50' : ''}`}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center text-lg font-semibold ${isNewlyCreated ? 'text-emerald-700' : 'text-emerald-700'}`}>
                      {initial}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${isNewlyCreated ? 'text-emerald-900' : 'text-slate-900'}`}>{name}</div>
                  <div className="text-xs text-slate-500">
                    {[product.category, product.unit].filter(Boolean).join(' · ') || (isTraditional ? '未分類' : 'Uncategorized')}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className={`rounded-full px-2 py-0.5 ${isNewlyCreated ? 'bg-emerald-200 text-emerald-800 font-semibold' : style.badge}`}>{formatPrice(product.price, product.unit)}</span>
                    <span className={`rounded-full px-2 py-0.5 ${isNewlyCreated ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{formatStock(product.stock)}</span>
                  </div>
                </div>
              </button>
            ) : (
              <div className={`flex items-center gap-4 rounded-xl border ${isNewlyCreated ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50' : 'border-white/70 bg-white/80'} p-3 shadow-sm`}>
                <div className={`h-16 w-16 overflow-hidden rounded-xl border ${isNewlyCreated ? 'border-emerald-300 bg-gradient-to-br from-emerald-100 to-green-100' : 'border-white/70 bg-emerald-50/80'} ${isNewlyCreated ? 'ring-2 ring-emerald-400/50' : ''}`}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center text-lg font-semibold ${isNewlyCreated ? 'text-emerald-700' : 'text-emerald-700'}`}>
                      {initial}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${isNewlyCreated ? 'text-emerald-900' : 'text-slate-900'}`}>{name}</div>
                  <div className="text-xs text-slate-500">
                    {[product.category, product.unit].filter(Boolean).join(' · ') || (isTraditional ? '未分類' : 'Uncategorized')}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className={`rounded-full px-2 py-0.5 ${isNewlyCreated ? 'bg-emerald-200 text-emerald-800 font-semibold' : style.badge}`}>{formatPrice(product.price, product.unit)}</span>
                    <span className={`rounded-full px-2 py-0.5 ${isNewlyCreated ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{formatStock(product.stock)}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              {detailRows.map((row) => {
                const RowIcon = row.icon;
                return (
                  <div key={row.label} className="flex items-start gap-2">
                    <RowIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                    <span className="flex-1">{row.label}</span>
                  </div>
                );
              })}
            </div>
            {tool.actions?.length ? <div className="mt-4">{renderActions(tool.actions, style)}</div> : null}
          </div>
        </div>
      );
    };

    const renderStoreListCard = (tool: ToolUiStoreList) => {
      const style = tool.context === 'market' ? CARD_STYLES.marketplace : CARD_STYLES.store;
      return (
        <div className={`rounded-2xl border ${style.border} bg-white/90 shadow-[0_20px_45px_-30px_rgba(249,115,22,0.35)] overflow-hidden`}>
          <div className={`flex items-start gap-3 bg-gradient-to-r ${style.header} px-4 py-3 text-white`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Store className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{tool.title}</div>
              {tool.description ? <div className="text-xs text-white/80">{tool.description}</div> : null}
            </div>
          </div>
          <div className="space-y-2 p-4">
            {tool.items.length === 0 ? (
              renderEmptyState(tool.emptyState, style)
            ) : (
              tool.items.map((item) => {
                const name = item.name?.trim() || (isTraditional ? '未命名店家' : 'Unnamed store');
                const details = [item.type, item.location].filter(Boolean).join(' · ');
                const content = (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                      <Store className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{name}</div>
                      <div className="text-xs text-slate-500 truncate">{details || (isTraditional ? '未提供資訊' : 'No details')}</div>
                    </div>
                    {item.status ? (
                      <Badge className="bg-orange-100 text-orange-700 text-[10px] border border-orange-200">
                        {item.status.replace(/_/g, ' ')}
                      </Badge>
                    ) : null}
                  </>
                );
                return item.href ? (
                  <button
                    key={item.id || item.name}
                    type="button"
                    onClick={() => handleNavigate(item.href!)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={item.id || item.name}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-2 shadow-sm"
                  >
                    {content}
                  </div>
                );
              })
            )}
          </div>
          {tool.actions?.length ? <div className="px-4 pb-4">{renderActions(tool.actions, style)}</div> : null}
        </div>
      );
    };

    const renderStoreCreatedCard = (tool: ToolUiStoreCreated) => {
      const style = CARD_STYLES.store;
      const store = tool.store;
      const name = store.name?.trim() || (isTraditional ? '未命名店家' : 'Unnamed store');
      return (
        <div className={`rounded-2xl border ${style.border} bg-white/90 shadow-[0_20px_45px_-30px_rgba(249,115,22,0.35)] overflow-hidden`}>
          <div className={`flex items-start gap-3 bg-gradient-to-r ${style.header} px-4 py-3 text-white`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Store className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{tool.title}</div>
              {tool.description ? <div className="text-xs text-white/80">{tool.description}</div> : null}
            </div>
          </div>
          <div className="p-4">
            {store.href ? (
              <button
                type="button"
                onClick={() => handleNavigate(store.href!)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                  <Store className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{name}</div>
                  <div className="text-xs text-slate-500">
                    {[store.type, store.location].filter(Boolean).join(' · ') || (isTraditional ? '未提供資訊' : 'No details')}
                  </div>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-3 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                  <Store className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{name}</div>
                  <div className="text-xs text-slate-500">
                    {[store.type, store.location].filter(Boolean).join(' · ') || (isTraditional ? '未提供資訊' : 'No details')}
                  </div>
                </div>
              </div>
            )}
            {tool.actions?.length ? <div className="mt-4">{renderActions(tool.actions, style)}</div> : null}
          </div>
        </div>
      );
    };

    const renderMarketingListCard = (tool: ToolUiMarketingList) => {
      const style = CARD_STYLES.marketing;
      return (
        <div className={`rounded-2xl border ${style.border} bg-white/90 shadow-[0_20px_45px_-30px_rgba(236,72,153,0.35)] overflow-hidden`}>
          <div className={`flex items-start gap-3 bg-gradient-to-r ${style.header} px-4 py-3 text-white`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{tool.title}</div>
              {tool.description ? <div className="text-xs text-white/80">{tool.description}</div> : null}
            </div>
          </div>
          <div className="space-y-2 p-4">
            {tool.items.length === 0 ? (
              renderEmptyState(tool.emptyState, style)
            ) : (
              tool.items.map((item) => {
                const title = item.title?.trim() || (isTraditional ? '未命名素材' : 'Untitled asset');
                const typeLabel = item.type || (isTraditional ? '行銷素材' : 'Marketing');
                const meta = [typeLabel, item.date].filter(Boolean).join(' · ');
                const content = (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-fuchsia-100 text-fuchsia-700">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
                      <div className="text-xs text-slate-500 truncate">{meta}</div>
                    </div>
                    <Badge className="bg-fuchsia-100 text-fuchsia-700 text-[10px] border border-fuchsia-200">
                      {item.type || (isTraditional ? '素材' : 'Asset')}
                    </Badge>
                  </>
                );
                return item.href ? (
                  <button
                    key={item.id || title}
                    type="button"
                    onClick={() => handleNavigate(item.href!)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={item.id || title}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-2 shadow-sm"
                  >
                    {content}
                  </div>
                );
              })
            )}
          </div>
          {tool.actions?.length ? <div className="px-4 pb-4">{renderActions(tool.actions, style)}</div> : null}
        </div>
      );
    };

    const renderStatsCard = (tool: ToolUiStats | ToolUiMarketplaceStats) => {
      const style = tool.kind === 'marketplace_stats' ? CARD_STYLES.marketplace : CARD_STYLES.stats;
      const Icon = BarChart3;
      return (
        <div className={`rounded-2xl border ${style.border} bg-white/90 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)] overflow-hidden`}>
          <div className={`flex items-start gap-3 bg-gradient-to-r ${style.header} px-4 py-3 text-white`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{tool.title}</div>
              {tool.description ? <div className="text-xs text-white/80">{tool.description}</div> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4">
            {tool.items.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 shadow-sm">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="text-lg font-semibold text-slate-900">{item.value}</div>
                {item.hint ? <div className="text-[10px] text-slate-400">{item.hint}</div> : null}
              </div>
            ))}
          </div>
          {tool.actions?.length ? <div className="px-4 pb-4">{renderActions(tool.actions, style)}</div> : null}
        </div>
      );
    };

    const renderDashboardCard = (tool: ToolUiDashboard) => {
      const style = CARD_STYLES.product;
      return (
        <div className={`rounded-2xl border ${style.border} bg-white/90 shadow-[0_20px_45px_-30px_rgba(16,185,129,0.55)] overflow-hidden`}>
          <div className={`flex items-start gap-3 bg-gradient-to-r ${style.header} px-4 py-3 text-white`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{tool.title}</div>
              {tool.description ? <div className="text-xs text-white/80">{tool.description}</div> : null}
            </div>
          </div>
          <div className="p-4">
            <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs text-slate-500 break-words">
              {tool.url}
            </div>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className={`h-9 rounded-lg text-xs font-semibold ${style.action}`}
                onClick={() => handleNavigate(tool.url)}
              >
                {tool.actionLabel}
              </Button>
            </div>
          </div>
        </div>
      );
    };

    const renderRoleCard = (tool: ToolUiRole) => {
      const style = tool.role === 'market' ? CARD_STYLES.marketplace : CARD_STYLES.product;
      const roleLabel =
        tool.role === 'market'
          ? isTraditional
            ? '市場'
            : 'Market'
          : isTraditional
          ? '賣家'
          : 'Farmer';
      return (
        <div className={`rounded-2xl border ${style.border} bg-white/90 shadow-[0_20px_45px_-30px_rgba(16,185,129,0.55)] overflow-hidden`}>
          <div className={`flex items-start gap-3 bg-gradient-to-r ${style.header} px-4 py-3 text-white`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <UserCheck className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{tool.title}</div>
              {tool.description ? <div className="text-xs text-white/80">{tool.description}</div> : null}
            </div>
          </div>
          <div className="p-4">
            <Badge className={`text-xs border ${style.badge}`}>{roleLabel}</Badge>
            {tool.actions?.length ? <div className="mt-3">{renderActions(tool.actions, style)}</div> : null}
          </div>
        </div>
      );
    };

    switch (card.kind) {
      case 'product_tools':
      case 'store_tools':
      case 'marketing_tools':
      case 'analytics_tools':
      case 'help_options':
        return renderToolkitCard(card);
      case 'product_list':
        return renderProductListCard(card);
      case 'product_created':
      case 'product_updated':
        return renderProductCreatedCard(card);
      case 'store_list':
        return renderStoreListCard(card);
      case 'store_created':
        return renderStoreCreatedCard(card);
      case 'marketing_list':
        return renderMarketingListCard(card);
      case 'stats':
      case 'marketplace_stats':
        return renderStatsCard(card);
      case 'dashboard_link':
        return renderDashboardCard(card);
      case 'role_set':
        return renderRoleCard(card);
      default:
        return null;
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(42rem,calc(100dvh-3rem))] sm:max-h-[calc(100dvh-3rem)] sm:w-[26rem] sm:max-w-[calc(100vw-3rem)]">
          <div
            className="relative h-full max-h-[100dvh] w-full overflow-hidden border-0 bg-white/95 shadow-2xl ring-1 ring-emerald-100 sm:max-h-full sm:rounded-3xl sm:border sm:border-emerald-100"
            style={{ fontFamily: 'Manrope, "Helvetica Neue", sans-serif' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-amber-50" />
            <div className="absolute -top-24 right-4 h-56 w-56 rounded-full bg-emerald-200/50 blur-3xl sm:right-10" />
            <div className="absolute bottom-10 left-2 h-40 w-40 rounded-full bg-sky-200/40 blur-3xl sm:left-6" />

            <div className="relative z-10 flex h-full flex-col px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold tracking-tight text-emerald-950 sm:text-base">
                    {copy.popupTitle}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-emerald-700/80">
                    <Badge variant="secondary">{STATUS_LABELS[langKey][status]}</Badge>
                    <span>{copy.waitingReply}</span>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={closeAssistant}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 flex-1 min-h-0">
                <div className="relative h-full">
                  <div
                    ref={messagesContainerRef}
                    className="h-full overflow-y-auto rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm shadow-inner backdrop-blur"
                  >
                    {messages.length === 0 && (
                      <p className="text-emerald-700/70 text-xs">{copy.waitingReply}</p>
                    )}
                    {messages.map((entry) => {
                      if (entry.kind === 'tool-card') {
                        const card = renderToolCard(entry.card);
                        if (!card) return null;
                        return (
                          <div key={entry.id} className="mb-3 last:mb-0">
                            {card}
                          </div>
                        );
                      }
                      return (
                        <div key={entry.id} className="mb-3 last:mb-0">
                          <span className="font-semibold mr-2 text-emerald-950">
                            {entry.role === 'assistant'
                              ? copy.assistantLabel
                              : entry.role === 'user'
                              ? copy.userLabel
                              : copy.systemLabel}
                          </span>
                          <span className="text-slate-700">{entry.text}</span>
                        </div>
                      );
                    })}
                  </div>
                  {activityState && activityCopy && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-2xl bg-white/70 backdrop-blur-sm" />
                      <div className="relative flex flex-col items-center text-center">
                        <div className="relative h-24 w-24">
                          <div
                            className={`absolute inset-0 rounded-full border ${activityStyles.ring} opacity-80`}
                            style={{ animation: 'spin 6s linear infinite' }}
                          />
                          <div
                            className={`absolute inset-3 rounded-full border ${activityStyles.ring} opacity-70`}
                            style={{ animation: 'spin 3.5s linear infinite reverse' }}
                          />
                          <div className={`absolute inset-6 rounded-full ${activityStyles.core} animate-pulse`} />
                          <div className={`absolute -inset-3 rounded-full ${activityStyles.glow} blur-2xl`} />
                        </div>
                        <div className={`mt-4 text-base font-semibold ${activityStyles.text}`}>
                          {activityCopy.title}
                        </div>
                        <div className={`mt-1 text-xs ${activityStyles.sub}`}>
                          {activityCopy.desc}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex flex-col items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-emerald-800"
                    onClick={() => void handleStartTutorial()}
                    disabled={isBusy}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {copy.startTutorial}
                  </Button>
                  <div className="relative flex items-center justify-center">
                    <div
                      className="absolute h-28 w-28 rounded-full bg-emerald-300/40 blur-2xl transition-transform duration-150 sm:h-24 sm:w-24"
                      style={{
                        opacity: 0.2 + micLevel * 0.6,
                        transform: `scale(${1 + micLevel * 0.7})`,
                      }}
                    />
                    <Button
                      size="icon"
                      variant={isRecording ? 'destructive' : 'outline'}
                      className="relative h-16 w-16 rounded-full border-emerald-200 bg-white/90 text-emerald-800 shadow-xl transition-transform sm:h-14 sm:w-14"
                      style={
                        isRecording
                          ? {
                              boxShadow: `0 0 ${14 + micLevel * 28}px rgba(34, 197, 94, ${
                                0.2 + micLevel * 0.5
                              })`,
                              transform: `scale(${1 + micLevel * 0.1})`,
                            }
                          : undefined
                      }
                      onClick={handleMicClick}
                      title={isRecording ? copy.micStop : copy.micStart}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : isRecording ? (
                        <Square className="h-6 w-6" />
                      ) : (
                        <Mic className="h-6 w-6" />
                      )}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-emerald-800"
                    onClick={() => {
                      setStatus('ready');
                      appendMessage('system', copy.readyMessage);
                    }}
                  >
                    {copy.reconnect}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`fixed right-6 z-[45] transition-opacity duration-200 ${
          isOpen ? 'hidden' : ''
        } ${isLauncherHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{ bottom: launcherBottomOffset }}
        aria-hidden={isLauncherHidden}
      >
        <button
          type="button"
          onPointerDown={() => void openAssistant()}
          onClick={() => void openAssistant()}
          tabIndex={isLauncherHidden ? -1 : 0}
          className={`group flex items-center rounded-full border border-emerald-400/80 bg-emerald-50/95 py-3 shadow-[0_20px_40px_-16px_rgba(16,185,129,0.9)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-[0_28px_50px_-18px_rgba(16,185,129,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            isLauncherMinimized ? 'gap-0 px-3' : 'gap-3 px-4'
          }`}
          aria-label={copy.launcherCaption}
        >
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition group-hover:scale-105">
            {showThinkingRing && (
              <span
                className="absolute inset-0 rounded-full border-2 border-emerald-200/80"
                style={{ animation: 'spin 1.6s linear infinite', borderTopColor: 'transparent' }}
              />
            )}
            {showWave && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex items-end gap-1">
                  <span
                    className="h-2 w-1 rounded-full bg-white/90 animate-pulse"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-3 w-1 rounded-full bg-white/90 animate-pulse"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-2 w-1 rounded-full bg-white/90 animate-pulse"
                    style={{ animationDelay: '300ms' }}
                  />
                </span>
              </span>
            )}
            <Mic className={`h-5 w-5 ${showWave ? 'opacity-80' : ''}`} />
          </span>
          <span className={isLauncherMinimized ? 'sr-only' : 'text-left'}>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600/90">
              {activityCopy?.badge ?? 'Live'}
            </span>
            <span className="block text-sm font-semibold text-emerald-950">
              {copy.launcherCaption}
            </span>
          </span>
        </button>
      </div>
    </>
  );
}
