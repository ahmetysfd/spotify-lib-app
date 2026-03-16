import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/get-user";
import { spotifyFetch } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");

    if (!ids) {
      return NextResponse.json({ artists: [] });
    }

    const token = await getSpotifyToken();
    const data = await spotifyFetch(`/artists?ids=${ids}`, token);

    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    if (error.message === "NO_SPOTIFY_CONNECTION") {
      return NextResponse.json({ error: "Spotify not connected" }, { status: 403 });
    }
    console.error("Artists fetch error:", error.message);
    return NextResponse.json({ artists: [] });
  }
}
