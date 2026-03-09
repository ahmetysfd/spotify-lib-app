import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/get-user";
import { spotifyFetch } from "@/lib/spotify";

export async function GET(req: Request) {
  try {
    const token = await getSpotifyToken();
    const url = new URL(req.url);
    const limit = url.searchParams.get("limit") || "50";

    const data = await spotifyFetch(
      `/me/player/recently-played?limit=${limit}`,
      token
    );
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
