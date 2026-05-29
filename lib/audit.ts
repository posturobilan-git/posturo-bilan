import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  metadata,
}: {
  userId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "VIEW_SENSITIVE" | "EXPORT" | "ANONYMIZE";
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
