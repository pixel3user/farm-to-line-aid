import runtimeConfig from './runtimeConfig';

export type YamatoEnvironment = 'test' | 'prod';

export type YamatoIsOk = 'Y' | 'N';

export interface YamatoResponse<TData = unknown> {
  SrvTranId: string;
  IsOK: YamatoIsOk;
  Message: string;
  Data?: TData | null;
}

export interface YamatoConfig {
  customerId?: string;
  customerToken?: string;
  environment: YamatoEnvironment;
  baseUrl: string;
  timeoutMs: number;
  map: {
    b2s: string;
    b2sMobile: string;
    pickup: string;
  };
  pickupAuth?: {
    uid?: string;
    custNo?: string;
    pkey?: string;
  };
}

export interface YamatoServiceResponse<T> {
  status: number;
  ok: boolean;
  data: T;
}

export type YamatoDownloadResult =
  | {
      kind: 'json';
      status: number;
      ok: boolean;
      data: YamatoResponse;
      contentType: string;
    }
  | {
      kind: 'binary';
      status: number;
      ok: boolean;
      data: Buffer;
      contentType: string;
      contentDisposition?: string | null;
    };

export class YamatoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YamatoConfigurationError';
  }
}

const DEFAULTS = {
  baseUrl: {
    test: 'https://egs.suda.com.tw:8443/api/Egs',
    prod: 'https://api.suda.com.tw/api/Egs',
  },
  map: {
    b2s: {
      test: 'http://egs.suda.com.tw:8080/Map.aspx',
      prod: 'https://appservice.ezcat.com.tw/Map.aspx',
    },
    b2sMobile: {
      test: 'http://egs.suda.com.tw:8080/MobileMap.aspx',
      prod: 'https://appservice.ezcat.com.tw/MobileMap.aspx',
    },
    pickup: {
      test: 'http://61.57.232.216/TCAT/CAT0001/CAT0001MM1',
      prod: 'http://103.234.81.15/TCAT/CAT0001/CAT0001MM1',
    },
  },
  timeoutMs: 120000,
} as const;

const resolveEnvironment = (value?: string): YamatoEnvironment => {
  const normalized = (value || '').toLowerCase();
  return normalized === 'prod' || normalized === 'production' ? 'prod' : 'test';
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const isYamatoDebug = () => {
  const value = (process.env.YAMATO_DEBUG || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
};

const maskValue = (value?: string, visible = 4) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= visible) return '*'.repeat(trimmed.length);
  return `${'*'.repeat(trimmed.length - visible)}${trimmed.slice(-visible)}`;
};

const summarizePayload = (payload: Record<string, unknown>) => {
  const summary: Record<string, unknown> = {
    keys: Object.keys(payload).sort(),
  };
  const orders = payload.Orders;
  if (Array.isArray(orders)) {
    summary.orderCount = orders.length;
    summary.orderKeys = orders[0] ? Object.keys(orders[0] as Record<string, unknown>).sort() : [];
  }
  return summary;
};

const logYamatoDebug = (message: string, details: Record<string, unknown>) => {
  if (!isYamatoDebug()) return;
  console.info(`[yamato] ${message}`, details);
};

const getYamatoConfig = (): YamatoConfig => {
  const environment = resolveEnvironment(
    runtimeConfig.yamatoEnvironment || process.env.YAMATO_ENV
  );
  const baseUrl =
    runtimeConfig.yamatoBaseUrl ||
    process.env.YAMATO_BASE_URL ||
    DEFAULTS.baseUrl[environment];
  const timeoutMs =
    parseNumber(runtimeConfig.yamatoTimeoutMs) ||
    parseNumber(process.env.YAMATO_TIMEOUT_MS) ||
    DEFAULTS.timeoutMs;

  const map = {
    b2s:
      runtimeConfig.yamatoB2sMapUrl ||
      process.env.YAMATO_B2S_MAP_URL ||
      DEFAULTS.map.b2s[environment],
    b2sMobile:
      runtimeConfig.yamatoB2sMobileMapUrl ||
      process.env.YAMATO_B2S_MOBILE_MAP_URL ||
      DEFAULTS.map.b2sMobile[environment],
    pickup:
      runtimeConfig.yamatoPickupMapUrl ||
      process.env.YAMATO_PICKUP_MAP_URL ||
      DEFAULTS.map.pickup[environment],
  };

  return {
    customerId: runtimeConfig.yamatoCustomerId || process.env.YAMATO_CUSTOMER_ID,
    customerToken: runtimeConfig.yamatoCustomerToken || process.env.YAMATO_CUSTOMER_TOKEN,
    environment,
    baseUrl,
    timeoutMs,
    map,
    pickupAuth: {
      uid: runtimeConfig.yamatoPickupUid || process.env.YAMATO_PICKUP_UID,
      custNo: runtimeConfig.yamatoPickupCustNo || process.env.YAMATO_PICKUP_CUST_NO,
      pkey: runtimeConfig.yamatoPickupPkey || process.env.YAMATO_PICKUP_PKEY,
    },
  };
};

export const getYamatoConfigSummary = () => {
  const config = getYamatoConfig();
  return {
    environment: config.environment,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    customerId: config.customerId,
    map: config.map,
    pickupAuth: config.pickupAuth,
  };
};

export class YamatoService {
  private static getConfig() {
    return getYamatoConfig();
  }

  private static withAuth(payload: Record<string, unknown>) {
    const config = this.getConfig();
    if (!config.customerId || !config.customerToken) {
      throw new YamatoConfigurationError('Yamato credentials are not configured.');
    }
    return {
      CustomerId: config.customerId,
      CustomerToken: config.customerToken,
      ...payload,
    };
  }

  private static async requestJson<T>(
    serviceName: string,
    payload: Record<string, unknown>
  ): Promise<YamatoServiceResponse<T>> {
    const config = this.getConfig();
    const url = `${config.baseUrl.replace(/\/$/, '')}/${serviceName}`;
    logYamatoDebug('request', {
      service: serviceName,
      url,
      environment: config.environment,
      customerId: maskValue(config.customerId),
      customerIdLength: config.customerId?.length || 0,
      tokenLength: config.customerToken?.length || 0,
      payload: summarizePayload(payload),
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.withAuth(payload)),
        signal: controller.signal,
      });
      const raw = await response.text();
      let json: T;
      try {
        json = JSON.parse(raw) as T;
      } catch {
        throw new Error(`Yamato ${serviceName} returned invalid JSON.`);
      }
      logYamatoDebug('response', {
        service: serviceName,
        status: response.status,
        ok: response.ok,
        isOk: (json as any)?.IsOK,
        message: (json as any)?.Message,
        srvTranId: (json as any)?.SrvTranId,
      });
      return { status: response.status, ok: response.ok, data: json };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async downloadOBT(payload: Record<string, unknown>): Promise<YamatoDownloadResult> {
    const config = this.getConfig();
    const url = `${config.baseUrl.replace(/\/$/, '')}/DownloadOBT`;
    logYamatoDebug('request', {
      service: 'DownloadOBT',
      url,
      environment: config.environment,
      customerId: maskValue(config.customerId),
      customerIdLength: config.customerId?.length || 0,
      tokenLength: config.customerToken?.length || 0,
      payload: summarizePayload(payload),
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.withAuth(payload)),
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition');
      if (contentType.includes('application/json')) {
        const data = (await response.json()) as YamatoResponse;
        logYamatoDebug('response', {
          service: 'DownloadOBT',
          status: response.status,
          ok: response.ok,
          isOk: data?.IsOK,
          message: data?.Message,
          srvTranId: data?.SrvTranId,
        });
        return {
          kind: 'json',
          status: response.status,
          ok: response.ok,
          data,
          contentType,
        };
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      logYamatoDebug('response', {
        service: 'DownloadOBT',
        status: response.status,
        ok: response.ok,
        contentType,
        size: buffer.length,
        contentDisposition: contentDisposition || undefined,
      });
      return {
        kind: 'binary',
        status: response.status,
        ok: response.ok,
        data: buffer,
        contentType,
        contentDisposition,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static parseAddress(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('ParsingAddress', payload);
  }

  static printOBT(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('PrintOBT', payload);
  }

  static printOBTByPickingList(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('PrintOBTByPickingList', payload);
  }

  static printOBTByB2S(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('PrintOBTByB2S', payload);
  }

  static callPickup(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('Call', payload);
  }

  static reserveAdd(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('ReserveAdd', payload);
  }

  static reserveEdit(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('ReserveEdit', payload);
  }

  static reserveDelete(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('ReserveDelete', payload);
  }

  static reserveQuery(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('ReserveQuery', payload);
  }

  static obtStatus(payload: Record<string, unknown>) {
    return this.requestJson<YamatoResponse>('OBTStatus', payload);
  }
}

export const extractYamatoZipCode = (postNumber: string | undefined | null) => {
  if (!postNumber) return '';
  const compact = String(postNumber).replace(/[^0-9A-Za-z]/g, '');
  return compact.slice(-6);
};
