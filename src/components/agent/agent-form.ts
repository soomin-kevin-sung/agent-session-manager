import type { Agent } from "@/lib/tauri";

export interface ModelOption {
  value: string;
  label: string;
  runtime: "claude_cli" | "codex_cli";
  provider: "anthropic" | "openai";
  group: string;
}

export const ALL_MODELS: ModelOption[] = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", runtime: "claude_cli", provider: "anthropic", group: "Claude" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", runtime: "claude_cli", provider: "anthropic", group: "Claude" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", runtime: "claude_cli", provider: "anthropic", group: "Claude" },
  { value: "gpt-5.5", label: "Codex GPT-5.5", runtime: "codex_cli", provider: "openai", group: "Codex" },
  { value: "o3", label: "Codex o3", runtime: "codex_cli", provider: "openai", group: "Codex" },
  { value: "o4-mini", label: "Codex o4-mini", runtime: "codex_cli", provider: "openai", group: "Codex" },
  { value: "gpt-4.1", label: "Codex GPT-4.1", runtime: "codex_cli", provider: "openai", group: "Codex" },
];

export const GROUPS = [...new Set(ALL_MODELS.map((m) => m.group))];

export interface Preset {
  id: string;
  key: string;
  defaultPermissions?: string[];
}

export const ALL_PERMISSIONS = ["execute_cli", "create_agent", "create_session", "assign_task", "review"];

export const PRESETS: Preset[] = [
  { id: "custom", key: "custom" },
  { id: "manager", key: "manager", defaultPermissions: ALL_PERMISSIONS },
  { id: "developer", key: "developer" },
  { id: "frontend-developer", key: "frontendDeveloper" },
  { id: "backend-developer", key: "backendDeveloper" },
  { id: "code-reviewer", key: "codeReviewer" },
  { id: "project-manager", key: "projectManager", defaultPermissions: ["create_agent", "create_session", "assign_task", "review"] },
  { id: "devops-engineer", key: "devopsEngineer" },
  { id: "qa-engineer", key: "qaEngineer" },
];

export const AVAILABLE_PERMISSIONS = [
  { key: "execute_cli", labelKey: "permissions.executeCli" },
  { key: "create_agent", labelKey: "permissions.createAgent" },
  { key: "create_session", labelKey: "permissions.createSession" },
  { key: "assign_task", labelKey: "permissions.assignTask" },
  { key: "review", labelKey: "permissions.review" },
] as const;

export function buildPersonaJson(
  role: string,
  expertise: string,
  description: string
): string | undefined {
  const persona: Record<string, string> = {};
  if (role.trim()) persona.role = role.trim();
  if (expertise.trim()) persona.expertise = expertise.trim();
  if (description.trim()) persona.description = description.trim();
  return Object.keys(persona).length > 0 ? JSON.stringify(persona) : undefined;
}

export function parsePersona(persona: Agent["persona"]) {
  if (!persona) return { role: "", expertise: "", description: "" };

  try {
    const parsed = JSON.parse(persona) as Record<string, unknown>;
    return {
      role: typeof parsed.role === "string" ? parsed.role : "",
      expertise: typeof parsed.expertise === "string" ? parsed.expertise : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
    };
  } catch {
    return { role: "", expertise: "", description: persona };
  }
}

export function getModelsForAgent(agent: Agent) {
  const models = ALL_MODELS.filter(
    (model) => model.runtime === agent.runtime_type && model.provider === agent.provider
  );
  return models.length > 0 ? models : ALL_MODELS;
}
