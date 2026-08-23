/**
 * callClaude() — shared wrapper for every TenderAI pipeline stage (docs/
 * ai-agent-architecture.md's "Provider" section). Each stage calls this with
 * its own system prompt + a single structured-output tool schema; Claude is
 * forced to respond via that one tool so the result is always parseable JSON,
 * never free-form prose.
 */
export interface ClaudeToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CallClaudeResult {
  input: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
}

export async function callClaude(opts: {
  apiKey: string;
  system: string;
  userMessage: string;
  tool: ClaudeToolSchema;
  maxTokens?: number;
  model?: string;
}): Promise<CallClaudeResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model ?? "claude-sonnet-4-6",
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: [{ role: "user", content: opts.userMessage }],
      tools: [opts.tool],
      tool_choice: { type: "tool", name: opts.tool.name },
    }),
  });

  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const toolUse = (data.content as Array<{ type: string; input?: Record<string, unknown> }> | undefined)
    ?.find((b) => b.type === "tool_use");
  if (!toolUse?.input) throw new Error("Claude did not return a structured tool call");

  return {
    input: toolUse.input,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

/** Verbatim source-of-truth instruction — every extraction/analysis stage's system prompt includes this. */
export const SOURCE_OF_TRUTH_RULE = `You are extracting/analyzing information from tender documents. For every requirement, risk, or fact you output, you MUST include the exact source: document name, page number (if known), and section/clause label (if known), plus a direct quote of the sentence(s) it came from. If you cannot point to a specific source for something, either omit it or mark it explicitly as your own interpretation with confidence "low" — never state it as a bare fact. Never invent company credentials, financial figures, certifications, or facts not present in the provided source text.`;
