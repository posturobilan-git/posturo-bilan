import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAndDeliverReport } from "@/lib/report";
import { verifyN8nRequest } from "@/lib/n8n";

export async function POST(req: NextRequest) {
  if (!verifyN8nRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { studyId } = await req.json();
    if (!studyId || typeof studyId !== "string") {
      return NextResponse.json({ error: "studyId required" }, { status: 400 });
    }

    // Attribute the audit log to the study's kiné.
    const study = await prisma.postureStudy.findUnique({
      where: { id: studyId },
      select: { kineId: true },
    });
    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    const result = await generateAndDeliverReport(studyId, study.kineId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true, reportUrl: result.data.reportUrl });
  } catch (e) {
    console.error("POST /api/reports/generate failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
