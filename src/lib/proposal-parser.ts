export interface PlanTask {
  title: string;
  description: string;
  agent_preset: string;
  acceptance_criteria?: string[];
}

export interface PlanProposal {
  plan_title: string;
  summary?: string;
  tasks: PlanTask[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPlanTask(value: unknown): value is PlanTask {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const task = value as Record<string, unknown>;
  const hasRequiredFields =
    typeof task.title === "string" &&
    typeof task.description === "string" &&
    typeof task.agent_preset === "string";
  const criteriaIsValid =
    task.acceptance_criteria === undefined ||
    isStringArray(task.acceptance_criteria);

  return hasRequiredFields && criteriaIsValid;
}

function isPlanProposal(value: unknown): value is PlanProposal {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const proposal = value as Record<string, unknown>;
  const hasRequiredFields =
    typeof proposal.plan_title === "string" && Array.isArray(proposal.tasks);
  const summaryIsValid =
    proposal.summary === undefined || typeof proposal.summary === "string";

  return (
    hasRequiredFields &&
    summaryIsValid &&
    (proposal.tasks as unknown[]).every(isPlanTask)
  );
}

function extractJsonCandidates(content: string): string[] {
  const candidates: string[] = [];
  const codeBlock = content.match(/```json\s*([\s\S]*?)```/i);

  if (codeBlock?.[1]) {
    candidates.push(codeBlock[1].trim());
  }

  const firstBrace = content.indexOf("{");
  if (firstBrace >= 0) {
    candidates.push(content.slice(firstBrace).trim());
  }

  return candidates;
}

export function parsePlanProposal(content: string): PlanProposal | null {
  for (const candidate of extractJsonCandidates(content)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isPlanProposal(parsed)) {
        return parsed;
      }
    } catch {
      // Try the next extraction strategy.
    }
  }

  return null;
}
