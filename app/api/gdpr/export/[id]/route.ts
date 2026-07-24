import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { decryptFields } from "@/lib/crypto";
import { PATIENT_ENCRYPTED_FIELDS, INTAKE_ENCRYPTED_FIELDS } from "@/lib/crypto.constants";

export async function GET(
  req: NextRequest,
  context: RouteContext<"/api/gdpr/export/[id]">
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kine = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!kine || kine.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const raw = await prisma.patient.findUnique({
    where: { id },
    include: {
      intake: true,
      studies: {
        include: {
          componentsUsed: { include: { category: { select: { name: true } } } },
          exercisesPrescribed: true,
          pains: { orderBy: { order: "asc" } },
        },
      },
      followups: true,
    },
  });

  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Export RGPD = droit d'accès du patient à ses données réelles → déchiffrer.
  const patient = {
    ...decryptFields(raw, PATIENT_ENCRYPTED_FIELDS),
    intake: raw.intake ? decryptFields(raw.intake, INTAKE_ENCRYPTED_FIELDS) : null,
  };

  await logAudit({ userId: kine.id, action: "EXPORT", entity: "patient", entityId: id });

  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), patient },
    null,
    2
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="export-${id}.json"`,
    },
  });
}
