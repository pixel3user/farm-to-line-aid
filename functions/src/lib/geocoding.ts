import runtimeConfig from './runtimeConfig';

export type GeocodingProvider = 'google' | 'nominatim';

export interface GeocodeCandidate {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface GeocodeResult {
  provider: GeocodingProvider;
  normalizedQuery: string;
  candidates: GeocodeCandidate[];
}

type GeocodingConfig = {
  provider: GeocodingProvider;
  apiKey?: string;
  baseUrl: string;
};

const DEFAULTS = {
  provider: 'google' as GeocodingProvider,
  baseUrl: {
    google: 'https://maps.googleapis.com/maps/api/geocode/json',
    nominatim: 'https://nominatim.openstreetmap.org',
  },
};

const SIMPLE_TRADITIONAL_MAP: Record<string, string> = {
  台: '臺',
  区: '區',
  县: '縣',
  乡: '鄉',
  镇: '鎮',
  庄: '莊',
  爱: '愛',
  号: '號',
  楼: '樓',
  东: '東',
  西: '西',
  南: '南',
  北: '北',
  广: '廣',
  国: '國',
  湾: '灣',
  龙: '龍',
  凤: '鳳',
  乐: '樂',
  丰: '豐',
  运: '運',
  历: '歷',
  后: '後',
  内: '內',
  关: '關',
  发: '發',
  门: '門',
  馆: '館',
};

const toHalfWidthDigits = (value: string) =>
  value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));

const toTraditional = (value: string) =>
  value
    .split('')
    .map((char) => SIMPLE_TRADITIONAL_MAP[char] || char)
    .join('');

export const normalizeTaiwanAddress = (value: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  const digits = toHalfWidthDigits(trimmed);
  const standardized = digits.replace(/[‐‑–—－]/g, '-').replace(/\s+/g, '');
  return toTraditional(standardized);
};

const getGeocodingConfig = (): GeocodingConfig => {
  const providerValue =
    (runtimeConfig.geocodingProvider || process.env.GEOCODING_PROVIDER || DEFAULTS.provider).toLowerCase();
  const provider = providerValue === 'nominatim' ? 'nominatim' : 'google';
  const baseUrl =
    runtimeConfig.geocodingBaseUrl ||
    process.env.GEOCODING_BASE_URL ||
    DEFAULTS.baseUrl[provider];
  const apiKey =
    runtimeConfig.geocodingApiKey ||
    process.env.GEOCODING_API_KEY ||
    undefined;
  return {
    provider,
    baseUrl,
    apiKey,
  };
};

const parseGoogleCandidates = (payload: any, limit: number): GeocodeCandidate[] => {
  if (!payload || payload.status !== 'OK' || !Array.isArray(payload.results)) {
    return [];
  }
  return payload.results.slice(0, limit).map((result: any) => ({
    address: normalizeTaiwanAddress(result.formatted_address || ''),
    lat: result.geometry?.location?.lat,
    lng: result.geometry?.location?.lng,
    placeId: result.place_id,
  }));
};

const parseNominatimCandidates = (payload: any, limit: number): GeocodeCandidate[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.slice(0, limit).map((result: any) => ({
    address: normalizeTaiwanAddress(result.display_name || ''),
    lat: Number(result.lat),
    lng: Number(result.lon),
  }));
};

export const geocodeAddress = async (query: string, limit: number = 5): Promise<GeocodeResult> => {
  const config = getGeocodingConfig();
  const normalizedQuery = normalizeTaiwanAddress(query);
  if (!normalizedQuery) {
    return { provider: config.provider, normalizedQuery: '', candidates: [] };
  }

  if (config.provider === 'google') {
    if (!config.apiKey) {
      throw new Error('Geocoding API key is not configured.');
    }
    const url = new URL(config.baseUrl);
    url.searchParams.set('address', normalizedQuery);
    url.searchParams.set('key', config.apiKey);
    url.searchParams.set('language', 'zh-TW');
    url.searchParams.set('region', 'tw');
    url.searchParams.set('components', 'country:TW');
    const response = await fetch(url.toString());
    const data = await response.json();
    const candidates = parseGoogleCandidates(data, limit);
    return { provider: config.provider, normalizedQuery, candidates };
  }

  const url = new URL(`${config.baseUrl.replace(/\/$/, '')}/search`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('countrycodes', 'tw');
  url.searchParams.set('accept-language', 'zh-TW');
  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Farm2Market/1.0 (geocoding)',
    },
  });
  const data = await response.json();
  const candidates = parseNominatimCandidates(data, limit);
  return { provider: config.provider, normalizedQuery, candidates };
};

export const reverseGeocode = async (
  lat: number,
  lng: number,
  limit: number = 5
): Promise<GeocodeResult> => {
  const config = getGeocodingConfig();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { provider: config.provider, normalizedQuery: '', candidates: [] };
  }

  if (config.provider === 'google') {
    if (!config.apiKey) {
      throw new Error('Geocoding API key is not configured.');
    }
    const url = new URL(config.baseUrl);
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', config.apiKey);
    url.searchParams.set('language', 'zh-TW');
    url.searchParams.set('region', 'tw');
    const response = await fetch(url.toString());
    const data = await response.json();
    const candidates = parseGoogleCandidates(data, limit);
    return { provider: config.provider, normalizedQuery: `${lat},${lng}`, candidates };
  }

  const url = new URL(`${config.baseUrl.replace(/\/$/, '')}/reverse`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('accept-language', 'zh-TW');
  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Farm2Market/1.0 (geocoding)',
    },
  });
  const data = await response.json();
  const candidates = parseNominatimCandidates(data ? [data] : [], limit);
  return { provider: config.provider, normalizedQuery: `${lat},${lng}`, candidates };
};
