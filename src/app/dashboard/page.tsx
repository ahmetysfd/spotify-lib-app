"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// This page uses client-side hooks like useSearchParams heavily.
// Force dynamic rendering so Next.js doesn't try to prerender it.
export const dynamic = "force-dynamic";

// ─── Types ───────────────────────────────────────────────────────────
interface SpotifyArtist {
  id?: string;
  artistId?: string;
  name: string;
  genres?: string[];
  images?: { url: string }[];
  popularity?: number;
  external_urls?: { spotify: string };
}

interface SpotifyTrack {
  id?: string;
  name?: string;
  trackId?: string;
  trackName?: string;
  artistName?: string;
  artists?: { name: string }[];
  album?: { name: string; images?: { url: string }[] };
  popularity?: number;
  duration_ms?: number;
  external_urls?: { spotify: string };
}

interface RecentItem {
  played_at: string;
  track: SpotifyTrack;
}

interface Playlist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
  external_urls: { spotify: string };
}

// ─── Constants ───────────────────────────────────────────────────────
const TIME_RANGES = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "short_term", label: "1 Month" },
  { key: "medium_term", label: "6 Months" },
  { key: "long_term", label: "1 Year" },
] as const;

const GENRE_COLORS = [
  "#1DB954", "#E8115B", "#FF6437", "#FFD300", "#509BF5",
  "#AF2896", "#148A08", "#F573A0", "#1ED760", "#EB1E32",
  "#8C67AB", "#E91429", "#1E3264", "#E13300", "#B49BC8",
];

// ─── Helpers ─────────────────────────────────────────────────────────
const getGenreData = (artists: SpotifyArtist[]) => {
  const counts: Record<string, number> = {};
  artists.forEach((a) =>
    (a.genres || []).forEach((g) => { counts[g] = (counts[g] || 0) + 1; })
  );
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({
      name: name.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      value,
    }));
};

// ─── Figma-Matched CSS (with ALL design tweaks) ─────────────────────
const css = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:DM Sans,sans-serif;background:#121212;color:#fff;-webkit-font-smoothing:antialiased}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
  ::selection{background:rgba(29,185,84,.3)}

  .page{min-height:100vh;padding:20px 24px;max-width:1440px;margin:0 auto}

  /* ── Header ─────────────────────────── */
  .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
  .hdr-left{display:flex;align-items:center;gap:10px}
  .hdr-icon{width:34px;height:34px;background:#1DB954;border-radius:10px;display:flex;align-items:center;justify-content:center}
  .hdr-icon svg{width:17px;height:17px;fill:#000}
  .hdr-title{font-size:20px;font-weight:700;letter-spacing:-.3px}
  .hdr-sub{font-size:12px;color:#A0A0A0;margin-top:1px}
  .hdr-right{display:flex;align-items:center;gap:10px}
  .hdr-pl{display:flex;align-items:center;gap:10px;margin:0 auto;margin-right:auto;margin-left:0;padding-left:320px}
  .hdr-pl-item{display:flex;align-items:center;gap:8px;background:#181818;border-radius:8px;padding:5px 14px 5px 5px;text-decoration:none;color:inherit;transition:all .2s;border:1px solid #222}
  .hdr-pl-item:hover{border-color:#333;background:#1e1e1e}
  .hdr-pl-art{width:38px;height:38px;border-radius:6px;overflow:hidden;background:#282828;flex-shrink:0}
  .hdr-pl-art img{width:100%;height:100%;object-fit:cover}
  .hdr-pl-name{font-size:11px;font-weight:500;max-width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .hdr-pl-cnt{font-size:9px;color:#555}
  .hdr-pl-add{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px;background:#181818;border:1px dashed #333;cursor:pointer;transition:all .2s}
  .hdr-pl-add:hover{border-color:#555}
  .logout{background:none;border:1px solid #333;color:#777;padding:5px 12px;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;transition:all .2s}
  .logout:hover{border-color:#555;color:#bbb}

  /* ── Time Tabs (Figma pill style) ────── */
  .ttabs{display:flex;align-items:center;gap:0;background:#282828;border-radius:20px;padding:3px}
  .cal{width:30px;height:30px;background:#282828;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-right:6px}
  .cal svg{width:14px;height:14px;stroke:#888;fill:none;stroke-width:2}
  .ttab{background:transparent;border:none;color:#A0A0A0;font-size:12px;font-weight:500;font-family:inherit;padding:7px 18px;border-radius:18px;cursor:pointer;transition:all .2s}
  .ttab:hover{color:#ccc}
  .ttab.on{background:#1DB954;color:#000;font-weight:600}

  /* ── Main 3-column Grid ─────────────── */
  .grid{display:grid;grid-template-columns:300px 1fr 1fr;gap:14px;align-items:start}

  /* ── Card base ──────────────────────── */
  .c{background:#181818;border-radius:12px;overflow:hidden}

  /* ── Genre Donut ────────────────────── */
  .cg{margin-bottom:14px}
  .cg-hdr{display:flex;align-items:center;gap:7px;padding:10px 16px 4px;font-size:14px;font-weight:600}
  .cg-sub{font-size:11px;color:#555;padding:0 16px 10px}
  .cg-wrap{display:flex;justify-content:center;padding:4px 12px 0}
  .cg-leg{display:flex;flex-wrap:wrap;gap:5px 10px;padding:12px 16px 14px}
  .cg-dot{display:flex;align-items:center;gap:4px;font-size:10px;color:#999}
  .cg-dot span{width:7px;height:7px;border-radius:50%;flex-shrink:0;display:inline-block}

  /* ── Top 50 Tracks (center, 3-col grid) ── */
  .ct{display:flex;flex-direction:column}
  .ct-hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px}
  .ct-hdr .t{font-size:16px;font-weight:700}
  .ct-hdr .s{font-size:11px;color:#555}
  .ct-scroll{overflow-y:auto;max-height:calc(100vh - 110px);padding:0 4px 10px}
  .ct-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px 2px;padding:0 4px 10px}
  .tr{display:flex;align-items:center;gap:4px;padding:3px 2px;border-radius:4px;text-decoration:none;color:inherit;transition:background .15s;overflow:hidden}
  .tr:hover{background:#222}
  .tr-n{font-size:9px;color:#555;min-width:12px;text-align:center}
  .tr-art{width:68px;height:68px;border-radius:4px;overflow:hidden;background:#282828;flex-shrink:0}
  .tr-art img{width:100%;height:100%;object-fit:cover}
  .tr-name{font-size:10px;font-weight:500}
  .tr-artist{font-size:8px;color:#555}

  /* ── Top Artists (right, 3-col with scroll) ── */
  .ca{display:flex;flex-direction:column}
  .ca-hdr{padding:10px 12px 6px}
  .ca-hdr .t{font-size:16px;font-weight:700}
  .ca-scroll{overflow-y:auto;max-height:calc(100vh - 110px);padding:0 8px 8px}
  .ca-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
  .ac{text-decoration:none;color:inherit;transition:transform .2s}
  .ac:hover{transform:translateY(-2px)}
  .ac-img{position:relative;width:100%;aspect-ratio:4/3;border-radius:6px;overflow:hidden;background:#282828;margin-bottom:1px}
  .ac-img img{width:100%;height:100%;object-fit:cover}
  .ac-rank{position:absolute;top:5px;left:5px;background:#1DB954;color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;line-height:1.3}
  .ac-name{font-size:9px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ac-genre{font-size:8px;color:#555;margin-top:0;margin-bottom:2px}
  .ac-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:rgba(255,255,255,.3);background:linear-gradient(135deg,#282828,#1a1a1a)}

  /* ── Loading / Error / Toast ─────────── */
  .ld{display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:14px}
  .sp{width:26px;height:26px;border:2px solid #282828;border-top-color:#1DB954;border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .ld-t{font-size:13px;color:#555}
  .err{background:rgba(232,17,91,.1);border:1px solid rgba(232,17,91,.2);color:#E8115B;padding:10px 16px;border-radius:10px;font-size:13px;margin-bottom:14px}
  .toast{position:fixed;top:16px;right:16px;z-index:100;background:#1DB954;color:#000;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(29,185,84,.3);animation:sd .3s ease}
  @keyframes sd{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

  /* ── Responsive ─────────────────────── */
  @media(max-width:1100px){
    .grid{grid-template-columns:1fr 1fr}
    .left-col{grid-column:1/-1;display:grid!important;grid-template-columns:1fr 1fr;gap:14px}
  }
  @media(max-width:768px){
    .page{padding:14px}
    .grid{grid-template-columns:1fr}
    .left-col{display:flex!important;flex-direction:column;grid-column:1}
    .hdr{flex-direction:column;align-items:flex-start;gap:10px}
    .hdr-right{width:100%;justify-content:space-between;flex-wrap:wrap;gap:8px}
    .hdr-pl{padding-left:0}
    .ct-scroll,.ca-scroll{max-height:500px}
  }
`;

// ─── SVG Icons ──────────────────────────────────────────────────────
const MusicNote = ({ size = 17 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="#1DB954" style={{ width: size, height: size }}>
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);

function GenreTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#222", border: "1px solid #333", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,.5)" }}>
      <div style={{ fontWeight: 600 }}>{payload[0]?.name}</div>
      <div style={{ color: "#1DB954", marginTop: 2 }}>{payload[0]?.value} artists</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
function DashboardPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [timeRange, setTimeRange] = useState<string>("short_term");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [artists, setArtists] = useState<Record<string, SpotifyArtist[]>>({});
  const [tracks, setTracks] = useState<Record<string, SpotifyTrack[]>>({});
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [dailyStats, setDailyStats] = useState<{ tracks: any[]; artists: any[]; album: any } | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<{ tracks: any[]; artists: any[]; album: any } | null>(null);
  const [trackImages, setTrackImages] = useState<Record<string, string>>({});
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});
  const [topAlbumImage, setTopAlbumImage] = useState<string>("");

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError("Something went wrong. Please try again.");
  }, [searchParams]);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sf = async (url: string) => { const r = await fetch(url); return r.ok ? r.json() : { items: [] }; };
      const fetchStats = async (type: string) => {
        const r = await fetch(`/api/stats/${type}`);
        return r.ok ? r.json() : { tracks: [], artists: [], album: null };
      };
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const [profileData, aS, tS, rec, pl] = await Promise.all([
        sf("/api/spotify/profile"),
        sf("/api/spotify/top-artists?time_range=short_term&limit=50"),
        sf("/api/spotify/top-tracks?time_range=short_term&limit=50"),
        sf("/api/spotify/recently-played?limit=50"),
        sf("/api/spotify/playlists?limit=10"),
      ]);

      if ((session?.user as { id?: string })?.id) {
        await fetch("/api/spotify/save-daily-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: rec?.items || [] }),
        });
      }

      const dailyStats = await fetchStats("daily");
      const weeklyStats = await fetchStats("weekly");

      setProfile(profileData);
      const a: Record<string, SpotifyArtist[]> = { short_term: aS?.items || [] };
      const t: Record<string, SpotifyTrack[]> = { short_term: tS?.items || [] };
      setArtists({ ...a }); setTracks({ ...t }); setRecent(rec?.items || []); setPlaylists(pl?.items || []);
      setDailyStats(dailyStats); setWeeklyStats(weeklyStats);

      setLoading(false);

      await wait(500);
      const [aM, tM] = await Promise.all([
        sf("/api/spotify/top-artists?time_range=medium_term&limit=50"),
        sf("/api/spotify/top-tracks?time_range=medium_term&limit=50"),
      ]);
      a.medium_term = aM?.items || []; t.medium_term = tM?.items || [];
      setArtists({ ...a }); setTracks({ ...t });

      await wait(500);
      const [aL, tL] = await Promise.all([
        sf("/api/spotify/top-artists?time_range=long_term&limit=50"),
        sf("/api/spotify/top-tracks?time_range=long_term&limit=50"),
      ]);
      a.long_term = aL?.items || []; t.long_term = tL?.items || [];
      setArtists({ ...a }); setTracks({ ...t });
    } catch (e: any) {
      setError(e.message || "Failed to load data");
      setLoading(false);
    }
  }, [(session?.user as { id?: string })?.id]);

  useEffect(() => { if (status === "authenticated") fetchData(); }, [status, fetchData]);

  // ── Derived data (computed before image loaders so they use the same list) ──
  let currentArtists = artists[timeRange] || [];
  let currentTracks = tracks[timeRange] || [];

  if (timeRange === "today" && dailyStats) {
    currentTracks = dailyStats.tracks || [];
    currentArtists = dailyStats.artists || [];
  }
  if (timeRange === "weekly" && weeklyStats) {
    currentTracks = weeklyStats.tracks || [];
    currentArtists = weeklyStats.artists || [];
  }

  useEffect(() => {
    const loadImages = async () => {
      let sourceTracks: any[] = [];
      if (timeRange === "today" && dailyStats) {
        sourceTracks = dailyStats.tracks || [];
      }
      if (timeRange === "weekly" && weeklyStats) {
        sourceTracks = weeklyStats.tracks || [];
      }
      if (sourceTracks.length === 0) return;

      const ids = sourceTracks
        .map((t: any) => t.trackId)
        .filter(Boolean)
        .slice(0, 50)
        .join(",");
      if (!ids) return;

      const res = await fetch(`/api/spotify/tracks?ids=${ids}`);
      const data = await res.json();
      const map: Record<string, string> = {};
      (data.tracks || []).forEach((t: any) => {
        if (t?.id && t.album?.images?.[0]?.url) {
          map[t.id] = t.album.images[0].url;
        }
      });
      setTrackImages((prev) => ({ ...prev, ...map }));
    };
    loadImages();
  }, [timeRange, dailyStats, weeklyStats]);

  useEffect(() => {
    const loadArtistImages = async () => {
      let sourceArtists: any[] = [];
      if (timeRange === "today" && dailyStats) {
        sourceArtists = dailyStats.artists || [];
      }
      if (timeRange === "weekly" && weeklyStats) {
        sourceArtists = weeklyStats.artists || [];
      }
      if (sourceArtists.length === 0) return;

      const ids = sourceArtists
        .map((a: any) => a.id || a.artistId)
        .filter(Boolean)
        .slice(0, 50)
        .join(",");
      if (!ids) return;

      try {
        const res = await fetch(`/api/spotify/artists?ids=${ids}`);
        const data = await res.json();
        const map: Record<string, string> = {};
        (data.artists || []).forEach((a: any) => {
          if (a?.id && a?.images?.[0]?.url) {
            map[a.id] = a.images[0].url;
          }
        });
        if (Object.keys(map).length > 0) {
          setArtistImages((prev) => ({ ...prev, ...map }));
        }
      } catch (e) {
        console.error("Artist image fetch failed", e);
      }
    };
    loadArtistImages();
  }, [timeRange, dailyStats, weeklyStats]);

  useEffect(() => {
    const loadAlbumImage = async () => {
      const album = timeRange === "today" ? dailyStats?.album : timeRange === "weekly" ? weeklyStats?.album : null;
      const trackId = album?.trackId;
      if (!trackId) {
        setTopAlbumImage("");
        return;
      }
      try {
        const res = await fetch(`/api/spotify/tracks?ids=${trackId}`);
        const data = await res.json();
        const track = (data.tracks || [])[0];
        const url = track?.album?.images?.[0]?.url ?? "";
        setTopAlbumImage(url);
      } catch {
        setTopAlbumImage("");
      }
    };
    loadAlbumImage();
  }, [timeRange, dailyStats, weeklyStats]);

  // Aggregate albums from current tracks (for Top Album card)
  const albumMap: Record<string, {
    name: string;
    image?: string;
    count: number;
    minutes: number;
  }> = {};

  currentTracks.forEach((track) => {
    const albumName = track?.album?.name;
    if (!albumName) return;

    if (!albumMap[albumName]) {
      albumMap[albumName] = {
        name: albumName,
        image: track.album?.images?.[0]?.url,
        count: 0,
        minutes: 0,
      };
    }

    albumMap[albumName].count += 1;
    albumMap[albumName].minutes += track.duration_ms || 0;
  });

  const albums = Object.values(albumMap).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.minutes - a.minutes;
  });

  const topAlbum = albums[0];
  const statsAlbum = timeRange === "today" ? dailyStats?.album : timeRange === "weekly" ? weeklyStats?.album : null;
  const mostListenedAlbum = statsAlbum
    ? { name: statsAlbum.name, image: topAlbumImage, minutes: statsAlbum.minutes ?? 0 }
    : topAlbum
      ? { name: topAlbum.name, image: topAlbum.image, minutes: Math.round((topAlbum.minutes ?? 0) / 60000) }
      : null;
  const topTracksList = (timeRange === "today" ? dailyStats?.tracks : timeRange === "weekly" ? weeklyStats?.tracks : null)?.slice(0, 5) ?? [];
  const genreData = getGenreData(currentArtists);
  const timeLabel = TIME_RANGES.find((r) => r.key === timeRange)?.label || "";
  const displayName = profile?.display_name || session?.user?.name || "Music Lover";

  // Listening time: use DB for Today/Weekly (correct counts), Spotify recent for other ranges
  const listeningMinutesToday = (dailyStats?.tracks ?? []).reduce((s, t) => s + (t.minutes ?? 0), 0);
  const listeningMinutesWeekly = (weeklyStats?.tracks ?? []).reduce((s, t) => s + (t.minutes ?? 0), 0);
  const listeningMinutesFromRecent = recent.reduce((s, r) => {
    if (!r.played_at) return s;
    const played = new Date(r.played_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (played >= weekAgo) return s + (r.track?.duration_ms || 0);
    return s;
  }, 0) / 60000;
  const listeningTimeLabel = timeRange === "today" ? "Today" : timeRange === "weekly" ? "Last 7 days" : "Last 7 days";
  const listeningTimeMinutes = timeRange === "today" ? listeningMinutesToday : timeRange === "weekly" ? listeningMinutesWeekly : listeningMinutesFromRecent;
  const listeningTimeSuffix = timeRange === "today" ? "min today" : "min this week";

  if (status === "loading") {
    return <><style>{css}</style><div className="page"><div className="ld"><div className="sp" /><div className="ld-t">Loading…</div></div></div></>;
  }

  return (
    <>
      <style>{css}</style>
      {toast && <div className="toast">{toast}</div>}

      <div className="page">
        {/* ═══ HEADER ═══ */}
        <header className="hdr">
          <div className="hdr-left">
            <div className="hdr-icon"><MusicNote size={17} /></div>
            <div>
              <div className="hdr-title">Your Music Stats</div>
              <div className="hdr-sub">Hey {displayName}, here&apos;s your listening activity</div>
            </div>
          </div>
          <div className="hdr-pl">
        {playlists.slice(0, 1).map((pl) => (
          <a
            key={pl.id}
            href={pl.external_urls?.spotify || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="hdr-pl-item"
            style={{ padding: "5px 14px 5px 5px" }}
          >
            <div className="hdr-pl-art" style={{ width: 76, height: 76, borderRadius: 10 }}>
              {pl.images?.[0]?.url ? (
                <img src={pl.images[0].url} alt="" />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#282828" }} />
              )}
            </div>

            <div>
              <div className="hdr-pl-name" style={{ fontSize: 13, maxWidth: 120 }}>
                {pl.name}
              </div>
              <div className="hdr-pl-cnt" style={{ fontSize: 10 }}>
                {pl.tracks?.total || 0} tracks
              </div>
            </div>
          </a>
        ))}

            <div
              className="hdr-pl-add"
              title="Add playlist"
              style={{ cursor: "pointer", width: 32, height: 32 }}
            >
              <svg viewBox="0 0 24 24" fill="#888" style={{ width: 16, height: 16 }}>
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </div>
          </div>
          <div className="hdr-right">
            <div className="cal">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <div className="ttabs">
              {TIME_RANGES.map((r) => (
                <button key={r.key} className={`ttab${timeRange === r.key ? " on" : ""}`} onClick={() => setTimeRange(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
            <button className="logout" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
          </div>
        </header>

        {error && <div className="err">{error}</div>}

        {/* Loading */}
        {loading && <div className="ld"><div className="sp" /><div className="ld-t">Fetching your music data…</div></div>}

        {/* ═══ MAIN DASHBOARD GRID ═══ */}
        {!loading && (
          <div className="grid">

            {/* ═══ LEFT COLUMN ═══ */}
            <div className="left-col" style={{ display: "flex", flexDirection: "column" }}>

              {/* Listening Time Graph */}
              <div className="c" style={{ padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>📊</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Listening Time</span>
                  </div>
                  <span style={{ fontSize: 10, color: "#555" }}>{listeningTimeLabel}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "8px 0 12px" }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#1DB954" }}>
                    {Math.round(listeningTimeMinutes)}
                  </span>
                  <span style={{ fontSize: 11, color: "#555" }}>{listeningTimeSuffix}</span>
                </div>
                {timeRange === "today" ? (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 8, color: "#777" }}>{Math.round(listeningTimeMinutes)}m</span>
                      <div style={{
                        width: "100%",
                        maxWidth: 28,
                        height: `${Math.max(Math.min((listeningTimeMinutes / 120) * 70, 70), 3)}px`,
                        background: "#1DB954",
                        borderRadius: 4,
                      }} />
                      <span style={{ fontSize: 9, color: "#555" }}>Today</span>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    const days: Record<string, number> = {};
                    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                    const now = new Date();
                    for (let i = 6; i >= 0; i--) {
                      const d = new Date(now);
                      d.setDate(d.getDate() - i);
                      const key = labels[d.getDay() === 0 ? 6 : d.getDay() - 1];
                      days[key] = days[key] || 0;
                    }
                    recent.forEach((r) => {
                      if (!r.played_at) return;
                      const played = new Date(r.played_at);
                      if (played < weekAgo) return;
                      const key = labels[played.getDay() === 0 ? 6 : played.getDay() - 1];
                      if (key in days) days[key] += Math.round((r.track?.duration_ms || 0) / 60000);
                    });
                    const entries = Object.entries(days);
                    const max = Math.max(...entries.map(([, v]) => v), 1);
                    return (
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
                        {entries.map(([day, mins]) => (
                          <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 8, color: "#777" }}>{mins}m</span>
                            <div style={{
                              width: "100%",
                              maxWidth: 28,
                              height: `${Math.max((mins / max) * 70, 3)}px`,
                              background: mins === max ? "#1DB954" : "#282828",
                              borderRadius: 4,
                              transition: "height 0.3s ease",
                            }} />
                            <span style={{ fontSize: 9, color: "#555" }}>{day}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
                {timeRange !== "today" && (
                  <div style={{ marginTop: 10, padding: "8px 0", borderTop: "1px solid #222", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "#444" }}>
                      Est. monthly: ~{Math.round(listeningTimeMinutes * 4)} min
                    </span>
                    <span style={{ fontSize: 10, color: "#444" }}>
                      Est. yearly: ~{Math.round(listeningTimeMinutes * 52 / 60)} hrs
                    </span>
                  </div>
                )}
              </div>

              {/* Genre Breakdown / Most Listened Album */}
              <div className="c cg">
                <div className="cg-hdr"><span>💿</span> Most Listened Album</div>
                {mostListenedAlbum ? (
                  <div className="cg-wrap" style={{ justifyContent: "center", paddingBottom: 16, flexDirection: "column", gap: 0 }}>
                    <div style={{ width: "100%", flex: 1, minHeight: 180, borderRadius: "10px", overflow: "hidden", background: "#282828" }}>
                      {mostListenedAlbum.image ? (
                        <img
                          src={mostListenedAlbum.image}
                          alt={mostListenedAlbum.name || "Top album"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 40 }}>💿</div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 4px 0", minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{mostListenedAlbum.name}</div>
                      {(timeRange === "today" || timeRange === "weekly") && (
                        <div style={{ color: "#A0A0A0", fontSize: 11, flexShrink: 0 }}>{mostListenedAlbum.minutes} min listened</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "20px 16px", color: "#444", fontSize: 13 }}>Not enough data</div>
                )}
              </div>

              {/* Most listened tracks (Today / Weekly) */}
              {topTracksList.length > 0 && (
                <div style={{
                  marginTop: 12,
                  padding: "14px 14px",
                  background: "#181818",
                  borderRadius: "10px",
                  border: "1px solid #282828",
                  minHeight: 180,
                }}>
                  <div style={{ fontSize: 12, color: "#A0A0A0", marginBottom: 10, fontWeight: 500 }}>Most listened tracks</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {topTracksList.map((t: any, i: number) => (
                      <div key={t.trackId || i} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 6, overflow: "hidden", background: "#282828", flexShrink: 0 }}>
                          {trackImages[t.trackId] ? (
                            <img src={trackImages[t.trackId]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 18 }}>♪</div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.trackName || "Track"}</div>
                          <div style={{ color: "#A0A0A0", fontSize: 11, marginTop: 1 }}>{t.artistName || ""}</div>
                        </div>
                        <div style={{ color: "#1DB954", fontSize: 13, flexShrink: 0, fontWeight: 600 }}>{t.plays ?? 0} {(t.plays ?? 0) === 1 ? "time" : "times"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ CENTER — Top 50 Tracks (3-col grid, 68px art, truncated names) ═══ */}
            <div className="c ct">
              <div className="ct-hdr">
                <div className="t">Top 50 Tracks</div>
                <div className="s">Scroll for more</div>
              </div>
              <div className="ct-scroll">
                <div className="ct-grid">
                  {currentTracks.length > 0 ? currentTracks.map((tr, i) => (
                    <a key={tr.id || tr.trackId || i} href={tr.external_urls?.spotify || "#"} target="_blank" rel="noopener noreferrer" className="tr">
                      <span className="tr-n">{i + 1}</span>
                      <div className="tr-art">
                        {(tr.album?.images?.[0]?.url || trackImages[tr.trackId || ""]) ? (
                          <img src={tr.album?.images?.[0]?.url || trackImages[tr.trackId || ""]} alt="" />
                        ) : (
                          <div style={{ width: "100%", height: "100%", background: "#333" }} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="tr-name">
                          {(tr.name || tr.trackName || "").length > 10
                            ? (tr.name || tr.trackName || "").slice(0, 7) + "..."
                            : (tr.name || tr.trackName || "")}
                        </div>
                        <div className="tr-artist">
                          {tr.artists
                            ? tr.artists.map(a => a.name).join(", ").slice(0, 12)
                            : (tr.artistName || "").slice(0, 12)}
                        </div>
                      </div>
                    </a>
                  )) : <div style={{ padding: 24, color: "#444", fontSize: 13, textAlign: "center" }}>No track data for this period</div>}
                </div>
              </div>
            </div>

            {/* ═══ RIGHT — Top Artists (3-col, 15 artists, scrollable) ═══ */}
            <div className="c ca">
              <div className="ca-hdr"><div className="t">Top Artists</div></div>
              <div className="ca-scroll">
                <div className="ca-grid">
                  {currentArtists.slice(0, 15).map((ar, i) => (
                    <a key={ar.id || ar.name || i} href={ar.external_urls?.spotify || (ar.id ? `https://open.spotify.com/artist/${ar.id}` : "#")} target="_blank" rel="noopener noreferrer" className="ac">
                      <div className="ac-img">
                        {(ar.images?.[0]?.url || artistImages[ar.id ?? ""] || artistImages[ar.artistId ?? ""]) ? (
                        <img src={ar.images?.[0]?.url || artistImages[ar.id ?? ""] || artistImages[ar.artistId ?? ""]} alt={ar.name} />
                      ) : (
                        <div className="ac-ph">{ar.name?.charAt(0) || "A"}</div>
                      )}
                        <div className="ac-rank">#{i + 1}</div>
                      </div>
                      <div className="ac-name">{ar.name}</div>
                      <div className="ac-genre">{((ar.genres?.[0] || "Artist") + "").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</div>
                    </a>
                  ))}
                </div>
                {currentArtists.length === 0 && (
                  <div style={{ padding: 24, color: "#444", fontSize: 13, textAlign: "center" }}>No artist data for this period</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Wrap the dashboard in a Suspense boundary so Next.js
// is happy with useSearchParams and other client hooks.
export default function DashboardPage() {
  return (
    <Suspense fallback={<></>}>
      <DashboardPageInner />
    </Suspense>
  );
}
