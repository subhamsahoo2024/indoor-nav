/**
 * NextAuth.js proxy for Route Protection
 * Location: proxy.ts (ROOT directory - outside src/ and app/)
 *
 * IMPORTANT: This file MUST be in the project root directory
 * It protects all /admin routes by requiring authentication
 */

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configure which routes require authentication
export const config = {
  // Protect all admin routes and their sub-paths
  matcher: ["/admin/:path*"],
};
