/**
 * Proxy SSE Stream Transformer
 *
 * Previously translated OpenAI-compatible responses into Anthropic format.
 * Now performs a direct passthrough since the proxy speaks native OpenAI.
 * Only error-response formatting is retained.
 */

type ResponseHeaders = Headers | Record<string, string> | Array<[string, string]>;

interface AnthropicErrorPayload {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

function createAnthropicErrorPayload(type: string, message: string): AnthropicErrorPayload {
  return {
    type: 'error',
    error: {
      type,
      message,
    },
  };
}

function formatErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function logProxyError(context: string, error: unknown): void {
  console.error(`[proxy-sse-transformer] ${context}: ${formatErrorForLog(error)}`);
}

export function createAnthropicErrorResponse(
  status: number,
  type: string,
  message: string,
  headers?: ResponseHeaders
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json');
  responseHeaders.delete('Content-Length');

  return new Response(JSON.stringify(createAnthropicErrorPayload(type, message)), {
    status,
    headers: responseHeaders,
  });
}

async function createAnthropicErrorProxyResponse(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.delete('Content-Type');
  headers.delete('Content-Length');

  let type =
    response.status === 401
      ? 'authentication_error'
      : response.status === 429
        ? 'rate_limit_error'
        : response.status >= 400 && response.status < 500
          ? 'invalid_request_error'
          : 'api_error';
  let message = `Upstream request failed with status ${response.status}`;

  try {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as {
        error?: { type?: string; message?: string };
        message?: string;
      };

      if (typeof payload?.error?.type === 'string' && payload.error.type.trim().length > 0) {
        type = payload.error.type;
      }

      if (typeof payload?.error?.message === 'string' && payload.error.message.trim().length > 0) {
        message = payload.error.message;
      } else if (typeof payload?.message === 'string' && payload.message.trim().length > 0) {
        message = payload.message;
      }
    } else {
      const text = (await response.text()).trim();
      if (text.length > 0) {
        message = text;
      }
    }
  } catch (error) {
    logProxyError('Failed to parse upstream error response', error);
  }

  return createAnthropicErrorResponse(response.status, type, message, headers);
}

/**
 * Passthrough the upstream response directly without format translation.
 * Only non-OK responses get enriched with Anthropic-style error payloads.
 */
export async function createAnthropicProxyResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    return createAnthropicErrorProxyResponse(response);
  }

  // Direct passthrough — no OpenAI-to-Anthropic translation needed
  return response;
}

export class ProxySseStreamTransformer {
  async transform(response: Response): Promise<Response> {
    return createAnthropicProxyResponse(response);
  }

  error(status: number, type: string, message: string): Response {
    return createAnthropicErrorResponse(status, type, message);
  }
}
