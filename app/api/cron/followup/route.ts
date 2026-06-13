import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendFollowupEmail } from "@/lib/emails";

/**
 * Daily Vercel Cron (see vercel.json) that sends the J+30 follow-up email.
 *
 * Protected by `Authorization: Bearer ${CRON_SECRET}`. Selects studies still in
 * `report_sent` whose report was sent ~30 days ago (J+29 to J+31 window), and
 * sends each its follow-up link (which advances them to `followup_pending`).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const from = new Date(now - 31 * day);
  const to = new Date(now - 29 * day);

  const eligible = await prisma.study.findMany({
    where: {
      status: "report_sent",
      reportSentAt: { gte: from, lte: to },
    },
    select: { id: true },
  });

  let sent = 0;
  const failed: { studyId: string; error: string }[] = [];
  for (const study of eligible) {
    const result = await sendFollowupEmail(study.id);
    if (result.ok) sent += 1;
    else failed.push({ studyId: study.id, error: result.error });
  }

  return NextResponse.json({ eligible: eligible.length, sent, failed });
}
