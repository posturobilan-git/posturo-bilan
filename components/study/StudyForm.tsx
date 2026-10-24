"use client";

import { useEffect, useRef, useTransition, type FocusEvent } from "react";
import { useRouter } from "next/navigation";
import {
  useStudyStore,
  measureValuesToArray,
  riderMeasureValuesToArray,
  physioResultsToArray,
  painsToArray,
  photosToArray,
  makePainDraft,
  makePhotoDraft,
  type StudyStep,
  type PainDraft,
  type PhotoDraft,
} from "@/lib/stores/studyStore";
import { toast } from "@/lib/stores/toastStore";
import { findMissingRequired, firstBlockingStep } from "@/lib/study/required-fields";
import { getMissingControls, pickNextControl, revealControl } from "@/lib/study/focus-missing";
import { saveDraftStudy, submitStudy } from "@/actions/study.actions";
import { StudyStepper } from "./StudyStepper";
import { MissingFieldsBanner } from "./MissingFieldsBanner";
import { BikeTypeStep } from "./BikeTypeStep";
import { PainsForm } from "./PainsForm";
import { MeasuresForm, type MeasurementForStudy } from "./MeasuresForm";
import { RiderMeasuresForm, type RiderMeasurementForStudy } from "./RiderMeasuresForm";
import { PhysioTestsForm, type PhysioTestForStudy } from "./PhysioTestsForm";
import { ComponentPicker, type ComponentForStudy } from "./ComponentPicker";
import { ExercisePicker } from "./ExercisePicker";
import {
  StudySummaryStep,
  type RecapMeasureRow,
  type RecapPhysioRow,
} from "./StudySummaryStep";
import type { ComparePhoto } from "./PhotoComparison";
import type { BikeType, ComponentAttribute, Exercise, Patient, PatientIntake } from "@prisma/client";
import type { PhysioValue } from "@/lib/physio";
import type { StudyPainInput } from "@/types";

interface Props {
  patient: Patient & { intake: PatientIntake | null };
  bikeTypes: BikeType[];
  measurements: MeasurementForStudy[];
  riderMeasurements: RiderMeasurementForStudy[];
  physioTests: PhysioTestForStudy[];
  components: ComponentForStudy[];
  categories: { id: string; name: string }[];
  attributesByCategory: Record<string, ComponentAttribute[]>;
  exercises: Exercise[];
  /** Pre-filled from an existing study, if any */
  initial?: {
    studyId: string;
    bikeTypeId: string;
    measureValues: Record<string, { before: number | null; after: number | null }>;
    riderMeasureValues: Record<string, { before: number | null; after: number | null }>;
    physioResults: Record<string, PhysioValue>;
    physioComments: Record<string, string>;
    pains: StudyPainInput[];
    photos: Omit<PhotoDraft, "key">[];
    observations: string;
    summary: string;
    recommendations: string;
    componentIds: string[];
    exerciseIds: string[];
  };
}

/** Default pain blocks for a new study: one per declared injury, else one empty. */
function painsFromIntake(injuries: string[]): PainDraft[] {
  if (injuries.length === 0) return [makePainDraft()];
  return injuries.map((location) => makePainDraft({ location }));
}

/** Stable empty set, so steps without alerts get the same prop on every render. */
const NO_KEYS: ReadonlySet<string> = new Set();

export function StudyForm({
  patient,
  bikeTypes,
  measurements,
  riderMeasurements,
  physioTests,
  components,
  categories,
  attributesByCategory,
  exercises,
  initial,
}: Props) {
  const router = useRouter();
  const store = useStudyStore();
  const [saving, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();

  // Initialize store once per study target (handles navigation between studies/patients).
  useEffect(() => {
    // Stored values whose côte isn't configured for this bike type were added
    // on the fly for this study — restore them as extras when editing.
    const configuredIds = new Set(
      measurements
        .filter(
          (m) =>
            m.isCommon ||
            m.bikeTypeLinks.some((b) => b.bikeTypeId === initial?.bikeTypeId)
        )
        .map((m) => m.id)
    );
    const knownIds = new Set(measurements.map((m) => m.id));
    const extraMeasurementIds = Object.keys(initial?.measureValues ?? {}).filter(
      (id) => !configuredIds.has(id) && knownIds.has(id)
    );

    // Same restore logic for the mesures du cycliste added on the fly.
    const configuredRiderIds = new Set(
      riderMeasurements
        .filter(
          (m) =>
            m.isCommon ||
            m.bikeTypeLinks.some((b) => b.bikeTypeId === initial?.bikeTypeId)
        )
        .map((m) => m.id)
    );
    const knownRiderIds = new Set(riderMeasurements.map((m) => m.id));
    const extraRiderMeasurementIds = Object.keys(initial?.riderMeasureValues ?? {}).filter(
      (id) => !configuredRiderIds.has(id) && knownRiderIds.has(id)
    );

    // Pains: editing keeps the saved set (or one empty block if none were saved);
    // a new study pre-fills one block per injury declared at intake.
    const pains = initial
      ? initial.pains.length > 0
        ? initial.pains.map((p) => makePainDraft(p))
        : [makePainDraft()]
      : painsFromIntake(patient.intake?.injuries ?? []);

    store.init(patient.id, {
      draftStudyId: initial?.studyId ?? null,
      bikeTypeId: initial?.bikeTypeId ?? null,
      measureValues: initial?.measureValues ?? {},
      extraMeasurementIds,
      riderMeasureValues: initial?.riderMeasureValues ?? {},
      extraRiderMeasurementIds,
      physioResults: initial?.physioResults ?? {},
      physioComments: initial?.physioComments ?? {},
      pains,
      photos: (initial?.photos ?? []).map((p) => makePhotoDraft(p)),
      observations: initial?.observations ?? "",
      summary: initial?.summary ?? "",
      recommendations: initial?.recommendations ?? "",
      selectedComponentIds: initial?.componentIds ?? [],
      selectedExerciseIds: initial?.exerciseIds ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id, initial?.studyId]);

  // ── Persistence helper ──────────────────────────────────────────────────────

  /** Saves the current store state as a draft. Returns true on success. */
  async function persistDraft(): Promise<boolean> {
    const result = await saveDraftStudy({
      patientId: patient.id,
      draftStudyId: store.draftStudyId ?? undefined,
      bikeTypeId: store.bikeTypeId ?? "",
      measureValues: measureValuesToArray(store.measureValues),
      riderMeasureValues: riderMeasureValuesToArray(store.riderMeasureValues),
      physioResults: physioResultsToArray(store.physioResults, store.physioComments),
      pains: painsToArray(store.pains),
      photos: photosToArray(store.photos),
      observations: store.observations || undefined,
      summary: store.summary || undefined,
      recommendations: store.recommendations || undefined,
      componentIds: store.selectedComponentIds,
      exerciseIds: store.selectedExerciseIds,
    });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    store.setDraftStudyId(result.data.studyId);
    return true;
  }

  // ── Required-field guards ─────────────────────────────────────────────────────

  /**
   * Every required value still empty: a result per required test, "avant" and
   * "après" per required côte / mesure du cycliste (only those applicable to the
   * bike type). Each entry knows the step where it is typed.
   */
  const missing = findMissingRequired({
    bikeTypeId: store.bikeTypeId,
    physioTests,
    physioResults: store.physioResults,
    measurements,
    measureValues: store.measureValues,
    riderMeasurements,
    riderMeasureValues: store.riderMeasureValues,
  });

  // Alerts show only on the step where a move was blocked, and only for what is
  // still missing: filling a field clears its alert live.
  const missingHere = missing.filter((f) => f.step === store.step);
  const showMissing = store.missingRevealedStep === store.step;
  const invalidKeys = showMissing ? new Set(missingHere.map((f) => f.key)) : NO_KEYS;
  // Values that were missing when the move was blocked keep their message line (see FieldError).
  const reservedKeys = showMissing ? new Set(store.revealedKeys) : NO_KEYS;

  /**
   * Blocks a move out of the steps [from, to[ while one of them still has an empty
   * required field (drafts may stay partial, but you can't step past an unfilled
   * required field). The user is taken to the first such step — not necessarily the
   * current one when the stepper skips ahead — where every missing field is flagged
   * and the view scrolls to the first. Returns true when the move was blocked.
   *
   * Landing on a LATER step than the current one is still a forward move, so the
   * draft is saved first like any other forward move (otherwise a stepper click from
   * step 3 to 7 would carry the user to step 6 without persisting steps 3-5). Staying
   * on the step, or going back (final submit), saves nothing, as before.
   */
  function blockIfMissing(from: number, to: number): boolean {
    const blocking = firstBlockingStep(missing, from, to);
    if (blocking === null) return false;
    const keys = missing.filter((f) => f.step === blocking).map((f) => f.key);
    if (blocking > store.step) {
      startSave(async () => {
        if (await persistDraft()) store.revealMissingFields(blocking, keys);
      });
    } else {
      store.revealMissingFields(blocking, keys);
    }
    return true;
  }

  // ── Scroll & focus on missing fields ──────────────────────────────────────────

  const rootRef = useRef<HTMLDivElement>(null);
  // Last field touched (or scrolled to): where « suivante » picks up from.
  const cursorRef = useRef<Element | null>(null);
  const handledRevealRef = useRef(store.revealSeq);

  // After a blocked move, scroll to and focus the first missing field. Runs once
  // the alerts are rendered, so it also works when the move switched step.
  useEffect(() => {
    if (store.revealSeq === handledRevealRef.current) return;
    handledRevealRef.current = store.revealSeq;
    const first = rootRef.current ? getMissingControls(rootRef.current)[0] : undefined;
    if (!first) return;
    cursorRef.current = first;
    revealControl(first);
  }, [store.revealSeq]);

  // The store is a module singleton and init() runs after the first render: don't let this
  // visit's alerts flash for a frame on the next mount.
  useEffect(() => {
    return () => useStudyStore.setState({ missingRevealedStep: null, revealedKeys: [] });
  }, []);

  function goToNextMissing() {
    if (!rootRef.current) return;
    const next = pickNextControl(getMissingControls(rootRef.current), cursorRef.current);
    if (!next) return;
    cursorRef.current = next;
    revealControl(next);
  }

  function rememberFocus(e: FocusEvent<HTMLDivElement>) {
    const target = e.target;
    // The banner's own button must not become the reference point.
    if (target instanceof Element && !target.closest("[data-missing-nav]")) {
      cursorRef.current = target;
    }
  }

  // ── Step transitions ──────────────────────────────────────────────────────────

  /**
   * Persists the draft, then advances to the given step. Blocks the move when a
   * required côte/test on the current step is still empty.
   */
  function advanceTo(step: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9) {
    if (blockIfMissing(store.step, step)) return;
    startSave(async () => {
      if (await persistDraft()) store.setStep(step);
    });
  }

  /**
   * Jumps to an arbitrary step via the stepper. Going back is always allowed and
   * instant. Going forward persists the draft first and refuses to skip over a
   * step whose required côtes/tests are still empty (same guard as Next).
   */
  function goToStep(target: StudyStep) {
    if (target === store.step) return;
    if (target < store.step) {
      store.setStep(target);
      return;
    }
    if (blockIfMissing(store.step, target)) return;
    startSave(async () => {
      if (await persistDraft()) store.setStep(target);
    });
  }

  function handleSaveDraft() {
    startSave(async () => {
      if (await persistDraft()) toast.success("Brouillon enregistré.");
    });
  }

  function handleSubmit() {
    // Final safety net — covers every required field regardless of step.
    if (blockIfMissing(1, 9)) return;
    startSubmit(async () => {
      const result = await submitStudy({
        patientId: patient.id,
        draftStudyId: store.draftStudyId ?? undefined,
        bikeTypeId: store.bikeTypeId ?? "",
        measureValues: measureValuesToArray(store.measureValues),
        riderMeasureValues: riderMeasureValuesToArray(store.riderMeasureValues),
        physioResults: physioResultsToArray(store.physioResults, store.physioComments),
        pains: painsToArray(store.pains),
        photos: photosToArray(store.photos),
        observations: store.observations || undefined,
        summary: store.summary || undefined,
        recommendations: store.recommendations || undefined,
        componentIds: store.selectedComponentIds,
        exerciseIds: store.selectedExerciseIds,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Étude soumise avec succès.");
      router.push(`/dashboard/patients/${patient.id}`);
    });
  }

  // Shared props for the two bike-measurement phases (avant / après).
  const measureStepProps = {
    measurements,
    bikeTypeId: store.bikeTypeId,
    values: store.measureValues,
    extraMeasurementIds: store.extraMeasurementIds,
    invalidKeys,
    reservedKeys,
    observations: store.observations,
    onSetValue: store.setMeasureValue,
    onAddExtra: store.addExtraMeasurement,
    onRemoveExtra: store.removeExtraMeasurement,
    onSetObservations: store.setObservations,
    onSaveDraft: handleSaveDraft,
    saving,
  };

  // ── Read-only recap rows for the final step ──────────────────────────────────
  // Resolved from the store + metadata, mirroring the dossier patient display.

  function buildMeasureRecap(
    defs: { id: string; name: string; unit: string }[],
    values: Record<string, { before: number | null; after: number | null }>
  ): RecapMeasureRow[] {
    const byId = new Map(defs.map((d) => [d.id, d]));
    return Object.entries(values)
      .map(([id, v]) => ({ id, def: byId.get(id), v }))
      .filter((r): r is { id: string; def: { id: string; name: string; unit: string }; v: { before: number | null; after: number | null } } =>
        Boolean(r.def) && (r.v.before != null || r.v.after != null)
      )
      .map(({ id, def, v }) => ({ id, name: def.name, unit: def.unit, before: v.before, after: v.after }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const measureRecap = buildMeasureRecap(measurements, store.measureValues);
  const riderMeasureRecap = buildMeasureRecap(riderMeasurements, store.riderMeasureValues);

  // Photos for the bilan comparison — split by phase, in capture order. previewUrl
  // is the local objectURL (fresh upload) or /api/photos/[id] (existing).
  const toCompare = (phase: "BEFORE" | "AFTER"): ComparePhoto[] =>
    store.photos
      .filter((p) => p.phase === phase && p.previewUrl)
      .map((p) => ({ src: p.previewUrl, angle: p.angle, caption: p.caption || null }));
  const beforePhotos = toCompare("BEFORE");
  const afterPhotos = toCompare("AFTER");

  const physioById = new Map(physioTests.map((t) => [t.id, t]));
  const physioRecap: RecapPhysioRow[] = [
    ...new Set([
      ...Object.keys(store.physioResults),
      ...Object.keys(store.physioComments),
    ]),
  ]
    .map((id) => {
      const def = physioById.get(id);
      const value = store.physioResults[id] ?? null;
      const comment = store.physioComments[id]?.trim() || null;
      return { id, def, value, comment };
    })
    .filter((r): r is { id: string; def: PhysioTestForStudy; value: PhysioValue; comment: string | null } =>
      Boolean(r.def) && ((r.value !== null && r.value !== undefined && r.value !== "") || Boolean(r.comment))
    )
    .map((r) => ({ id: r.id, name: r.def.name, outputType: r.def.outputType, unit: r.def.unit, value: r.value, comment: r.comment }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div ref={rootRef} onFocus={rememberFocus} className="space-y-6">
      <StudyStepper current={store.step} onStepClick={goToStep} />

      {showMissing && <MissingFieldsBanner count={missingHere.length} onNext={goToNextMissing} />}

      {store.step === 1 && (
        <BikeTypeStep
          bikeTypes={bikeTypes}
          selected={store.bikeTypeId}
          onSelect={store.setBikeTypeId}
          onNext={() => advanceTo(2)}
          saving={saving}
        />
      )}

      {store.step === 2 && (
        <PainsForm
          pains={store.pains}
          onAdd={store.addPain}
          onRemove={store.removePain}
          onSetField={store.setPainField}
          onBack={() => store.setStep(1)}
          onNext={() => advanceTo(3)}
          onSaveDraft={handleSaveDraft}
          saving={saving}
        />
      )}

      {store.step === 3 && (
        <PhysioTestsForm
          physioTests={physioTests}
          bikeTypeId={store.bikeTypeId}
          results={store.physioResults}
          comments={store.physioComments}
          invalidKeys={invalidKeys}
          reservedKeys={reservedKeys}
          onSetValue={store.setPhysioValue}
          onSetComment={store.setPhysioComment}
          onBack={() => store.setStep(2)}
          onNext={() => advanceTo(4)}
          onSaveDraft={handleSaveDraft}
          saving={saving}
        />
      )}

      {store.step === 4 && (
        <MeasuresForm
          {...measureStepProps}
          phase="before"
          onBack={() => store.setStep(3)}
          onNext={() => advanceTo(5)}
        />
      )}

      {store.step === 5 && (
        <RiderMeasuresForm
          riderMeasurements={riderMeasurements}
          bikeTypeId={store.bikeTypeId}
          values={store.riderMeasureValues}
          extraRiderMeasurementIds={store.extraRiderMeasurementIds}
          invalidKeys={invalidKeys}
          reservedKeys={reservedKeys}
          photos={store.photos}
          onSetValue={store.setRiderMeasureValue}
          onAddExtra={store.addExtraRiderMeasurement}
          onRemoveExtra={store.removeExtraRiderMeasurement}
          onAddPhoto={store.addPhoto}
          onUpdatePhoto={store.updatePhoto}
          onRemovePhoto={store.removePhoto}
          onBack={() => store.setStep(4)}
          onNext={() => advanceTo(6)}
          onSaveDraft={handleSaveDraft}
          saving={saving}
        />
      )}

      {store.step === 6 && (
        <MeasuresForm
          {...measureStepProps}
          phase="after"
          onBack={() => store.setStep(5)}
          onNext={() => advanceTo(7)}
        />
      )}

      {store.step === 7 && (
        <ComponentPicker
          components={components}
          categories={categories}
          attributesByCategory={attributesByCategory}
          bikeTypeId={store.bikeTypeId}
          selected={store.selectedComponentIds}
          onToggle={store.toggleComponent}
          onBack={() => store.setStep(6)}
          onNext={() => advanceTo(8)}
        />
      )}

      {store.step === 8 && (
        <ExercisePicker
          exercises={exercises}
          components={components}
          selected={store.selectedExerciseIds}
          selectedComponentIds={store.selectedComponentIds}
          measureCount={measureValuesToArray(store.measureValues).length}
          onToggle={store.toggleExercise}
          onBack={() => store.setStep(7)}
          onNext={() => advanceTo(9)}
          saving={saving}
        />
      )}

      {store.step === 9 && (
        <StudySummaryStep
          measureRows={measureRecap}
          riderMeasureRows={riderMeasureRecap}
          physioRows={physioRecap}
          beforePhotos={beforePhotos}
          afterPhotos={afterPhotos}
          summary={store.summary}
          recommendations={store.recommendations}
          onSetSummary={store.setSummary}
          onSetRecommendations={store.setRecommendations}
          onBack={() => store.setStep(8)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}
