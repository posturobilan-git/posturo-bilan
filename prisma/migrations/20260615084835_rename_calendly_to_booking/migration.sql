-- Rename Calendly-specific column to a provider-neutral booking id (Cal.com).
ALTER TABLE "Patient" RENAME COLUMN "calendlyEventId" TO "bookingId";
