import "server-only";
import { put, get, del } from "@vercel/blob";
import { writeFile, mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";

// Single storage layer for every binary the app persists (PDF reports + patient
// photos). One branch decides cloud vs local for ALL of them:
//
// - Deployments (BLOB_READ_WRITE_TOKEN set) → Vercel Blob, PRIVATE access. Files
//   are never publicly reachable; they are streamed to authenticated kinés via
//   /api/reports/[studyId] and /api/photos/[id].
// - Local dev (no token) → writes under `public/` (gitignored), so the whole
//   flow — including patient-photo upload — works on a laptop without a Blob
//   store, exactly like the report PDFs.
//
// The stored *key* (pathname) is what gets persisted (Study.reportUrl,
// StudyPhoto.url).

/** Best-effort content type from a key's extension (defaults to JPEG). */
export function contentTypeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "pdf") return "application/pdf";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

/** Absolute path of a key in the local dev fallback store. */
function localPath(key: string): string {
  return path.join(process.cwd(), "public", key);
}

/**
 * Stores `buffer` under `key` and returns the key. Private Blob in the cloud,
 * local filesystem in dev. Overwrites an existing key (report PDFs reuse a
 * stable key; photo keys are unique).
 */
export async function putBlob(key: string, buffer: Buffer, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { pathname } = await put(key, buffer, {
      access: "private",
      contentType,
      allowOverwrite: true,
    });
    return pathname;
  }

  // Local filesystem fallback (dev only — Vercel's runtime FS is read-only).
  const absPath = localPath(key);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);
  return key;
}

/**
 * Reads a stored blob back as bytes + content type. Returns null if not found.
 */
export async function readBlob(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const bytes = await new Response(result.stream).arrayBuffer();
    return { buffer: Buffer.from(bytes), contentType: contentTypeFromKey(key) };
  }

  try {
    return { buffer: await readFile(localPath(key)), contentType: contentTypeFromKey(key) };
  } catch {
    return null;
  }
}

/**
 * Best-effort removal of a stored blob by key (study deletion, photo edits, RGPD
 * anonymisation). Never throws — an orphaned blob is harmless and must not block
 * the operation.
 */
export async function deleteBlob(key: string): Promise<void> {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await del(key);
      return;
    }
    await unlink(localPath(key));
  } catch {
    // Ignore: file already gone, or storage unavailable.
  }
}

/** Stores a generated report PDF — a thin, well-named wrapper over putBlob. */
export function storePdf(key: string, buffer: Buffer): Promise<string> {
  return putBlob(key, buffer, "application/pdf");
}
