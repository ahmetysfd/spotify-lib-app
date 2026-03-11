"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ─── Types ───────────────────────────────────────────────────────────
interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
  popularity: number;
  external_urls: { spotify: string };
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  popularity: number;
  duration_ms: number;
  external_urls: { spotify: string };
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
  { key: "short_term", label: "1 Month" },
  { key: "medium_term", label: "6 Months" },
  { key: "long_term", label: "All Time" },
] as const;

const GENRE_COLORS = [
  "#1DB954", "#E8115B", "#FF6437", "#FFD300", "#509BF5",
  "#AF2896", "#148A08", "#F573A0", "#1ED760", "#EB1E32",
  "#8C67AB", "#E91429", "#1E3264", "#E13300", "#B49BC8",
];

// ─── Helpers ─────────────────────────────────────────────────────────
const formatDuration = (ms: number) => {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

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

// ─── Inline Styles (Figma-matched dark Spotify palette) ──────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',sans-serif;background:#121212;color:#fff;-webkit-font-smoothing:antialiased}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
  ::selection{background:rgba(29,185,84,.3)}

  .page{min-height:100vh;padding:20px 24px;max-width:1400px;margin:0 auto}

  /* ── Header ───────────────────────── */
  .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
  .hdr-left{display:flex;align-items:center;gap:10px}
  .hdr-icon{width:34px;height:34px;background:#1DB954;border-radius:10px;display:flex;align-items:center;justify-content:center}
  .hdr-icon svg{width:17px;height:17px;fill:#000}
  .hdr-title{font-size:20px;font-weight:700;letter-spacing:-.3px}
  .hdr-sub{font-size:12px;color:#A0A0A0;margin-top:1px}
  .hdr-right{display:flex;align-items:center;gap:10px}
  .hdr-av{width:28px;height:28px;border-radius:50%;overflow:hidden;background:rgba(29,185,84,.15);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#1DB954}
  .hdr-av img{width:100%;height:100%;object-fit:cover}
  .logout{background:none;border:1px solid #333;color:#777;padding:5px 12px;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;transition:all .2s}
  .logout:hover{border-color:#555;color:#bbb}

  /* ── Time Tabs ────────────────────── */
  .ttabs{display:flex;align-items:center;gap:5px}
  .cal{width:30px;height:30px;background:#282828;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-right:3px}
  .cal svg{width:14px;height:14px;stroke:#888;fill:none;stroke-width:2}
  .ttab{background:transparent;border:1px solid #333;color:#A0A0A0;font-size:12px;font-weight:500;font-family:inherit;padding:6px 16px;border-radius:20px;cursor:pointer;transition:all .2s}
  .ttab:hover{border-color:#555;color:#ccc}
  .ttab.on{background:#1DB954;border-color:#1DB954;color:#000;font-weight:600}

  /* ── Grid ──────────────────────────── */
  .grid{display:grid;grid-template-columns:300px 1fr 1fr;gap:14px;align-items:start}

  /* ── Card base ────────────────────── */
  .c{background:#181818;border-radius:12px;overflow:hidden}

  /* ── #1 Track ─────────────────────── */
  .c1{margin-bottom:14px}
  .c1-lbl{display:flex;align-items:center;gap:6px;padding:14px 16px 10px;font-size:14px;font-weight:600}
  .c1-img{position:relative;margin:0 14px;border-radius:10px;overflow:hidden;aspect-ratio:1}
  .c1-img img{width:100%;height:100%;object-fit:cover;display:block}
  .c1-ov{position:absolute;bottom:0;left:0;right:0;padding:14px 16px;background:linear-gradient(transparent,rgba(0,0,0,.85))}
  .c1-ov .n{font-size:15px;font-weight:600}
  .c1-ov .a{font-size:12px;color:#b3b3b3;margin-top:2px}
  .c1-plays{padding:10px 16px 14px;font-size:12px;color:#555}
  .c1-ph{aspect-ratio:1;margin:0 14px;border-radius:10px;background:linear-gradient(135deg,#1DB954 0%,#191414 100%);display:flex;align-items:center;justify-content:center}
  .c1-ph svg{width:40px;height:40px;fill:rgba(255,255,255,.25)}

  /* ── Genre ─────────────────────────── */
  .cg{margin-bottom:14px}
  .cg-hdr{display:flex;align-items:center;gap:7px;padding:14px 16px 4px;font-size:14px;font-weight:600}
  .cg-sub{font-size:11px;color:#555;padding:0 16px 10px}
  .cg-wrap{display:flex;justify-content:center;padding:4px 12px 0}
  .cg-leg{display:flex;flex-wrap:wrap;gap:5px 10px;padding:12px 16px 14px}
  .cg-dot{display:flex;align-items:center;gap:4px;font-size:10px;color:#999}
  .cg-dot span{width:7px;height:7px;border-radius:50%;flex-shrink:0;display:inline-block}

  /* ── Playlists ────────────────────── */
  .cp-hdr{display:flex;align-items:center;gap:7px;padding:14px 16px 8px;font-size:14px;font-weight:600}
  .cp-list{padding:0 12px 12px}
  .cp-row{display:flex;align-items:center;gap:10px;padding:5px 4px;border-radius:6px;text-decoration:none;color:inherit;transition:background .15s}
  .cp-row:hover{background:#222}
  .cp-art{width:38px;height:38px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#282828}
  .cp-art img{width:100%;height:100%;object-fit:cover}
  .cp-name{font-size:12px;font-weight:500}
  .cp-cnt{font-size:10px;color:#555}

  /* ── Tracks ───────────────────────── */
  .ct{display:flex;flex-direction:column}
  .ct-hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px}
  .ct-hdr .t{font-size:16px;font-weight:700}
  .ct-hdr .s{font-size:11px;color:#555}
  .ct-scroll{overflow-y:auto;max-height:calc(100vh - 110px);padding:0 4px 10px}
  .tr{display:grid;grid-template-columns:26px 38px 1fr auto;align-items:center;gap:10px;padding:6px 14px;border-radius:6px;text-decoration:none;color:inherit;transition:background .15s}
  .tr:hover{background:#222}
  .tr-n{font-size:13px;color:#555;text-align:center}
  .tr-art{width:38px;height:38px;border-radius:5px;overflow:hidden;background:#282828;flex-shrink:0}
  .tr-art img{width:100%;height:100%;object-fit:cover}
  .tr-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tr-artist{font-size:11px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tr-dur{font-size:12px;color:#555;white-space:nowrap}

  /* ── Artists ──────────────────────── */
  .ca{display:flex;flex-direction:column;max-height:calc(100vh - 80px);overflow:hidden}
  .ca-hdr{padding:10px 12px 6px}
  .ca-hdr .t{font-size:16px;font-weight:700}
  .ca-scroll{padding:0 8px 8px;flex:1;display:grid;align-content:start;overflow:hidden}
  .ca-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;max-width:50%;margin:0 auto}
  .ac{text-decoration:none;color:inherit;transition:transform .2s}
  .ac:hover{transform:translateY(-2px)}
  .ac-img{position:relative;width:100%;aspect-ratio:4/3;border-radius:6px;overflow:hidden;background:#282828;margin-bottom:1px}
  .ac-img img{width:100%;height:100%;object-fit:cover}
  .ac-rank{position:absolute;top:5px;left:5px;background:#1DB954;color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;line-height:1.3}
  .ac-name{font-size:9px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ac-genre{font-size:8px;color:#555;margin-top:0;margin-bottom:2px}
  .ac-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:rgba(255,255,255,.3);background:linear-gradient(135deg,#282828,#1a1a1a)}

  /* ── Connect ──────────────────────── */
  .conn{display:flex;align-items:center;justify-content:center;height:70vh}
  .conn-box{text-align:center;max-width:380px}
  .conn-ic{width:68px;height:68px;background:#181818;border:1px solid #282828;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
  .conn-ic svg{width:32px;height:32px;fill:#1DB954}
  .conn-t{font-size:26px;font-weight:700;margin-bottom:8px}
  .conn-s{font-size:13px;color:#888;margin-bottom:28px;line-height:1.5}
  .conn-btn{display:inline-flex;align-items:center;gap:8px;background:#1DB954;color:#000;font-size:14px;font-weight:600;font-family:inherit;padding:11px 28px;border:none;border-radius:30px;cursor:pointer;transition:all .2s;text-decoration:none}
  .conn-btn:hover{background:#1ed760;transform:translateY(-1px);box-shadow:0 8px 24px rgba(29,185,84,.25)}
  .conn-btn svg{width:18px;height:18px;fill:#000}
  .conn-note{font-size:11px;color:#444;margin-top:14px}

  /* ── Loading ──────────────────────── */
  .ld{display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:14px}
  .sp{width:26px;height:26px;border:2px solid #282828;border-top-color:#1DB954;border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .ld-t{font-size:13px;color:#555}

  /* ── Error / Toast ────────────────── */
  .err{background:rgba(232,17,91,.1);border:1px solid rgba(232,17,91,.2);color:#E8115B;padding:10px 16px;border-radius:10px;font-size:13px;margin-bottom:14px}
  .toast{position:fixed;top:16px;right:16px;z-index:100;background:#1DB954;color:#000;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(29,185,84,.3);animation:sd .3s ease}
  @keyframes sd{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

  /* ── Responsive ───────────────────── */
  @media(max-width:1100px){
    .grid{grid-template-columns:1fr 1fr}
    .left-col{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
    .left-col .c1,.left-col .cg,.left-col .c:last-child{margin-bottom:0}
  }
  @media(max-width:768px){
    .page{padding:14px}
    .grid{grid-template-columns:1fr}
    .left-col{display:flex!important;flex-direction:column;grid-column:1}
    .hdr{flex-direction:column;align-items:flex-start;gap:10px}
    .hdr-right{width:100%;justify-content:space-between;flex-wrap:wrap;gap:8px}
    .ct-scroll,.ca-scroll{max-height:500px}
  }
`;

// ─── SVG Components ──────────────────────────────────────────────────
const SpotifyLogo = ({ size = 17 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
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
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [timeRange, setTimeRange] = useState<string>("short_term");
  const [loading, setLoading] = useState(true);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [artists, setArtists] = useState<Record<string, SpotifyArtist[]>>({});
  const [tracks, setTracks] = useState<Record<string, SpotifyTrack[]>>({});
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const sp = searchParams.get("spotify");
    const err = searchParams.get("error");
    if (sp === "connected") { setToast("Spotify connected!"); setTimeout(() => setToast(""), 4000); }
    if (err === "spotify_denied") setError("Spotify authorization was denied.");
    if (err === "spotify_failed") setError("Failed to connect Spotify.");
  }, [searchParams]);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const profileRes = await fetch("/api/spotify/profile");
      if (profileRes.status === 403) { setSpotifyConnected(false); setLoading(false); return; }
      if (!profileRes.ok) throw new Error("Failed to load profile");
      const profileData = await profileRes.json();
      setProfile(profileData);
      setSpotifyConnected(true);

      const sf = async (url: string) => { const r = await fetch(url); return r.ok ? r.json() : { items: [] }; };
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const [aS, tS, rec, pl] = await Promise.all([
        sf("/api/spotify/top-artists?time_range=short_term&limit=50"),
        sf("/api/spotify/top-tracks?time_range=short_term&limit=50"),
        sf("/api/spotify/recently-played?limit=50"),
        sf("/api/spotify/playlists?limit=10"),
      ]);
      const a: Record<string, SpotifyArtist[]> = { short_term: aS?.items || [] };
      const t: Record<string, SpotifyTrack[]> = { short_term: tS?.items || [] };
      setArtists({ ...a }); setTracks({ ...t }); setRecent(rec?.items || []); setPlaylists(pl?.items || []);
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
      setError(e.message || "Failed to load data"); setLoading(false);
    }
  }, []);

  useEffect(() => { if (status === "authenticated") fetchData(); }, [status, fetchData]);

  const currentArtists = artists[timeRange] || [];
  const currentTracks = tracks[timeRange] || [];
  const genreData = getGenreData(currentArtists);
  const topTrack = currentTracks[0];
  const topImg = topTrack?.album?.images?.[0]?.url;
  const timeLabel = TIME_RANGES.find((r) => r.key === timeRange)?.label || "";

  if (status === "loading") return (<><style>{css}</style><div className="ld"><div className="sp" /><div className="ld-t">Loading…</div></div></>);

  return (
    <>
      <style>{css}</style>
      {toast && <div className="toast">{toast}</div>}

      <div className="page">
        {/* ── Header ── */}
        <header className="hdr">
          <div className="hdr-left">
            <div className="hdr-icon">
              <svg viewBox="0 0 24 24" fill="#000" style={{ width: 17, height: 17 }}><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
            </div>
            <div>
              <div className="hdr-title">Your Music Stats</div>
              <div className="hdr-sub">Hey {profile?.display_name || session?.user?.name || "Music Lover"}, here&apos;s your listening activity</div>
            </div>
          </div>
          <div className="hdr-right">
            {spotifyConnected && profile && (
              <div className="hdr-av">
                {profile.images?.[0]?.url ? <img src={profile.images[0].url} alt="" /> : (profile.display_name || "U").charAt(0)}
              </div>
            )}
            <div className="ttabs">
              <div className="cal">
                <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              </div>
              {TIME_RANGES.map((r) => (
                <button key={r.key} className={`ttab ${timeRange === r.key ? "on" : ""}`} onClick={() => setTimeRange(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
            <button className="logout" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
          </div>
        </header>

        {error && <div className="err">{error}</div>}

        {!spotifyConnected && !loading && (
          <div className="conn">
            <div className="conn-box">
              <div className="conn-ic"><SpotifyLogo size={32} /></div>
              <div className="conn-t">Connect Spotify</div>
              <div className="conn-s">Link your Spotify account to see your top artists, tracks, listening history, and personalized insights.</div>
              <a href="/api/spotify/connect" className="conn-btn"><SpotifyLogo size={18} /> Connect with Spotify</a>
              <div className="conn-note">We only read your listening data. We never modify your library.</div>
            </div>
          </div>
        )}

        {loading && <div className="ld"><div className="sp" /><div className="ld-t">Fetching your music data…</div></div>}

        {spotifyConnected && !loading && (
          <div className="grid">
            {/* ═══ LEFT ═══ */}
            <div className="left-col" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* #1 Track */}
              <div className="c c1">
                <div className="c1-lbl"><span style={{ fontSize: 15 }}>🏆</span> #1 Track</div>
                {topTrack ? (
                  <>
                    <div className="c1-img">
                      {topImg ? <img src={topImg} alt={topTrack.name} /> : (
                        <div className="c1-ph"><svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg></div>
                      )}
                      <div className="c1-ov">
                        <div className="n">{topTrack.name}</div>
                        <div className="a">{topTrack.artists?.map(x => x.name).join(", ")}</div>
                      </div>
                    </div>
                    <div className="c1-plays">{recent.length} plays recently</div>
                  </>
                ) : <div style={{ padding: "20px 16px", color: "#444", fontSize: 13 }}>No track data yet</div>}
              </div>

              {/* Genre Breakdown */}
              <div className="c cg">
                <div className="cg-hdr"><span>🎵</span> Genre Breakdown</div>
                <div className="cg-sub">From your top artists · {timeLabel}</div>
                {genreData.length > 0 ? (
                  <>
                    <div className="cg-wrap">
                      <ResponsiveContainer width={190} height={190}>
                        <PieChart>
                          <Pie data={genreData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={48} paddingAngle={3} strokeWidth={0}>
                            {genreData.map((_, i) => <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<GenreTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="cg-leg">
                      {genreData.map((g, i) => (
                        <div key={g.name} className="cg-dot"><span style={{ background: GENRE_COLORS[i % GENRE_COLORS.length] }} />{g.name}</div>
                      ))}
                    </div>
                  </>
                ) : <div style={{ padding: "20px 16px", color: "#444", fontSize: 13 }}>Not enough data</div>}
              </div>

              {/* Playlists */}
              <div className="c">
                <div className="cp-hdr">
                  <svg viewBox="0 0 24 24" fill="#1DB954" style={{ width: 15, height: 15 }}><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                  Your Playlists
                </div>
                <div className="cp-list">
                  {playlists.length > 0 ? playlists.map((pl) => (
                    <a key={pl.id} href={pl.external_urls?.spotify || "#"} target="_blank" rel="noopener noreferrer" className="cp-row">
                      <div className="cp-art">
                        {pl.images?.[0]?.url ? <img src={pl.images[0].url} alt="" /> : <div style={{ width: "100%", height: "100%", background: "#282828" }} />}
                      </div>
                      <div>
                        <div className="cp-name">{pl.name}</div>
                        <div className="cp-cnt">{pl.tracks?.total || 0} tracks</div>
                      </div>
                    </a>
                  )) : <div style={{ padding: "8px 4px", color: "#444", fontSize: 12 }}>No playlists found</div>}
                </div>
              </div>
            </div>

            {/* ═══ CENTER — Top 50 Tracks ═══ */}
            <div className="c ct">
              <div className="ct-hdr">
                <div className="t">Top 50 Tracks</div>
                <div className="s">Scroll for more</div>
              </div>
              <div className="ct-scroll">
                {currentTracks.length > 0 ? currentTracks.map((tr, i) => (
                  <a key={tr.id} href={tr.external_urls?.spotify || "#"} target="_blank" rel="noopener noreferrer" className="tr">
                    <span className="tr-n">{i + 1}</span>
                    <div className="tr-art">
                      {tr.album?.images?.[0]?.url ? <img src={tr.album.images[0].url} alt="" /> : <div style={{ width: "100%", height: "100%", background: "#333" }} />}
                    </div>
                    <div>
                      <div className="tr-name">{tr.name}</div>
                      <div className="tr-artist">{tr.artists?.map(a => a.name).join(", ")}</div>
                    </div>
                    <span className="tr-dur">{formatDuration(tr.duration_ms || 0)}</span>
                  </a>
                )) : <div style={{ padding: 24, color: "#444", fontSize: 13, textAlign: "center" }}>No track data for this period</div>}
              </div>
            </div>

            {/* ═══ RIGHT — Top 10 Artists ═══ */}
            <div className="c ca">
              <div className="ca-hdr"><div className="t">Top 10 Artists</div></div>
              <div className="ca-scroll">
                <div className="ca-grid">
                  {currentArtists.slice(0, 12).map((ar, i) => (
                    <a key={ar.id} href={ar.external_urls?.spotify || "#"} target="_blank" rel="noopener noreferrer" className="ac">
                      <div className="ac-img">
                        {ar.images?.[0]?.url ? <img src={ar.images[0].url} alt={ar.name} /> : <div className="ac-ph">{ar.name.charAt(0)}</div>}
                        <div className="ac-rank">#{i + 1}</div>
                      </div>
                      <div className="ac-name">{ar.name}</div>
                      <div className="ac-genre">{(ar.genres?.[0] || "Artist").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</div>
                    </a>
                  ))}
                </div>
                {currentArtists.length === 0 && <div style={{ padding: 24, color: "#444", fontSize: 13, textAlign: "center" }}>No artist data for this period</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
