import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/accueil/(.*)",
  "/suivi/(.*)",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  // Report PDF stream: not behind Clerk's auto-protect (it self-enforces and
  // returns 401/403 rather than redirecting).
  "/api/reports/(.*)",
]);

// Routes authenticated by their own secret (Calendly signature, cron bearer)
// rather than a Clerk session — rate-limit by IP to blunt abuse.
const isWebhookRoute = createRouteMatcher([
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (isWebhookRoute(req)) {
    const ip = clientIp(req.headers);
    const { success, remaining, resetAt } = rateLimit(`webhook:${ip}`, { max: 100 });
    if (!success) {
      return NextResponse.json(
        { error: "Too Many Requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": String(remaining),
          },
        }
      );
    }
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|pdf|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
