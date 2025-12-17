import runtimeConfig from './runtimeConfig';

const LINE_PAY_BASE_URL = runtimeConfig.linePaySandbox
  ? 'https://sandbox-api-pay.line.me'
  : 'https://api-pay.line.me';

export interface LinePayProduct {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  productId?: string;
}

export interface LinePayPackage {
  id: string;
  amount: number;
  userFee?: number;
  products: LinePayProduct[];
}

export interface LinePayRedirectUrls {
  confirmUrl: string;
  cancelUrl: string;
}

export interface LinePayReservePayload {
  amount: number;
  currency: string;
  orderId: string;
  packages: LinePayPackage[];
  redirectUrls: LinePayRedirectUrls;
  options?: Record<string, unknown>;
}

export interface LinePayReserveResponse {
  returnCode: string;
  returnMessage: string;
  info?: {
    transactionId?: string;
    paymentUrl?: {
      web?: string;
      app?: string;
    };
    paymentAccessToken?: string;
  };
}

export interface LinePayConfirmResponse {
  returnCode: string;
  returnMessage: string;
  info?: Record<string, unknown>;
}

export class LinePayConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinePayConfigurationError';
  }
}

export class LinePayService {
  private static getHeaders() {
    if (!runtimeConfig.linePayChannelId || !runtimeConfig.linePayChannelSecret) {
      throw new LinePayConfigurationError('LINE Pay credentials are not configured.');
    }

    return {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': runtimeConfig.linePayChannelId,
      'X-LINE-ChannelSecret': runtimeConfig.linePayChannelSecret,
    };
  }

  static async reservePayment(payload: LinePayReservePayload): Promise<LinePayReserveResponse> {
    const headers = this.getHeaders();
    const response = await fetch(`${LINE_PAY_BASE_URL}/v3/payments/request`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    let json: LinePayReserveResponse;
    try {
      json = (await response.json()) as LinePayReserveResponse;
    } catch {
      throw new Error('LINE Pay reserve request failed with invalid response body.');
    }

    if (!response.ok || json.returnCode !== '0000') {
      throw new Error(`LINE Pay reserve request failed: ${json.returnMessage || response.statusText}`);
    }

    return json;
  }

  static async confirmPayment(
    transactionId: string,
    amount: number,
    currency: string
  ): Promise<LinePayConfirmResponse> {
    if (!transactionId) {
      throw new Error('transactionId is required to confirm a LINE Pay payment.');
    }

    const headers = this.getHeaders();
    const response = await fetch(`${LINE_PAY_BASE_URL}/v3/payments/${transactionId}/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount, currency }),
    });

    let json: LinePayConfirmResponse;
    try {
      json = (await response.json()) as LinePayConfirmResponse;
    } catch {
      throw new Error('LINE Pay confirm request failed with invalid response body.');
    }

    if (!response.ok || json.returnCode !== '0000') {
      throw new Error(`LINE Pay confirm request failed: ${json.returnMessage || response.statusText}`);
    }

    return json;
  }
}

export default LinePayService;


