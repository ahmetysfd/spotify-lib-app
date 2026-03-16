import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/get-user";
import { spotifyFetch } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await getSpotifyToken();
    const data = await spotifyFetch("/me", token);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    if (error.message === "NO_SPOTIFY_CONNECTION") {
      return NextResponse.json({ error: "Spotify not connected" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
