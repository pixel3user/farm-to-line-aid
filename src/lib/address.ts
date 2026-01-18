import resolveApiBaseUrl from '@/lib/api';

export type AddressCandidate = {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
};

type AddressLookupResponse = {
  candidates: AddressCandidate[];
  provider: string;
  normalizedQuery: string;
};

export const lookupAddress = async (query: string, limit: number = 5): Promise<AddressLookupResponse> => {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/logistics/address/geocode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to search address.');
  }
  return payload as AddressLookupResponse;
};

export const reverseLookupAddress = async (
  lat: number,
  lng: number,
  limit: number = 5
): Promise<AddressLookupResponse> => {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/logistics/address/reverse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng, limit })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to find nearby address.');
  }
  return payload as AddressLookupResponse;
};

export const resolveYamatoZip = async (address: string) => {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/logistics/yamato/resolve-zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to verify address.');
  }
  return payload as { postNumber: string; yamatoZipCode: string; normalizedAddress?: string };
};
