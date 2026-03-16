import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeForTokens, spotifyFetch } from "@/lib/spotify";
import prisma from "@/lib/prisma";

// This route depends on request headers and cannot be prerendered.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !(session.user as any).id) {
      return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Spotify auth error:", error);
      return NextResponse.redirect(
        new URL("/dashboard?error=spotify_denied", process.env.NEXTAUTH_URL!)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/dashboard?error=no_code", process.env.NEXTAUTH_URL!)
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Fetch Spotify user profile
    const spotifyProfile = await spotifyFetch("/me", tokens.access_token);

    // Store tokens and Spotify profile in DB
    await prisma.user.update({
      where: { id: (session.user as any).id },
      data: {
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        spotifyId: spotifyProfile.id,
        spotifyDisplayName: spotifyProfile.display_name,
        spotifyImage: spotifyProfile.images?.[0]?.url || null,
        spotifyProduct: spotifyProfile.product || null,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard?spotify=connected", process.env.NEXTAUTH_URL!)
    );
  } catch (error: any) {
    console.error("Spotify callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard?error=spotify_failed", process.env.NEXTAUTH_URL!)
    );
  }
}
