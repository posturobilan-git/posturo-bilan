"use client";

import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

/**
 * `NEXT_PUBLIC_CAL_LINK` may be either a bare path (`user/event-slug`, served by
 * the default app.cal.com) or a full URL (e.g. a regional/self-hosted instance
 * like `https://www.cal.eu/user/event-slug`). The embed's `calLink` prop wants
 * the path only; a non-default instance is reached via `calOrigin` + the
 * instance's `embed/embed.js`.
 */
function parseCalLink(raw: string | undefined) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      return { calLink: u.pathname.replace(/^\/+/, ""), origin: u.origin };
    } catch {
      return null;
    }
  }
  return { calLink: raw.replace(/^\/+/, ""), origin: undefined as string | undefined };
}

const cal = parseCalLink(process.env.NEXT_PUBLIC_CAL_LINK);

export function ReservationEmbed() {
  useEffect(() => {
    (async () => {
      const api = await getCalApi({
        namespace: "etude-posturale",
        ...(cal?.origin ? { embedJsUrl: `${cal.origin}/embed/embed.js` } : {}),
      });
      api("ui", { hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, []);

  if (!cal) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-content-muted">
        Réservation non configurée : définissez{" "}
        <code className="text-content">NEXT_PUBLIC_CAL_LINK</code>.
      </div>
    );
  }

  return (
    <Cal
      namespace="etude-posturale"
      calLink={cal.calLink}
      {...(cal.origin ? { calOrigin: cal.origin } : {})}
      style={{ width: "100%", height: "100%", minHeight: 600 }}
      config={{ layout: "month_view" }}
    />
  );
}
