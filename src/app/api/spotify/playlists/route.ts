import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/get-user";
import { spotifyFetch } from "@/lib/spotify";

export async function GET(req: Request) {
  try {
    const token = await getSpotifyToken();
    const url = new URL(req.url);
    const limit = url.searchParams.get("limit") || "20";

    const profileRes = await spotifyFetch("/me", token);
    const myId = profileRes.id;
    const data = await spotifyFetch(
      `/me/playlists?limit=50`,
      token
    );
    const myPlaylists = (data.items || []).filter(
      (pl: any) =>
        pl.owner?.id === myId &&
        pl.public !== false &&
        pl.collaborative === false
    );
    return NextResponse.json({ items: myPlaylists.slice(0, parseInt(limit)) });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    if (error.message === "NO_SPOTIFY_CONNECTION") {
      return NextResponse.json({ error: "Spotify not connected" }, { status: 403 });
    }
    console.error("Playlists error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
