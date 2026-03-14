import { prisma } from "@/lib/prisma";

export async function saveDailyStats(userId: string, plays: any[]) {
  const rows: {
    userId: string;
    trackId: string;
    trackName: string;
    artistName: string;
    artistId: string | null;
    albumName: string;
    playedAt: Date;
    minutes: number;
    date: Date;
  }[] = [];

  for (const p of plays) {
    const track = p.track;
    if (!track?.id || !p.played_at) continue;

    const playedAt = new Date(p.played_at);
    const date = new Date(playedAt);
    date.setHours(0, 0, 0, 0);

    rows.push({
      userId,
      trackId: track.id,
      trackName: track.name ?? "",
      artistName: track.artists?.[0]?.name ?? "",
      artistId: track.artists?.[0]?.id ?? null,
      albumName: track.album?.name ?? "",
      playedAt,
      minutes: Math.round((track.duration_ms ?? 0) / 60000),
      date,
    });
  }

  if (rows.length === 0) return;

  const timestamps = rows.map((r) => r.playedAt);

  const existing = await prisma.dailyTrackStat.findMany({
    where: {
      userId,
      playedAt: { in: timestamps },
    },
    select: { playedAt: true },
  });

  const existingSet = new Set(
    existing.map((e) => new Date(e.playedAt).toISOString())
  );

  const newRows = rows.filter(
    (r) => !existingSet.has(new Date(r.playedAt).toISOString())
  );

  if (newRows.length > 0) {
    await prisma.dailyTrackStat.createMany({
      data: newRows,
    });
  }
}
