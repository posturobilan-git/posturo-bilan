import { type NextRequest, NextResponse } from "next/server";
import { requireKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readBlob } from "@/lib/storage";

/**
 * Streams a patient photo to the authenticated kiné who owns the patient (or any
 * ADMIN). The Blob store is private, so this is the only way to read a photo —
 * there is no public URL (RGPD, prompt 25).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let kine;
  try {
    kine = await requireKine();
  } catch {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  const photo = await prisma.studyPhoto.findUnique({
    where: { id },
    select: { url: true, study: { select: { patient: { select: { kineId: true } } } } },
  });

  if (!photo) {
    return new NextResponse("Photo introuvable", { status: 404 });
  }
  if (kine.role !== "ADMIN" && photo.study.patient.kineId !== kine.id) {
    return new NextResponse("Accès refusé", { status: 403 });
  }

  const blob = await readBlob(photo.url);
  if (!blob) {
    return new NextResponse("Photo introuvable", { status: 404 });
  }

  return new NextResponse(new Uint8Array(blob.buffer), {
    headers: {
      "Content-Type": blob.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
