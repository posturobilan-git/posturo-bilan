import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      intake: true,
      studies: { include: { componentsUsed: true, exercisesPrescribed: true } },
      followups: true,
    },
  });

  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
