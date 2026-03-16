import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSpotifyTokenForUserId } from "@/lib/get-user";
import { spotifyFetch } from "@/lib/spotify";
import { saveDailyStats } from "@/lib/saveDailyStats";

/**
 * Cron job: fetch recently played from Spotify for all users with a linked
 * Spotify account and save to the database. Run once per day at midnight so you don't
 * lose track even when the app isn't open (Spotify only exposes last 50 recent plays).
 *
 * Secured by CRON_SECRET: caller must send Authorization: Bearer <CRON_SECRET>
 * or x-cron-secret: <CRON_SECRET>.
 */
export async function GET(req: Request) {
  return runCollector(req);
}

export async function POST(req: Request) {
  return runCollector(req);
}

async function runCollector(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const headerSecret = req.headers.get("x-cron-secret");
    if (bearer !== secret && headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const accounts = await prisma.account.findMany({
    where: {
      provider: "spotify",
      refresh_token: { not: null },
    },
    select: { userId: true },
  });

  const userIds = [...new Set(accounts.map((a) => a.userId))];
  let processed = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    try {
      const token = await getSpotifyTokenForUserId(userId);
      if (!token) {
        errors.push(`User ${userId}: no token`);
        continue;
      }

      const data = await spotifyFetch(
        "/me/player/recently-played?limit=50",
        token
      );
      const items = data?.items ?? [];
      if (items.length > 0) {
        await saveDailyStats(userId, items);
      }
      processed += 1;
    } catch (e: any) {
      errors.push(`User ${userId}: ${e?.message ?? "unknown"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    usersProcessed: processed,
    totalUsers: userIds.length,
    errors: errors.length ? errors : undefined,
  });
}
