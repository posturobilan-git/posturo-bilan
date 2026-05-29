import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/intake/(.*)",
  "/api/followup/(.*)",
  "/api/reports/(.*)",
]);

// Public webhooks (n8n) — protected only by API key, so rate-limit by IP.
const isWebhookRoute = createRouteMatcher([
  "/api/intake/(.*)",
  "/api/followup/(.*)",
  "/api/reports/(.*)",
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
