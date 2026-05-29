import { type NextRequest, NextResponse } from "next/server";
import { requireKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readReport } from "@/lib/storage";

/**
 * Streams a generated report PDF to the authenticated kiné who owns the
 * patient (or any ADMIN). The Blob store is private, so this is the only way
 * to read a report — there is no public URL.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const { studyId } = await params;

  let kine;
  try {
    kine = await requireKine();
  } catch {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  const study = await prisma.postureStudy.findUnique({
    where: { id: studyId },
    select: { reportUrl: true, patient: { select: { kineId: true } } },
  });

  if (!study || !study.reportUrl) {
    return new NextResponse("Rapport introuvable", { status: 404 });
  }
  if (kine.role !== "ADMIN" && study.patient.kineId !== kine.id) {
    return new NextResponse("Accès refusé", { status: 403 });
  }

  const pdf = await readReport(study.reportUrl);
  if (!pdf) {
    return new NextResponse("Rapport introuvable", { status: 404 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="rapport-${studyId}.pdf"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
