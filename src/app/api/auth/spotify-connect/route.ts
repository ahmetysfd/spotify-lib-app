import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSpotifyAuthUrl } from "@/lib/spotify";
import crypto from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
  }

  // Generate state parameter for CSRF protection
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = getSpotifyAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
