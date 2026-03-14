import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!(session?.user as { id?: string })?.id) {
    return Response.json({ tracks: [], artists: [], album: null });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = await prisma.dailyTrackStat.findMany({
    where: {
      userId: (session.user as { id: string }).id,
      date: { gte: today },
    },
  });

  const trackMap: Record<string, { trackId: string; trackName: string; artistName: string; albumName: string; plays: number; minutes: number }> = {};
  const artistMap: Record<string, { name: string; id: string; plays: number }> = {};
  const albumMap: Record<string, number> = {};

  stats.forEach((s) => {
    const key = s.trackId;
    if (!trackMap[key]) {
      trackMap[key] = {
        trackId: s.trackId,
        trackName: s.trackName,
        artistName: s.artistName,
        albumName: s.albumName,
        plays: 0,
        minutes: 0,
      };
    }
    trackMap[key].plays += 1;
    trackMap[key].minutes += s.minutes;

    if (!artistMap[s.artistName]) {
      artistMap[s.artistName] = {
        name: s.artistName,
        id: s.artistId ?? "",
        plays: 0,
      };
    } else if (!artistMap[s.artistName].id && s.artistId) {
      artistMap[s.artistName].id = s.artistId;
    }
    artistMap[s.artistName].plays += 1;
    albumMap[s.albumName] = (albumMap[s.albumName] || 0) + 1;
  });

  const tracks = Object.values(trackMap)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 50);

  const artists = Object.values(artistMap)
    .sort((a, b) => b.plays - a.plays);

  const album =
    Object.entries(albumMap)
      .map(([name, plays]) => ({ name, plays }))
      .sort((a, b) => b.plays - a.plays)[0] ?? null;

  return Response.json({ tracks, artists, album });
}
