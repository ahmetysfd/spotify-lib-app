import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/get-user";
import { spotifyFetch } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const token = await getSpotifyToken();
    const url = new URL(req.url);
    const timeRange = url.searchParams.get("time_range") || "medium_term";
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);

    // Reuse top tracks as the source
    const tracksRes = await spotifyFetch(
      `/me/top/tracks?time_range=${timeRange}&limit=50`,
      token
    );

    const albumMap = new Map<
      string,
      {
        albumId: string;
        albumName: string;
        albumImage?: string;
        trackCount: number;
        minutes: number;
        artistName?: string;
      }
    >();

    (tracksRes.items || []).forEach((track: any) => {
      const album = track?.album;
      if (!album?.id) return;

      const albumId = album.id as string;

      if (!albumMap.has(albumId)) {
        albumMap.set(albumId, {
          albumId,
          albumName: album.name,
          albumImage: album.images?.[0]?.url,
          trackCount: 0,
          minutes: 0,
          artistName: album.artists?.[0]?.name,
        });
      }

      const agg = albumMap.get(albumId)!;
      agg.trackCount += 1;
      agg.minutes += (track.duration_ms || 0) / 60000;
    });

    const albums = Array.from(albumMap.values()).sort((a, b) => {
      if (b.trackCount !== a.trackCount) return b.trackCount - a.trackCount;
      return b.minutes - a.minutes;
    });

    return NextResponse.json({ items: albums.slice(0, limit) });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    if (error.message === "NO_SPOTIFY_CONNECTION") {
      return NextResponse.json({ error: "Spotify not connected" }, { status: 403 });
    }
    console.error("Top albums error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

