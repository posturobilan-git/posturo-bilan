import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

  // Anonymise identity + delete the intake (carries personal/medical data).
  // Studies (measures) and followups (scores) are business data → kept.
  await prisma.$transaction([
    prisma.patientIntake.deleteMany({ where: { patientId: id } }),
    prisma.patient.update({
      where: { id },
      data: {
        email: `anonymized-${id}@deleted.local`,
        firstName: "Anonymisé",
        lastName: "Patient",
        phone: null,
        calendlyEventId: null,
        isAnonymized: true,
      },
    }),
  ]);

  await logAudit({ userId: kine.id, action: "ANONYMIZE", entity: "patient", entityId: id });

  return NextResponse.json({ success: true });
}
