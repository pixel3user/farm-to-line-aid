import { config as functionsConfig } from 'firebase-functions';

interface RuntimeConfig {
  lineChannelId?: string;
  lineLoginChannelId?: string;
  lineAccessToken?: string;
  lineChannelSecret?: string;
  lineLoginChannelSecret?: string;
  liffUrl?: string;
  richMenuOnboardingId?: string;
  richMenuFarmerId?: string;
  richMenuMarketId?: string;
  skipLineApi?: boolean;
  useMockLine?: boolean;
  isEmulator?: boolean;
  linePayChannelId?: string;
  linePayChannelSecret?: string;
  linePaySandbox?: boolean;
  frontendBaseUrl?: string;
  apiBaseUrl?: string;
  yamatoCustomerId?: string;
  yamatoCustomerToken?: string;
  yamatoEnvironment?: string;
  yamatoBaseUrl?: string;
  yamatoTimeoutMs?: number;
  yamatoB2sMapUrl?: string;
  yamatoB2sMobileMapUrl?: string;
  yamatoPickupMapUrl?: string;
  yamatoPickupUid?: string;
  yamatoPickupCustNo?: string;
  yamatoPickupPkey?: string;
  geocodingProvider?: string;
  geocodingApiKey?: string;
  geocodingBaseUrl?: string;
}

function readFunctionsConfig(): Record<string, any> {
  try {
    return functionsConfig();
  } catch (error) {
    console.warn('[runtimeConfig] firebase-functions config unavailable, falling back to process.env');
    return {};
  }
}

const fnConfig = readFunctionsConfig();

function getBooleanEnv(value: unknown, fallback: boolean = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalised)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalised)) {
      return false;
    }
  }
  return fallback;
}

function getNumberEnv(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

const runtimeConfig: RuntimeConfig = {
  lineChannelId:
    process.env.LINE_CHANNEL_ID ||
    fnConfig?.line?.channel_id,
  lineLoginChannelId:
    process.env.LINE_LOGIN_CHANNEL_ID ||
    process.env.LINE_LIFF_CHANNEL_ID ||
    fnConfig?.line?.login_channel_id ||
    fnConfig?.line?.liff_channel_id,
  lineAccessToken:
    process.env.LINE_CHANNEL_ACCESS_TOKEN ||
    process.env.CHANNEL_ACCESS_TOKEN ||
    fnConfig?.line?.channel_access_token ||
    fnConfig?.line?.access_token,
  lineChannelSecret:
    process.env.LINE_CHANNEL_SECRET ||
    process.env.CHANNEL_SECRET ||
    fnConfig?.line?.channel_secret,
  lineLoginChannelSecret:
    process.env.LINE_LOGIN_CHANNEL_SECRET ||
    process.env.LOGIN_CHANNEL_SECRET ||
    fnConfig?.line?.login_channel_secret,
  richMenuOnboardingId:
    process.env.LINE_RICHMENU_ONBOARDING_ID ||
    fnConfig?.line?.richmenu_onboarding_id,
  richMenuFarmerId:
    process.env.LINE_RICHMENU_FARMER_ID ||
    fnConfig?.line?.richmenu_farmer_id,
  richMenuMarketId:
    process.env.LINE_RICHMENU_MARKET_ID ||
    fnConfig?.line?.richmenu_market_id,
  liffUrl: process.env.LIFF_URL || process.env.LINE_LIFF_URL || fnConfig?.line?.liff_url,
  skipLineApi: getBooleanEnv(process.env.SKIP_LINE_API ?? fnConfig?.line?.skip_api, false),
  useMockLine: getBooleanEnv(process.env.USE_MOCK_LINE ?? fnConfig?.line?.use_mock, false),
  isEmulator: getBooleanEnv(process.env.FUNCTIONS_EMULATOR, false) || process.env.NODE_ENV === 'development',
  linePayChannelId:
    process.env.LINE_PAY_CHANNEL_ID ||
    fnConfig?.linepay?.channel_id,
  linePayChannelSecret:
    process.env.LINE_PAY_CHANNEL_SECRET ||
    fnConfig?.linepay?.channel_secret,
  linePaySandbox: getBooleanEnv(process.env.LINE_PAY_SANDBOX ?? fnConfig?.linepay?.sandbox, true),
  frontendBaseUrl:
    process.env.FRONTEND_BASE_URL ||
    process.env.APP_BASE_URL ||
    fnConfig?.app?.frontend_url,
  apiBaseUrl:
    process.env.API_BASE_URL ||
    fnConfig?.app?.api_base_url,
  yamatoCustomerId:
    process.env.YAMATO_CUSTOMER_ID ||
    fnConfig?.yamato?.customer_id,
  yamatoCustomerToken:
    process.env.YAMATO_CUSTOMER_TOKEN ||
    fnConfig?.yamato?.customer_token,
  yamatoEnvironment:
    process.env.YAMATO_ENV ||
    fnConfig?.yamato?.environment,
  yamatoBaseUrl:
    process.env.YAMATO_BASE_URL ||
    fnConfig?.yamato?.base_url,
  yamatoTimeoutMs:
    getNumberEnv(process.env.YAMATO_TIMEOUT_MS) ||
    getNumberEnv(fnConfig?.yamato?.timeout_ms),
  yamatoB2sMapUrl:
    process.env.YAMATO_B2S_MAP_URL ||
    fnConfig?.yamato?.b2s_map_url,
  yamatoB2sMobileMapUrl:
    process.env.YAMATO_B2S_MOBILE_MAP_URL ||
    fnConfig?.yamato?.b2s_mobile_map_url,
  yamatoPickupMapUrl:
    process.env.YAMATO_PICKUP_MAP_URL ||
    fnConfig?.yamato?.pickup_map_url,
  yamatoPickupUid:
    process.env.YAMATO_PICKUP_UID ||
    fnConfig?.yamato?.pickup_uid,
  yamatoPickupCustNo:
    process.env.YAMATO_PICKUP_CUST_NO ||
    fnConfig?.yamato?.pickup_cust_no,
  yamatoPickupPkey:
    process.env.YAMATO_PICKUP_PKEY ||
    fnConfig?.yamato?.pickup_pkey,
  geocodingProvider:
    process.env.GEOCODING_PROVIDER ||
    fnConfig?.geocoding?.provider,
  geocodingApiKey:
    process.env.GEOCODING_API_KEY ||
    fnConfig?.geocoding?.api_key,
  geocodingBaseUrl:
    process.env.GEOCODING_BASE_URL ||
    fnConfig?.geocoding?.base_url,
};

export default runtimeConfig;
