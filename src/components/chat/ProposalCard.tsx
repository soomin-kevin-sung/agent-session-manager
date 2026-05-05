import { Check, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlanProposal } from "@/lib/proposal-parser";
import { api } from "@/lib/tauri";

type ProposalStatus = "pending" | "approved" | "rejected";

interface ProposalCardProps {
  sessionId: string;
  channelId: string;
  proposal: PlanProposal;
}

export function ProposalCard({ sessionId, channelId, proposal }: ProposalCardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ProposalStatus>("pending");
  const [submitting, setSubmitting] = useState(false);

  const taskCount = proposal.tasks.length;
  const disabled = submitting || status !== "pending";

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await api.tasks.createFromProposal(sessionId, channelId, proposal);
      setStatus("approved");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = () => {
    setStatus("rejected");
  };

  return (
    <div className="mt-2 max-w-2xl rounded-lg border border-zinc-700 bg-zinc-900/80 p-3 shadow-sm shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-emerald-400">
              {t("proposal.title")}
            </span>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400">
              {t("proposal.tasks", { count: taskCount })}
            </Badge>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-zinc-100">
            {proposal.plan_title}
          </h3>
          {proposal.summary && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">
              {proposal.summary}
            </p>
          )}
        </div>
        {status !== "pending" && (
          <Badge
            variant={status === "approved" ? "default" : "secondary"}
            className="shrink-0 capitalize"
          >
            {t(`proposal.${status}`)}
          </Badge>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {taskCount === 0 ? (
          <p className="text-sm text-zinc-500">{t("proposal.noTasks")}</p>
        ) : (
          proposal.tasks.map((task, index) => (
            <div
              key={`${task.title}-${index}`}
              className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  {task.title}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {task.agent_preset}
                </Badge>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">
                {task.description}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={handleApprove} disabled={disabled || taskCount === 0}>
          <Check className="size-3.5" />
          {status === "approved" ? t("proposal.approved") : t("proposal.approve")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={disabled}
        >
          <X className="size-3.5" />
          {status === "rejected" ? t("proposal.rejected") : t("proposal.reject")}
        </Button>
      </div>
    </div>
  );
}
