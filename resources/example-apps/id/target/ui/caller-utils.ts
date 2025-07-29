// Define a custom error type for API errors
export class ApiError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

// Parser for the Result-style responses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseResultResponse<T>(response: any): T {
  if ('Ok' in response && response.Ok !== undefined && response.Ok !== null) {
    return response.Ok as T;
  }

  if ('Err' in response && response.Err !== undefined) {
    throw new ApiError(`API returned an error`, response.Err);
  }

  throw new ApiError('Invalid API response format');
}

/**
 * Generic API request function
 * @param endpoint - API endpoint
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param data - Request data
 * @returns Promise with parsed response data
 * @throws ApiError if the request fails or response contains an error
 */
async function apiRequest<T, R>(endpoint: string, method: string, data: T): Promise<R> {
  const BASE_URL = import.meta.env.BASE_URL || window.location.origin;

  const requestOptions: RequestInit = {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  // Only add body for methods that support it
  if (method !== 'GET' && method !== 'HEAD') {
    requestOptions.body = JSON.stringify(data);
  }

  const result = await fetch(`${BASE_URL}/api`, requestOptions);

  if (!result.ok) {
    throw new ApiError(`HTTP request failed with status: ${result.status}`);
  }

  const jsonResponse = await result.json();
  return parseResultResponse<R>(jsonResponse);
}


// API Interface Definitions

export interface SignRequest {
  Sign: number[]
}

export interface VerifyRequest {
  Verify: [number[], number[]]
}

export type SignResponse = { Ok: number[] } | { Err: string };

export type VerifyResponse = { Ok: boolean } | { Err: string };

// API Function Implementations

/**
 * sign
 * @param message: number[] * @returns Promise with result
 * @throws ApiError if the request fails
 */
export async function sign(message: number[]): Promise<number[]> {
  const data: SignRequest = {
    Sign: message,
  };

  return await apiRequest<SignRequest, number[]>('sign', 'POST', data);
}

/**
 * verify
 * @param message: number[]
 * @param signature: number[] * @returns Promise with result
 * @throws ApiError if the request fails
 */
export async function verify(message: number[], signature: number[]): Promise<boolean> {
  const data: VerifyRequest = {
    Verify: [message, signature],
  };

  return await apiRequest<VerifyRequest, boolean>('verify', 'POST', data);
}

