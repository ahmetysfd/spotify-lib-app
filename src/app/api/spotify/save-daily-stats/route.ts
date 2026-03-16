import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveDailyStats } from "@/lib/saveDailyStats";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json();
    const items = body.items ?? [];

    await saveDailyStats(userId, items);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Save daily stats error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
