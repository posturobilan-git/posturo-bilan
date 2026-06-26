import { NextResponse } from "next/server";
import { requireKine } from "@/lib/auth";
import { isLocalEnv } from "@/lib/env";
import { putBlob } from "@/lib/storage";

// Patient photo upload (prompt 25). The browser sends the already-resized JPEG
// (≤2000px, a few hundred KB) and the server stores it through the shared storage
// layer: PRIVATE Vercel Blob in deployments, local filesystem in dev — exactly
// like report PDFs, so photos are testable locally without a Blob token.
//
// Persistence of the StudyPhoto row happens with the study (saveDraftStudy /
// submitStudy); this route just returns the stored key.

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo / fichier
const ALLOWED = new Set(["image/jpeg", "image/png"]);

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireKine();
  } catch {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Deployments must use durable Blob storage; local writes to the filesystem.
  if (!isLocalEnv() && !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Stockage des fichiers non configuré (BLOB_READ_WRITE_TOKEN manquant)." },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Format non pris en charge." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)." }, { status: 413 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const key = `studies/photos/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await putBlob(key, buffer, file.type);
  } catch (e) {
    console.error("photo upload failed:", e);
    return NextResponse.json({ error: "Échec du stockage de la photo." }, { status: 500 });
  }

  return NextResponse.json({ key });
}
