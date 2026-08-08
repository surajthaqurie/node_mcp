/**
 * @file intent-parser.util.ts
 * @description Pure utility functions for natural language intent parsing and parameter extraction.
 *
 * WHY THIS EXISTS:
 * Handles fallback intent detection (creation, queries, pagination, confirmation) and parameter
 * extraction for smaller LLMs or direct keyword fallback without cluttering OllamaService.
 */

export interface ExtractedIntent {
  toolName?: string;
  args: Record<string, unknown>;
  isCreation: boolean;
  isConfirm: boolean;
  isNext: boolean;
  isPrev: boolean;
}

/**
 * Detects if the prompt represents a creation/mutation intent.
 */
export function isCreationIntent(lower: string): boolean {
  return /(?:create|craeat|reate|creat|add|new|make|register|insert)\b/i.test(
    lower,
  );
}

/**
 * Detects if the prompt represents a confirmation intent (including common typos).
 */
export function isConfirmationIntent(lower: string): boolean {
  return /(?:confirm|coform|cnfirm|confim|yes|proceed|ok|accept|go ahead)\b/i.test(
    lower,
  );
}

/**
 * Extracts user attributes (email, password, firstName, lastName) from natural language prompt.
 */
export function extractUserParams(
  message: string,
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const res = { ...existing };
  const lower = message.toLowerCase();

  // 1. Email extraction
  const emailMatch = message.match(
    /(?:email|email is|email:)\s*[:=]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/i,
  );
  if (emailMatch && emailMatch[1]) {
    res.email = emailMatch[1].trim();
  } else {
    const plainEmailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/);
    if (plainEmailMatch && plainEmailMatch[1]) {
      res.email = plainEmailMatch[1].trim();
    }
  }

  // 2. Password extraction
  const passMatch = message.match(
    /(?:password|pass|password is|password:)\s*[:=]?\s*([^\s,;]+)/i,
  );
  if (passMatch && passMatch[1]) {
    res.password = passMatch[1].trim();
  }

  // 3. First Name and Last Name extraction
  const fnMatch = message.match(
    /(?:first\s*name|firstname)\s*(?:is|=|:)?\s*([a-zA-Z0-9_.-]+)/i,
  );
  if (fnMatch && fnMatch[1]) {
    res.firstName = fnMatch[1].trim();
  }

  const lnMatch = message.match(
    /(?:last\s*name|lastname)\s*(?:is|=|:)?\s*([a-zA-Z0-9_.-]+)/i,
  );
  if (lnMatch && lnMatch[1]) {
    res.lastName = lnMatch[1].trim();
  }

  // Handle "X Y is the last and first name" or "X and Y is the last and first name"
  const combinedNameMatch = message.match(
    /([a-zA-Z0-9_.-]+)\s+(?:and\s+)?([a-zA-Z0-9_.-]+)\s+is\s+the\s+(?:last\s+and\s+first|first\s+and\s+last)\s+name/i,
  );
  if (combinedNameMatch) {
    const part1 = combinedNameMatch[1].trim();
    const part2 = combinedNameMatch[2].trim();
    if (lower.includes('last and first')) {
      res.lastName = part1;
      res.firstName = part2;
    } else {
      res.firstName = part1;
      res.lastName = part2;
    }
  }

  return res;
}

/**
 * Extracts task attributes (title, description) from natural language prompt.
 */
export function extractTaskParams(
  message: string,
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const res = { ...existing };
  const titleMatch = message.match(
    /(?:task|tasks)\s+(?:titled|named|title|called|with title)?\s*["']?([^"'\n]+)["']?/i,
  );
  if (titleMatch && titleMatch[1]) {
    const candidate = titleMatch[1]
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/\s+(?:confirm|coform|yes|please)$/i, '')
      .trim();
    if (
      candidate &&
      !['a', 'the', 'new', 'create', 'craeat', 'reate', 'task'].includes(
        candidate.toLowerCase(),
      )
    ) {
      res.title = candidate;
    }
  }
  return res;
}

/**
 * Extracts search query term from natural language list/search requests.
 * E.g., "give the task name ollama", "list tasks named staging", "search user john"
 */
export function extractSearchQuery(message: string): string | null {
  const lower = message.toLowerCase();
  const searchMatch = lower.match(
    /(?:name is|named|name|called|with name|titled|title|search|for|is)\s+([a-zA-Z0-9_.-]+)/i,
  );
  if (searchMatch && searchMatch[1]) {
    const term = searchMatch[1].trim().toLowerCase();
    if (
      ![
        'page',
        'users',
        'user',
        'tasks',
        'task',
        'comments',
        'comment',
        'the',
        'of',
        'view',
        'show',
        'give',
        'list',
        'get',
      ].includes(term)
    ) {
      return searchMatch[1].trim();
    }
  }
  return null;
}
