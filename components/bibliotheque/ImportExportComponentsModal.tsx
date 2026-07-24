"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { toast } from "@/lib/stores/toastStore";
import {
  previewComponentImport,
  confirmComponentImport,
  type ImportRowPreview,
  type ConfirmComponentImportResult,
} from "@/actions/componentImport.actions";
import type { ImportRowInput } from "@/lib/validations/componentImport.schema";

type Mode = "upload" | "paste";
type Step = "input" | "preview" | "done";

export function ImportExportComponentsModal({
  categoryId,
  categoryLabel,
}: {
  /** null when no specific category is selected — the buttons still render,
   * disabled, so the feature stays discoverable. */
  categoryId: string | null;
  categoryLabel: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [mode, setMode] = useState<Mode>("upload");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRowPreview[]>([]);
  const [attributeNames, setAttributeNames] = useState<string[]>([]);
  const [presentAttributeIds, setPresentAttributeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConfirmComponentImportResult | null>(null);
  const [analyzing, startAnalyzing] = useTransition();
  const [confirming, startConfirming] = useTransition();

  function reset() {
    setStep("input");
    setMode("upload");
    setRawText("");
    setFileName(null);
    setRows([]);
    setAttributeNames([]);
    setPresentAttributeIds([]);
    setError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openModal() {
    reset();
    setOpen(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRawText(await file.text());
  }

  function handleAnalyze() {
    if (!categoryId) return; // le bouton d'ouverture est désactivé sans catégorie
    setError(null);
    startAnalyzing(async () => {
      const result = await previewComponentImport(categoryId, rawText);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows(result.data.rows);
      setAttributeNames(result.data.attributeNames);
      setPresentAttributeIds(result.data.presentAttributeIds);
      setStep("preview");
    });
  }

  function toggleRow(rowNumber: number) {
    setRows((prev) => prev.map((r) => (r.rowNumber === rowNumber ? { ...r, included: !r.included } : r)));
  }

  function handleConfirm() {
    if (!categoryId) return; // le bouton d'ouverture est désactivé sans catégorie
    const payload: ImportRowInput[] = rows
      .filter((r) => r.included)
      .map((r) => ({
        rowNumber: r.rowNumber,
        action: r.action,
        componentId: r.componentId ?? undefined,
        name: r.resolved.name,
        brand: r.resolved.brand || undefined,
        model: r.resolved.model || undefined,
        bikeTypeIds: r.resolved.bikeTypeIds,
        attributeValues: r.resolved.attributeValues,
      }));

    setError(null);
    startConfirming(async () => {
      const result = await confirmComponentImport(categoryId, payload, presentAttributeIds);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResult(result.data);
      setStep("done");
      toast.success(`${result.data.created} créé(s), ${result.data.updated} mis à jour.`);
      router.refresh();
    });
  }

  const included = rows.filter((r) => r.included);
  const counts = {
    create: included.filter((r) => r.action === "create").length,
    update: included.filter((r) => r.action === "update").length,
    excluded: rows.length - included.length,
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {categoryId ? (
          <a
            href={`/api/components/export?category=${categoryId}`}
            download
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-content shadow-xs transition-colors hover:bg-surface-muted"
          >
            Exporter — {categoryLabel}
          </a>
        ) : (
          <span
            aria-disabled
            title="Choisissez d'abord une catégorie de composant ci-dessus."
            className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-content-subtle opacity-50"
          >
            Exporter
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={openModal}
          disabled={!categoryId}
          title={categoryId ? undefined : "Choisissez d'abord une catégorie de composant ci-dessus."}
        >
          Importer{categoryLabel ? ` — ${categoryLabel}` : ""}
        </Button>
      </div>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          >
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-lg font-semibold text-content">Importer — {categoryLabel}</h2>
                <button onClick={() => setOpen(false)} className="rounded-md p-1 text-content-subtle hover:bg-surface-muted" aria-label="Fermer">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 px-6 py-5">
                {step === "input" && (
                  <>
                    <div className="flex gap-1 border-b border-border">
                      {(["upload", "paste"] as Mode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                            mode === m
                              ? "border-brand-600 text-brand-700"
                              : "border-transparent text-content-muted hover:border-border-strong hover:text-content"
                          }`}
                        >
                          {m === "upload" ? "Fichier CSV" : "Coller (Google Sheets, Excel…)"}
                        </button>
                      ))}
                    </div>

                    {mode === "upload" ? (
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-content">Fichier CSV</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          onChange={handleFileChange}
                          className="rounded-md border border-border-strong px-3 py-2 text-sm"
                        />
                        {fileName && <span className="text-xs text-content-subtle">{fileName} — {rawText.length} caractères lus.</span>}
                      </label>
                    ) : (
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-content">Contenu collé</span>
                        <textarea
                          rows={10}
                          value={rawText}
                          onChange={(e) => setRawText(e.target.value)}
                          placeholder="Collez ici les cellules copiées depuis Google Sheets ou Excel (en-têtes incluses)."
                          className="rounded-md border border-border-strong px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </label>
                    )}

                    {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

                    <div className="flex justify-end gap-3 pt-2">
                      <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
                      <Button onClick={handleAnalyze} loading={analyzing} disabled={!rawText.trim()}>Analyser</Button>
                    </div>
                  </>
                )}

                {step === "preview" && (
                  <>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="rounded-full bg-success-50 px-3 py-1 font-medium text-success-700">
                        {counts.create} création{counts.create > 1 ? "s" : ""}
                      </span>
                      <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">
                        {counts.update} mise{counts.update > 1 ? "s" : ""} à jour
                      </span>
                      {counts.excluded > 0 && (
                        <span className="rounded-full bg-surface-muted px-3 py-1 font-medium text-content-muted">
                          {counts.excluded} ignorée{counts.excluded > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="min-w-full divide-y divide-border text-sm">
                        <thead className="bg-surface-muted">
                          <tr>
                            <th className="px-3 py-2 text-left"></th>
                            <th className="px-3 py-2 text-left font-medium text-content-subtle">Ligne</th>
                            <th className="px-3 py-2 text-left font-medium text-content-subtle">Action</th>
                            <th className="px-3 py-2 text-left font-medium text-content-subtle">Marque</th>
                            <th className="px-3 py-2 text-left font-medium text-content-subtle">Modèle</th>
                            <th className="px-3 py-2 text-left font-medium text-content-subtle">Types de vélo</th>
                            {attributeNames.map((name) => (
                              <th key={name} className="px-3 py-2 text-left font-medium text-content-subtle">{name}</th>
                            ))}
                            <th className="px-3 py-2 text-left font-medium text-content-subtle">Avertissements</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {rows.map((row) => (
                            <tr
                              key={row.rowNumber}
                              className={!row.included ? "opacity-50" : row.warnings.length > 0 ? "bg-warning-50" : undefined}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={row.included}
                                  onChange={() => toggleRow(row.rowNumber)}
                                  className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-content-subtle">{row.rowNumber}</td>
                              <td className="px-3 py-2">
                                {row.action === "create" ? (
                                  <span className="text-success-700">Créer</span>
                                ) : (
                                  <span className="text-brand-700">Mettre à jour</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-content">{row.resolved.brand || "—"}</td>
                              <td className="px-3 py-2 text-content">{row.resolved.model || "—"}</td>
                              <td className="px-3 py-2 text-content">{row.resolved.bikeTypeNames.join(", ") || "—"}</td>
                              {attributeNames.map((name) => (
                                <td key={name} className="px-3 py-2 text-content">{row.raw[name] || "—"}</td>
                              ))}
                              <td className="px-3 py-2 text-warning-700">
                                {row.warnings.length > 0 ? row.warnings.join(" ") : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

                    <div className="flex justify-between gap-3 pt-2">
                      <Button type="button" variant="ghost" onClick={() => setStep("input")}>← Modifier la source</Button>
                      <Button onClick={handleConfirm} loading={confirming} disabled={included.length === 0}>
                        Confirmer l&apos;import ({included.length})
                      </Button>
                    </div>
                  </>
                )}

                {step === "done" && result && (
                  <>
                    <div className="space-y-2 rounded-lg border border-border bg-surface-muted p-4 text-sm">
                      <p className="text-content">{result.created} composant(s) créé(s), {result.updated} mis à jour.</p>
                      {result.failed.length > 0 && (
                        <div className="text-danger-700">
                          <p className="font-medium">{result.failed.length} ligne(s) en échec :</p>
                          <ul className="list-inside list-disc">
                            {result.failed.map((f) => (
                              <li key={f.rowNumber}>Ligne {f.rowNumber} : {f.error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={() => setOpen(false)}>Fermer</Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
