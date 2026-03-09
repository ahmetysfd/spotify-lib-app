import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/get-user";
import { spotifyFetch } from "@/lib/spotify";

export async function GET(req: Request) {
  try {
    const token = await getSpotifyToken();
    const url = new URL(req.url);
    const timeRange = url.searchParams.get("time_range") || "medium_term";

    // Fetch top 50 artists to get good genre coverage
    const data = await spotifyFetch(
      `/me/top/artists?time_range=${timeRange}&limit=50`,
      token
    );

    // Aggregate genres
    const genreCounts: Record<string, number> = {};
    for (const artist of data.items || []) {
      for (const genre of artist.genres || []) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    }

    const genres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({ genres, totalArtists: data.items?.length || 0 });
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
