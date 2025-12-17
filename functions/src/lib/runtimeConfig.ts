import { config as functionsConfig } from 'firebase-functions';

interface RuntimeConfig {
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

const runtimeConfig: RuntimeConfig = {
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
};

export default runtimeConfig;
