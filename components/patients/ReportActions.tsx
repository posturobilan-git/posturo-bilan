"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { generateReport, sendReport } from "@/actions/report.actions";
import { toast } from "@/lib/stores/toastStore";

interface Props {
  studyId: string;
  /** A report PDF has been generated (reportUrl set) */
  hasReport: boolean;
  /** The report has been emailed to the patient (reportSentAt set) */
  alreadySent: boolean;
}

export function ReportActions({ studyId, hasReport, alreadySent }: Props) {
  const [generating, startGenerate] = useTransition();
  const [sending, startSend] = useTransition();

  function handleGenerate() {
    startGenerate(async () => {
      const result = await generateReport(studyId);
      if (!result.ok) return toast.error(result.error);
      toast.success(hasReport ? "Rapport régénéré." : "Rapport généré.");
    });
  }

  function handleSend() {
    startSend(async () => {
      const result = await sendReport(studyId);
      if (!result.ok) return toast.error(result.error);
      toast.success(alreadySent ? "Rapport renvoyé au patient." : "Rapport envoyé au patient.");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={hasReport ? "secondary" : "primary"}
        onClick={handleGenerate}
        loading={generating}
      >
        {hasReport ? "Régénérer le rapport" : "Générer le rapport"}
      </Button>

      <Button
        size="sm"
        variant={hasReport && !alreadySent ? "primary" : "secondary"}
        onClick={handleSend}
        loading={sending}
        disabled={!hasReport}
        title={!hasReport ? "Générez d'abord le rapport" : undefined}
      >
        {alreadySent ? "Renvoyer au patient" : "Envoyer au patient"}
      </Button>
    </div>
  );
}
