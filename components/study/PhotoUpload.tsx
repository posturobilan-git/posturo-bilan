"use client";

import { useRef, useState } from "react";
import { toast } from "@/lib/stores/toastStore";
import { makePhotoDraft, type PhotoDraft } from "@/lib/stores/studyStore";
import { PHOTO_ANGLES, PHOTO_ANGLE_LABELS } from "@/lib/labels";
import type { PhotoPhase } from "@prisma/client";

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo / fichier
const MAX_WIDTH = 2000; // redimensionnement avant upload (économie de stockage)
const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif";

interface Props {
  photos: PhotoDraft[];
  onAdd: (photo: PhotoDraft) => void;
  onUpdate: (key: string, patch: Partial<Omit<PhotoDraft, "key">>) => void;
  onRemove: (key: string) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
}

/**
 * Decodes the file, downscales to {@link MAX_WIDTH} if wider, and re-encodes as
 * JPEG so every stored photo displays in any browser and in the PDF. Rejects if
 * the browser can't decode the format (e.g. HEIC outside Safari).
 */
async function processImage(file: File): Promise<Blob> {
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const scale = img.naturalWidth > MAX_WIDTH ? MAX_WIDTH / img.naturalWidth : 1;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) throw new Error("encode");
    return blob;
  } finally {
    URL.revokeObjectURL(src);
  }
}

export function PhotoUpload({ photos, onAdd, onUpdate, onRemove }: Props) {
  const [busy, setBusy] = useState(0);

  async function handleFiles(files: FileList | null, phase: PhotoPhase) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} dépasse 10 Mo.`);
        continue;
      }
      let processed: Blob;
      try {
        processed = await processImage(file);
      } catch {
        toast.error(`Format non pris en charge : ${file.name}.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(processed);
      const draft = makePhotoDraft({ phase, previewUrl });
      onAdd(draft);

      setBusy((n) => n + 1);
      try {
        const form = new FormData();
        form.append("file", processed, "photo.jpg");
        const res = await fetch("/api/photos/upload", { method: "POST", body: form });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "");
        }
        const { key } = (await res.json()) as { key: string };
        onUpdate(draft.key, { url: key });
      } catch (e) {
        const msg = e instanceof Error && e.message ? e.message : "Échec de l'upload de la photo. Réessayez.";
        toast.error(msg);
        onRemove(draft.key);
        URL.revokeObjectURL(previewUrl);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-content">Photos du patient sur le vélo</p>
        {busy > 0 && (
          <span className="text-xs text-content-subtle">Envoi en cours…</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PhotoZone
          phase="BEFORE"
          label="Photos avant réglage"
          photos={photos.filter((p) => p.phase === "BEFORE")}
          onFiles={handleFiles}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
        <PhotoZone
          phase="AFTER"
          label="Photos après réglage"
          photos={photos.filter((p) => p.phase === "AFTER")}
          onFiles={handleFiles}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

function PhotoZone({
  phase,
  label,
  photos,
  onFiles,
  onUpdate,
  onRemove,
}: {
  phase: PhotoPhase;
  label: string;
  photos: PhotoDraft[];
  onFiles: (files: FileList | null, phase: PhotoPhase) => void;
  onUpdate: Props["onUpdate"];
  onRemove: Props["onRemove"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">{label}</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files, phase);
        }}
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver
            ? "border-brand-500 bg-brand-50"
            : "border-border-strong hover:border-brand-400 hover:bg-surface-muted"
        }`}
      >
        <svg className="h-6 w-6 text-content-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 16.5V18a3 3 0 003 3h12a3 3 0 003-3v-1.5M16.5 7.5L12 3m0 0L7.5 7.5M12 3v13.5" />
        </svg>
        <span className="text-sm font-medium text-content-muted">Ajouter des photos</span>
        <span className="text-xs text-content-subtle">JPEG, PNG ou HEIC · max 10 Mo</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files, phase);
          e.target.value = "";
        }}
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <PhotoTile key={photo.key} photo={photo} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoTile({
  photo,
  onUpdate,
  onRemove,
}: {
  photo: PhotoDraft;
  onUpdate: Props["onUpdate"];
  onRemove: Props["onRemove"];
}) {
  const uploading = photo.url === "";

  function handleRemove() {
    if (photo.previewUrl.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
    onRemove(photo.key);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative aspect-square bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.previewUrl} alt={photo.caption || "Photo patient"} className="h-full w-full object-cover" />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
            Envoi…
          </div>
        )}
        <button
          type="button"
          onClick={handleRemove}
          aria-label="Retirer la photo"
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-danger-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-1.5 p-2">
        <select
          value={photo.angle ?? ""}
          onChange={(e) => onUpdate(photo.key, { angle: (e.target.value || null) as PhotoDraft["angle"] })}
          aria-label="Angle de prise de vue"
          className="w-full rounded-md border border-border-strong bg-surface px-2 py-1 text-xs text-content-muted focus:border-brand-500 focus:outline-none"
        >
          <option value="">Angle…</option>
          {PHOTO_ANGLES.map((a) => (
            <option key={a} value={a}>
              {PHOTO_ANGLE_LABELS[a]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={photo.caption}
          onChange={(e) => onUpdate(photo.key, { caption: e.target.value })}
          maxLength={500}
          placeholder="Légende…"
          aria-label="Légende de la photo"
          className="w-full rounded-md border border-border-strong bg-surface px-2 py-1 text-xs text-content focus:border-brand-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
