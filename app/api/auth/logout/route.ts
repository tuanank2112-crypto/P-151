// app/api/auth/logout/route.ts — xoá cookie phiên. Không mở connection,
// không gọi model.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "../../../../lib/auth/session";

export async function POST(request: Request): Promise<NextResponse> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  return NextResponse.redirect(new URL("/login", request.url));
}
