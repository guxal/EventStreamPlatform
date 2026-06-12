export type AiFlow =
  | 'chat'
  | 'recommendation'
  | 'report'
  | 'explainer'
  | 'orchestrator';
export type AiPromptType =
  | 'AI_CHAT'
  | 'RECOMMENDATION'
  | 'REPORT'
  | 'EXPLAINER';

export type AiDebugMetadata = {
  correlationId?: string;
  projectId?: string;
  importId?: string | null;
  rawFileId?: string | null;
  source?: string | null;
  reportType?: string | null;
  aiFlow?: AiFlow;
  promptType?: AiPromptType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type AiDebugTraceInput = AiDebugMetadata & {
  contextSummary?: Record<string, unknown>;
  sanitizedPrompt?: unknown;
  sanitizedResponse?: string;
  parsedOutput?: unknown;
  errorType?: string;
  errorMessage?: string;
  durationMs?: number;
  tokenUsage?: Record<string, unknown>;
};
