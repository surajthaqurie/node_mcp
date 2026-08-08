/**
 * @file token-estimator.util.ts
 * @description Lightweight per-session token estimation and usage tracking utilities.
 *
 * WHY THIS EXISTS:
 * Local Ollama models don't report token counts in their responses. This utility provides
 * a fast character-count-based approximation (~4 chars per token) for tracking session
 * usage, enforcing optional token quotas, and including usage metadata in chat responses.
 *
 * The tracker is an in-process Map — suitable for single-instance deployments.
 * For multi-instance deployments, swap it for a Redis-backed store.
 */

export interface TokenUsageState {
  /** Estimated tokens consumed by user input messages in this session */
  inputTokens: number;

  /** Estimated tokens consumed by AI output messages in this session */
  outputTokens: number;

  /** Total estimated tokens consumed in this session */
  totalTokens: number;
}

export interface UsageSummary {
  /** Current session usage breakdown */
  usage: TokenUsageState;

  /** Configured max token limit for the session */
  limit: number;

  /** Remaining token budget (clamped to 0) */
  remaining: number;
}

/**
 * In-process map storing accumulated token usage per session key (userId or 'default').
 * Exported so it can be cleared in tests or monitoring endpoints.
 */
export const usageTracker = new Map<string, TokenUsageState>();

/**
 * Estimates token count from a text string.
 * Approximation: 1 token ≈ 4 characters.
 *
 * @param text  Any string (prompt, response, etc.)
 * @returns     Estimated token count (minimum 1).
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Returns the configured session token limit.
 * Reads `CHAT_TOKEN_LIMIT` env var; defaults to 20,000 if absent or invalid.
 */
export function getTokenLimit(): number {
  const configured = Number(process.env.CHAT_TOKEN_LIMIT ?? '20000');
  return Number.isFinite(configured) && configured > 0 ? configured : 20_000;
}

/**
 * Checks whether a new message would push the session over its token quota.
 *
 * @param sessionKey  Unique session identifier (userId, IP, etc.).
 * @param inputText   The incoming user message.
 * @returns           Error message string if over limit, or null if within budget.
 */
export function checkTokenLimit(
  sessionKey: string,
  inputText: string,
): string | null {
  const limit = getTokenLimit();
  const current = usageTracker.get(sessionKey) ?? {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  const projected = current.totalTokens + estimateTokens(inputText);

  if (projected > limit) {
    return `Token limit reached (${projected}/${limit}). Usage resets when the process restarts.`;
  }

  return null;
}

/**
 * Records token usage for the completed chat turn and returns a full usage summary.
 *
 * @param sessionKey  Unique session identifier.
 * @param inputText   User's prompt text.
 * @param outputText  AI's response text.
 * @returns           UsageSummary with updated totals, limit, and remaining budget.
 */
export function trackUsage(
  sessionKey: string,
  inputText: string,
  outputText: string,
): UsageSummary {
  const limit = getTokenLimit();
  const prev = usageTracker.get(sessionKey) ?? {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  const addedInput = estimateTokens(inputText);
  const addedOutput = estimateTokens(outputText);

  const next: TokenUsageState = {
    inputTokens: prev.inputTokens + addedInput,
    outputTokens: prev.outputTokens + addedOutput,
    totalTokens: prev.totalTokens + addedInput + addedOutput,
  };

  usageTracker.set(sessionKey, next);

  return {
    usage: next,
    limit,
    remaining: Math.max(0, limit - next.totalTokens),
  };
}

/**
 * Resets the token usage counter for a specific session key.
 * Useful for testing or explicit user-triggered resets.
 *
 * @param sessionKey  Session to reset.
 */
export function resetUsage(sessionKey: string): void {
  usageTracker.delete(sessionKey);
}
