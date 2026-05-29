import "server-only";
import { put, get } from "@vercel/blob";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Stores a PDF and returns its storage *key* (e.g. `reports/<id>.pdf`).
 *
 * The Blob store is PRIVATE: files are never publicly accessible. They are
 * served to authenticated kinés through the streaming route at
 * `/api/reports/[studyId]`, which calls `readReport()` below. The returned key
 * is what gets persisted on `PostureStudy.reportUrl`.
 *
 * - Production / when BLOB_READ_WRITE_TOKEN is set → Vercel Blob (private, durable).
 * - Local dev without a Blob token → writes under `public/` (gitignored).
 */
export async function storePdf(key: string, buffer: Buffer): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { pathname } = await put(key, buffer, {
      access: "private",
      contentType: "application/pdf",
      allowOverwrite: true,
    });
    return pathname;
  }

  // Local filesystem fallback (dev only — Vercel's runtime FS is read-only).
  const absPath = path.join(process.cwd(), "public", key);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);
  return key;
}

/**
 * Reads a stored PDF back as a Buffer, from the private Blob store in the
 * cloud or from the local filesystem in dev. Returns null if not found.
 */
export async function readReport(key: string): Promise<Buffer | null> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const bytes = await new Response(result.stream).arrayBuffer();
    return Buffer.from(bytes);
  }

  try {
    return await readFile(path.join(process.cwd(), "public", key));
  } catch {
    return null;
  }
}

/** True when report delivery uses durable cloud storage. */
export function usingCloudStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
