/**
 * @file token-estimator.util.ts
 * @description Standalone token usage estimation and session token tracking utilities.
 * 
 * WHY THIS UTILITY EXISTS:
 * AI token usage can incur memory overhead or API rate limits.
 * This standalone utility tracks token consumption per user session, enforces configurable token limits via environment variables,
 * and provides usage summaries to be returned in chat responses.
 */

export interface TokenUsageState {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface UsageSummaryResult {
  usage: TokenUsageState;
  limit: number;
  remaining: number;
}

/**
 * In-memory map storing accumulated token consumption indexed by session key (e.g. userId or 'default').
 */
export const usageTracker = new Map<string, TokenUsageState>();

/**
 * Estimates token count from raw string input.
 * 
 * WHY:
 * Provides a fast lightweight approximation (approx. 4 characters per token) without heavy tokenizer dependencies.
 * 
 * @param text Input or output text string.
 * @returns Estimated number of tokens (minimum 1).
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Retrieves configured max token limit from environment variable `CHAT_TOKEN_LIMIT`.
 * 
 * WHY:
 * Allows dynamic configuration of per-session token limits without hardcoding values in code.
 * Defaults to 20,000 tokens if undefined or invalid.
 * 
 * @returns Configured numeric token limit.
 */
export function getUsageLimit(): number {
  const configuredLimit = Number(process.env.CHAT_TOKEN_LIMIT || "20000");
  return Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : 20000;
}

/**
 * Checks whether user session will exceed allowed token quota with incoming prompt message.
 * 
 * WHY:
 * Prevents execution of AI requests if user has exceeded their token quota.
 * 
 * @param sessionKey Unique session identifier (e.g. User ID or IP/Guest key).
 * @param inputText Incoming user prompt text.
 * @returns Error string message if limit reached, or null if within limits.
 */
export function checkUsageLimit(sessionKey: string, inputText: string): string | null {
  const limit = getUsageLimit();
  const usageState = usageTracker.get(sessionKey) || {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  const projectedTotal = usageState.totalTokens + estimateTokens(inputText);

  if (projectedTotal > limit) {
    return `Usage limit reached. Estimated usage: ${projectedTotal}/${limit} tokens.`;
  }

  return null;
}

/**
 * Updates session token tracker and generates usage breakdown summary.
 * 
 * WHY:
 * Calculates cumulative usage (input + output tokens) and remaining quota for current chat interaction.
 * 
 * @param sessionKey Session identifier string.
 * @param inputText User input prompt.
 * @param outputText AI generated output response.
 * @returns Usage breakdown containing cumulative usage stats, max limit, and remaining tokens.
 */
export function getUsageSummary(
  sessionKey: string,
  inputText: string,
  outputText: string,
): UsageSummaryResult {
  const limit = getUsageLimit();
  const usageState = usageTracker.get(sessionKey) || {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  const totalTokens = usageState.totalTokens + inputTokens + outputTokens;

  const nextUsage = {
    inputTokens: usageState.inputTokens + inputTokens,
    outputTokens: usageState.outputTokens + outputTokens,
    totalTokens,
  };

  usageTracker.set(sessionKey, nextUsage);

  return {
    usage: nextUsage,
    limit,
    remaining: Math.max(0, limit - nextUsage.totalTokens),
  };
}
