import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "./lib/auth";

// Routes that don't require authentication
const publicRoutes = ["/login", "/registro", "/api/lookup-student", "/api/rfid", "/api/rfid/latest"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // 1. Skip middleware for static assets, API routes (except auth ones we want to protect if any), etc.
  if (
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/favicon.ico") ||
    path.startsWith("/public") ||
    path.includes(".") // Files like .png, .svg
  ) {
    return NextResponse.next();
  }

  // 2. Check for session
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = null;
  
  if (cookie) {
    try {
      session = await decrypt(cookie);
    } catch (e) {
      // Invalided or expired session
      console.error("Session verification failed", e);
    }
  }

  // 3. Handle public routes
  if (publicRoutes.includes(path)) {
    // If logged in and trying to access login/registro page, redirect to home
    if (session && (path === "/login" || path === "/registro")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 4. Protection: If no session, redirect to login
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 5. Role-based protection
  const { role } = session as { role: string };

  if (role === "CELADOR") {
    // Celador is ONLY allowed on the Dashboard (/) and Analytics (/analytics)
    if (path !== "/" && path !== "/analytics") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // 6. Admin has full access
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
