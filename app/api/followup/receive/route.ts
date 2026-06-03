import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { verifyN8nRequest } from "@/lib/n8n";

const followupSchema = z.object({
  patientId: z.string().uuid(),
  source: z.string().default("google_forms"),
  responses: z.object({
    painLevel: z.number().int().min(0).max(10).optional(),
    comfortScore: z.number().int().min(0).max(10).optional(),
    satisfactionScore: z.number().int().min(0).max(10).optional(),
    ridingFrequency: z.string().optional(),
    returningToSport: z.boolean().optional(),
    generalFeedback: z.string().optional(),
  }),
  rawResponses: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  if (!verifyN8nRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = followupSchema.parse(body);

    const followup = await prisma.followup.create({
      data: {
        patientId: data.patientId,
        source: data.source,
        painLevel: data.responses.painLevel,
        comfortScore: data.responses.comfortScore,
        satisfactionScore: data.responses.satisfactionScore,
        ridingFrequency: data.responses.ridingFrequency,
        returningToSport: data.responses.returningToSport,
        generalFeedback: data.responses.generalFeedback,
        rawResponses: data.rawResponses as Prisma.InputJsonValue | undefined,
      },
    });

    // The lifecycle lives on studies now: mark the patient's most recent study
    // that reached the report/follow-up phase as followup_completed.
    const latestStudy = await prisma.study.findFirst({
      where: {
        patientId: data.patientId,
        status: { in: ["report_sent", "followup_pending"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (latestStudy) {
      await prisma.study.update({
        where: { id: latestStudy.id },
        data: { status: "followup_completed" },
      });
    }

    return NextResponse.json({ success: true, followupId: followup.id });
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}
