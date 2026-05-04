import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { Role } from "@/lib/roles";
import { canAccess, getDefaultSection } from "@/lib/roles";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (!userId) return redirectToSignIn();

  const role = (sessionClaims?.metadata as { role?: Role })?.role ?? "ops";
  const pathname = req.nextUrl.pathname;

  if (pathname === "/dashboard" || pathname === "/") {
    const defaultSection = getDefaultSection(role);
    if (defaultSection !== "dashboard") {
      return NextResponse.redirect(
        new URL(`/dashboard/${defaultSection}`, req.url)
      );
    }
    return;
  }

  const sectionMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  if (sectionMatch) {
    const section = sectionMatch[1];
    if (!canAccess(role, section)) {
      const defaultSection = getDefaultSection(role);
      return NextResponse.redirect(
        new URL(`/dashboard/${defaultSection}`, req.url)
      );
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
