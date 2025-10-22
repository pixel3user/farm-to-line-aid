import { config as functionsConfig } from 'firebase-functions';

interface RuntimeConfig {
  lineAccessToken?: string;
  lineChannelSecret?: string;
  liffUrl?: string;
  skipLineApi?: boolean;
  useMockLine?: boolean;
  isEmulator?: boolean;
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
  liffUrl: process.env.LIFF_URL || process.env.LINE_LIFF_URL || fnConfig?.line?.liff_url,
  skipLineApi: getBooleanEnv(process.env.SKIP_LINE_API ?? fnConfig?.line?.skip_api, false),
  useMockLine: getBooleanEnv(process.env.USE_MOCK_LINE ?? fnConfig?.line?.use_mock, false),
  isEmulator: getBooleanEnv(process.env.FUNCTIONS_EMULATOR, false) || process.env.NODE_ENV === 'development',
};

export default runtimeConfig;
