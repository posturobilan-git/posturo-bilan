import { Fragment } from "react";
import { PHOTO_ANGLE_LABELS } from "@/lib/labels";
import { pairByAngle } from "@/lib/photos";
import type { PhotoAngle } from "@prisma/client";

export interface ComparePhoto {
  src: string;
  angle: PhotoAngle | null;
  caption: string | null;
}

/**
 * Side-by-side before/after photo comparison (prompt 25). Pairs before[i] with
 * after[i] so the same shot lines up across the réglage. Plain component (no
 * hooks) so it renders in both the study form (client) and the dossier (server).
 */
export function PhotoComparison({
  before,
  after,
  title = "Photos avant / après",
}: {
  before: ComparePhoto[];
  after: ComparePhoto[];
  title?: string;
}) {
  if (before.length === 0 && after.length === 0) return null;
  // Same angle side by side (side-view before next to side-view after, etc.).
  const pairs = pairByAngle(before, after);

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-subtle">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <p className="text-xs font-medium text-content-muted">Avant réglage</p>
        <p className="text-xs font-medium text-content-muted">Après réglage</p>
        {pairs.map((pair, i) => (
          <Fragment key={i}>
            <PhotoCell photo={pair.before} />
            <PhotoCell photo={pair.after} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function PhotoCell({ photo }: { photo?: ComparePhoto }) {
  if (!photo) {
    return <div className="aspect-square rounded-lg border border-dashed border-border bg-surface-muted/40" />;
  }
  const meta = [photo.angle ? PHOTO_ANGLE_LABELS[photo.angle] : null, photo.caption]
    .filter(Boolean)
    .join(" · ");
  return (
    <figure className="overflow-hidden rounded-lg border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt={photo.caption || "Photo patient"} className="aspect-square w-full object-cover" />
      {meta && <figcaption className="px-2 py-1 text-xs text-content-subtle">{meta}</figcaption>}
    </figure>
  );
}
