import { prisma } from "@/lib/prisma";

export async function saveDailyStats(userId: string, plays: any[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const counts: Record<string, {
    trackId: string;
    trackName: string;
    artistName: string;
    albumName: string;
    plays: number;
    minutes: number;
  }> = {};

  plays.forEach((p) => {
    const track = p.track;
    if (!track) return;

    const id = track.id;

    if (!counts[id]) {
      counts[id] = {
        trackId: track.id,
        trackName: track.name ?? "",
        artistName: track.artists?.[0]?.name ?? "",
        albumName: track.album?.name ?? "",
        plays: 0,
        minutes: 0,
      };
    }

    counts[id].plays += 1;
    counts[id].minutes += Math.round((track.duration_ms ?? 0) / 60000);
  });

  for (const id in counts) {
    const t = counts[id];

    await prisma.dailyTrackStat.upsert({
      where: {
        userId_trackId_date: {
          userId,
          trackId: t.trackId,
          date: today,
        },
      },
      update: {
        plays: { increment: t.plays },
        minutes: { increment: t.minutes },
      },
      create: {
        userId,
        trackId: t.trackId,
        trackName: t.trackName,
        artistName: t.artistName,
        albumName: t.albumName,
        plays: t.plays,
        minutes: t.minutes,
        date: today,
      },
    });
  }
}
