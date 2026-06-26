import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { deleteBlob } from "@/lib/storage";

export async function DELETE(
  req: NextRequest,
  context: RouteContext<"/api/gdpr/anonymize/[id]">
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kine = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!kine || kine.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    select: { isAnonymized: true },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (patient.isAnonymized) {
    return NextResponse.json({ error: "Patient déjà anonymisé" }, { status: 409 });
  }

  // Patient photos are sensitive personal data (prompt 25) → must be deleted on
  // anonymisation, blobs included. Collect their keys before dropping the rows.
  const photos = await prisma.studyPhoto.findMany({
    where: { study: { patientId: id } },
    select: { url: true },
  });

  // Anonymise identity + delete the intake (carries personal/medical data) and
  // the patient photos. Studies (measures) and followups (scores) are business
  // data → kept.
  await prisma.$transaction([
    prisma.patientIntake.deleteMany({ where: { patientId: id } }),
    prisma.studyPhoto.deleteMany({ where: { study: { patientId: id } } }),
    prisma.patient.update({
      where: { id },
      data: {
        email: `anonymized-${id}@deleted.local`,
        firstName: "Anonymisé",
        lastName: "Patient",
        phone: null,
        bookingId: null,
        isAnonymized: true,
      },
    }),
  ]);

  // Remove the underlying blobs (best-effort — orphaned blobs are harmless).
  await Promise.all(photos.map((p) => deleteBlob(p.url)));

  await logAudit({ userId: kine.id, action: "ANONYMIZE", entity: "patient", entityId: id });

  return NextResponse.json({ success: true });
}
