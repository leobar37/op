import { describe, expect, it } from 'bun:test';
import { createAnthropicProxyResponse } from '../../../../src/proxy/transformers/sse-stream-transformer';

describe('proxy SSE stream transformer', () => {
  it('passes through OpenAI JSON responses unchanged', async () => {
    const originalBody = {
      id: 'chatcmpl_1',
      model: 'claude-sonnet-4.5',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Here is the result.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
    };

    const response = new Response(JSON.stringify(originalBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const transformed = await createAnthropicProxyResponse(response);
    const body = (await transformed.json()) as typeof originalBody;

    expect(body.id).toBe(originalBody.id);
    expect(body.model).toBe(originalBody.model);
    expect(body.choices[0].message.content).toBe('Here is the result.');
    expect(body.usage.prompt_tokens).toBe(12);
  });

  it('passes through OpenAI SSE streams unchanged', async () => {
    const openAISse = [
      'data: {"id":"chatcmpl_2","object":"chat.completion.chunk","created":1,"model":"claude-sonnet-4.5","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]\n\n',
      'data: {"id":"chatcmpl_2","object":"chat.completion.chunk","created":1,"model":"claude-sonnet-4.5","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const transformed = await createAnthropicProxyResponse(
      new Response(openAISse, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const body = await transformed.text();
    expect(body).toContain('data:');
    expect(body).toContain('[DONE]');
    expect(body).toContain('chatcmpl_2');
  });

  it('converts upstream error responses into Anthropic-style error payloads', async () => {
    const response = new Response(
      JSON.stringify({ error: { type: 'rate_limit_error', message: 'Too many requests' } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );

    const transformed = await createAnthropicProxyResponse(response);
    const body = (await transformed.json()) as { type: string; error: { type: string; message: string } };

    expect(transformed.status).toBe(429);
    expect(body.type).toBe('error');
    expect(body.error.type).toBe('rate_limit_error');
    expect(body.error.message).toBe('Too many requests');
  });
});
