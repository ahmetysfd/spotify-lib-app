import { prisma } from "@/lib/prisma";
import { spotifyFetch } from "@/lib/spotify";
import { getSpotifyToken } from "@/lib/get-user";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!(session?.user as { id?: string })?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const token = await getSpotifyToken();

  const data = await spotifyFetch(
    "/me/player/recently-played?limit=50",
    token
  );

  const plays = data?.items || [];

  for (const item of plays) {
    const track = item.track;
    if (!track?.id || !item.played_at) continue;

    const playedAt = new Date(item.played_at);

    const existing = await prisma.dailyTrackStat.findFirst({
      where: {
        userId,
        playedAt,
      },
    });

    if (existing) continue;

    const day = new Date(playedAt);
    day.setHours(0, 0, 0, 0);

    await prisma.dailyTrackStat.create({
      data: {
        userId,
        trackId: track.id,
        trackName: track.name ?? "",
        artistName: track.artists?.[0]?.name ?? "",
        artistId: track.artists?.[0]?.id ?? null,
        albumName: track.album?.name ?? "",
        minutes: Math.round((track.duration_ms ?? 0) / 60000),
        playedAt,
        date: day,
      },
    });
  }

  return Response.json({ status: "ok" });
}
