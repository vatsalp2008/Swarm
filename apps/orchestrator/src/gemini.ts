import { GoogleGenAI } from '@google/genai';
import { logger } from './logger.js';

/**
 * Gemini SDK wrapper.
 *
 * Model selection (Phase 0):
 *   - GEMINI_MODEL_FAST  (default 'gemini-2.0-flash')  — Bees + Critic
 *   - GEMINI_MODEL_REASONING (default 'gemini-2.0-pro') — Queen classification
 *
 * The wrapper is intentionally thin. We don't add retries or backoff here —
 * that belongs in a higher layer (LangGraph node) so failure modes are
 * visible in the trace, not hidden in this client.
 */

let cached: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required.');
  }
  cached = new GoogleGenAI({ apiKey });
  return cached;
}

export const FAST_MODEL = process.env.GEMINI_MODEL_FAST ?? 'gemini-2.0-flash';
export const REASONING_MODEL = process.env.GEMINI_MODEL_REASONING ?? 'gemini-2.0-pro';

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  /** JSON schema (Gemini's responseSchema format) for structured output. */
  responseSchema?: unknown;
  /** Optional trace id forwarded to logs for correlation. */
  traceId?: string;
}

/** Generate plain text. Throws on API error; caller catches. */
export async function generateText(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<string> {
  const model = opts.model ?? FAST_MODEL;
  logger.debug({ model, traceId: opts.traceId }, 'gemini generate');
  const result = await client().models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: opts.temperature ?? 0.2,
    },
  });
  return result.text ?? '';
}

/**
 * Generate structured JSON output. Returns parsed JSON.
 * Caller is responsible for zod-validating the shape.
 */
export async function generateJSON<T = unknown>(
  prompt: string,
  responseSchema: unknown,
  opts: GenerateOptions = {},
): Promise<T> {
  const model = opts.model ?? FAST_MODEL;
  logger.debug({ model, traceId: opts.traceId }, 'gemini generate (json)');
  const result = await client().models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: opts.temperature ?? 0.1,
      responseMimeType: 'application/json',
      responseSchema,
    },
  });
  const text = result.text ?? '{}';
  return JSON.parse(text) as T;
}
