import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveDailyStats } from "@/lib/saveDailyStats";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json();
    const items = body.items ?? [];

    await saveDailyStats(session.user.id, items);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Save daily stats error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
