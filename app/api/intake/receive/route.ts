import { NextRequest, NextResponse } from "next/server";
import { intakeSchema } from "@/lib/validations/intake.schema";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { verifyN8nRequest } from "@/lib/n8n";

const buildIntakeData = (p: ReturnType<typeof intakeSchema.parse>["patient"], source: string) => ({
  heightCm: p.heightCm,
  weightKg: p.weightKg,
  bikeType: p.bikeType,
  ridingLevel: p.ridingLevel,
  weeklyHours: p.weeklyHours,
  yearsRiding: p.yearsRiding,
  injuries: p.injuries,
  goals: p.goals,
  medicalNotes: p.medicalNotes,
  source,
});

export async function POST(req: NextRequest) {
  if (!verifyN8nRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = intakeSchema.parse(body);
    const intakeData = buildIntakeData(data.patient, data.source);

    const patient = await prisma.patient.upsert({
      where: { email: data.patient.email },
      create: {
        email: data.patient.email,
        firstName: data.patient.firstName,
        lastName: data.patient.lastName,
        phone: data.patient.phone,
        calendlyEventId: data.calendlyEventId,
        kineId: data.kineId,
        status: "intake_completed",
        intake: { create: intakeData },
      },
      update: {
        status: "intake_completed",
        intake: { upsert: { create: intakeData, update: intakeData } },
      },
    });

    // Kine may not have an app User record yet (synced from Clerk separately),
    // so we log against the kineId from the payload.
    await logAudit({
      userId: data.kineId,
      action: "CREATE",
      entity: "patient",
      entityId: patient.id,
      metadata: { source: data.source, via: "webhook" },
    });

    return NextResponse.json({ success: true, patientId: patient.id });
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}
