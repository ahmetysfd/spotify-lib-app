import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/get-user";
import { spotifyFetch } from "@/lib/spotify";

export async function GET(req: Request) {
  try {
    const token = await getSpotifyToken();
    const url = new URL(req.url);
    const timeRange = url.searchParams.get("time_range") || "medium_term";
    const limit = url.searchParams.get("limit") || "20";

    const data = await spotifyFetch(
      `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
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
