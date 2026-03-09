"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────
interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
  popularity: number;
  external_urls: { spotify: string };
  followers?: { total: number };
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

// ─── Constants ───────────────────────────────────────────────────────
const TIME_RANGES = [
  { key: "short_term", label: "4 Weeks" },
  { key: "medium_term", label: "6 Months" },
  { key: "long_term", label: "All Time" },
] as const;

const PAGES = [
  { key: "overview", label: "Overview" },
  { key: "artists", label: "Artists" },
  { key: "tracks", label: "Tracks" },
  { key: "recent", label: "Recent" },
  { key: "insights", label: "Insights" },
] as const;

const CHART_COLORS = [
  "#1DB954", "#1ed760", "#e8115b", "#ff6437", "#ffd300",
  "#509bf5", "#af2896", "#148a08", "#f573a0", "#eb1e32",
  "#8c67ab", "#1e3264", "#e13300", "#b49bc8",
];

const AVATAR_COLORS = [
  "#e8115b", "#ff6437", "#ffd300", "#509bf5", "#af2896",
  "#1DB954", "#148a08", "#f573a0", "#1ed760", "#eb1e32",
  "#b3b3b3", "#8c67ab", "#1e3264", "#e13300",
];

// ─── Helpers ─────────────────────────────────────────────────────────
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const getColor = (name: string) => AVATAR_COLORS[hash(name) % AVATAR_COLORS.length];

const formatDuration = (ms: number) => {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatTimeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getGenreData = (artists: SpotifyArtist[]) => {
  const counts: Record<string, number> = {};
  artists.forEach((a) =>
    (a.genres || []).forEach((g) => {
      counts[g] = (counts[g] || 0) + 1;
    })
  );
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({
      name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    }));
};

const getRecentByDay = (recent: RecentItem[]) => {
  const days: Record<string, number> = {};
  recent.forEach((item) => {
    const d = new Date(item.played_at).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    days[d] = (days[d] || 0) + 1;
  });
  return Object.entries(days)
    .reverse()
    .map(([day, plays]) => ({ day, plays }));
};

const getRecentByHour = (recent: RecentItem[]) => {
  const hours = Array(24).fill(0);
  recent.forEach((item) => {
    const h = new Date(item.played_at).getHours();
    hours[h]++;
  });
  return hours.map((count, hour) => ({
    hour: `${hour.toString().padStart(2, "0")}:00`,
    plays: count,
  }));
};

// ─── Custom Tooltip ──────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-neutral-400 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || "#1DB954" }} className="font-semibold">
          {p.value} {p.name || ""}
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [page, setPage] = useState<string>("overview");
  const [timeRange, setTimeRange] = useState<string>("medium_term");
  const [loading, setLoading] = useState(true);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Data
  const [artists, setArtists] = useState<Record<string, SpotifyArtist[]>>({});
  const [tracks, setTracks] = useState<Record<string, SpotifyTrack[]>>({});
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [profile, setProfile] = useState<any>(null);

  // Toast for URL params
  useEffect(() => {
    const spotify = searchParams.get("spotify");
    const err = searchParams.get("error");
    if (spotify === "connected") {
      setToast("Spotify connected successfully!");
      setTimeout(() => setToast(""), 4000);
    }
    if (err === "spotify_denied") {
      setError("Spotify authorization was denied.");
    }
    if (err === "spotify_failed") {
      setError("Failed to connect Spotify. Please try again.");
    }
  }, [searchParams]);

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch all Spotify data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Check profile first
      const profileRes = await fetch("/api/spotify/profile");
      if (profileRes.status === 403) {
        setSpotifyConnected(false);
        setLoading(false);
        return;
      }
      if (!profileRes.ok) throw new Error("Failed to load profile");

      const profileData = await profileRes.json();
      setProfile(profileData);
      setSpotifyConnected(true);

      // Fetch all data in parallel
      const fetches = await Promise.all([
        ...TIME_RANGES.flatMap((r) => [
          fetch(`/api/spotify/top-artists?time_range=${r.key}&limit=50`).then((res) =>
            res.ok ? res.json() : { items: [] }
          ),
          fetch(`/api/spotify/top-tracks?time_range=${r.key}&limit=50`).then((res) =>
            res.ok ? res.json() : { items: [] }
          ),
        ]),
        fetch("/api/spotify/recently-played?limit=50").then((res) =>
          res.ok ? res.json() : { items: [] }
        ),
      ]);

      const a: Record<string, SpotifyArtist[]> = {};
      const t: Record<string, SpotifyTrack[]> = {};

      TIME_RANGES.forEach((r, i) => {
        a[r.key] = fetches[i * 2]?.items || [];
        t[r.key] = fetches[i * 2 + 1]?.items || [];
      });

      setArtists(a);
      setTracks(t);
      setRecent(fetches[fetches.length - 1]?.items || []);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, fetchData]);

  // Derived
  const currentArtists = artists[timeRange] || [];
  const currentTracks = tracks[timeRange] || [];
  const genreData = getGenreData(currentArtists);
  const recentByDay = getRecentByDay(recent);
  const recentByHour = getRecentByHour(recent);
  const uniqueRecentArtists = new Set(recent.map((r) => r.track?.artists?.[0]?.name)).size;
  const totalMinutes = Math.round(
    recent.reduce((sum, r) => sum + (r.track?.duration_ms || 0), 0) / 60000
  );

  const popularityData = currentArtists.slice(0, 12).map((a, i) => ({
    name: a.name.length > 14 ? a.name.slice(0, 14) + "…" : a.name,
    popularity: a.popularity,
  }));

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#2a2a2a] border-t-spotify-green rounded-full animate-spin" />
          <span className="text-neutral-500 text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  // ── Not Connected to Spotify ──
  const renderConnectScreen = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-[#141414] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 fill-spotify-green" viewBox="0 0 24 24">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>
        <h2
          className="text-3xl font-bold mb-3"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Connect Spotify
        </h2>
        <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
          Link your Spotify account to see your top artists, tracks,
          listening history, and personalized insights.
        </p>
        <a
          href="/api/spotify/connect"
          className="inline-flex items-center gap-3 bg-spotify-green hover:bg-spotify-green-light text-black font-semibold px-8 py-3.5 rounded-full text-sm transition-all hover:shadow-lg hover:shadow-spotify-green/20"
        >
          <svg className="w-5 h-5 fill-black" viewBox="0 0 24 24">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Connect with Spotify
        </a>
        <p className="text-neutral-600 text-xs mt-4">
          We only read your listening data. We never modify your library.
        </p>
      </div>
    </div>
  );

  // ── Time Range Tabs ──
  const TimeRangeTabs = () => (
    <div className="inline-flex bg-[#141414] rounded-xl p-1 gap-0.5 mb-6">
      {TIME_RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => setTimeRange(r.key)}
          className={`px-5 py-2 rounded-lg text-xs font-medium transition-all ${
            timeRange === r.key
              ? "bg-spotify-green text-black font-semibold"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  // ── Artist Card ──
  const ArtistCard = ({ artist, rank }: { artist: SpotifyArtist; rank: number }) => (
    <a
      href={artist.external_urls?.spotify || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 hover:border-[#333] hover:-translate-y-0.5 transition-all duration-200 block"
    >
      <span className="text-[10px] font-bold text-neutral-600">#{rank}</span>
      <div className="mt-2 mb-3 mx-auto w-[72px] h-[72px] rounded-full overflow-hidden">
        {artist.images?.[0]?.url ? (
          <img
            src={artist.images[0].url}
            alt={artist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-xl font-bold text-black"
            style={{
              background: `linear-gradient(135deg, ${getColor(artist.name)}, ${getColor(artist.name)}88)`,
            }}
          >
            {artist.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold truncate">{artist.name}</div>
        <div className="text-[11px] text-neutral-500 truncate mt-0.5">
          {artist.genres?.[0] || "Artist"}
        </div>
      </div>
    </a>
  );

  // ── Track Row ──
  const TrackRow = ({ track, rank }: { track: SpotifyTrack; rank: number }) => (
    <a
      href={track.external_urls?.spotify || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[32px_40px_1fr_1fr_56px_36px] md:grid-cols-[32px_40px_1fr_1fr_56px_36px] items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#141414] transition-colors group"
    >
      <span className="text-xs text-neutral-500 text-center font-medium">{rank}</span>
      <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
        {track.album?.images?.[0]?.url ? (
          <img src={track.album.images[0].url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-sm font-bold text-black rounded-md"
            style={{ background: getColor(track.name) }}
          >
            {track.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate group-hover:text-spotify-green transition-colors">
          {track.name}
        </div>
        <div className="text-xs text-neutral-500 truncate">
          {track.artists?.map((a) => a.name).join(", ")}
        </div>
      </div>
      <div className="text-xs text-neutral-500 truncate hidden md:block">
        {track.album?.name}
      </div>
      <div className="text-xs text-neutral-500 text-right">
        {formatDuration(track.duration_ms || 0)}
      </div>
      <div className="w-8 h-8 rounded-full bg-spotify-green/10 flex items-center justify-center">
        <span className="text-[10px] font-bold text-spotify-green">{track.popularity}</span>
      </div>
    </a>
  );

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-spotify-green text-black px-5 py-3 rounded-xl text-sm font-medium shadow-xl shadow-spotify-green/20 animate-fade-up">
          {toast}
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-[#0a0a0a]/85 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-spotify-green rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 fill-black" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </div>
              <span
                className="text-lg font-semibold hidden sm:block"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Library
              </span>
            </div>

            {/* Nav Tabs */}
            <div className="hidden md:flex items-center gap-1">
              {PAGES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPage(p.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    page === p.key
                      ? "bg-[#1a1a1a] text-white"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {spotifyConnected && profile && (
              <div className="hidden sm:flex items-center gap-2.5">
                {profile.images?.[0]?.url ? (
                  <img
                    src={profile.images[0].url}
                    alt=""
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-spotify-green/15 flex items-center justify-center text-xs font-semibold text-spotify-green">
                    {(profile.display_name || "U").charAt(0)}
                  </div>
                )}
                <span className="text-xs text-neutral-400 font-medium">
                  {profile.display_name}
                </span>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-neutral-500 hover:text-neutral-300 text-xs border border-[#2a2a2a] hover:border-[#444] px-3 py-1.5 rounded-lg transition-all"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {PAGES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPage(p.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                page === p.key
                  ? "bg-[#1a1a1a] text-white"
                  : "text-neutral-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      {!spotifyConnected && !loading ? (
        renderConnectScreen()
      ) : loading ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#2a2a2a] border-t-spotify-green rounded-full animate-spin" />
            <span className="text-neutral-500 text-sm">
              Fetching your music data…
            </span>
          </div>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          {/* ════════════════════ OVERVIEW ════════════════════ */}
          {page === "overview" && (
            <div className="space-y-10 animate-fade-up">
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                    #1 Artist
                  </div>
                  <div
                    className="text-xl font-semibold truncate"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {currentArtists[0]?.name || "—"}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {TIME_RANGES.find((r) => r.key === timeRange)?.label}
                  </div>
                </div>
                <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                    #1 Track
                  </div>
                  <div
                    className="text-xl font-semibold truncate"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {currentTracks[0]?.name || "—"}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {currentTracks[0]?.artists?.[0]?.name || "—"}
                  </div>
                </div>
                <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                    Recent Artists
                  </div>
                  <div
                    className="text-3xl font-semibold"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {uniqueRecentArtists}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    in last 50 plays
                  </div>
                </div>
                <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                    Minutes Played
                  </div>
                  <div
                    className="text-3xl font-semibold"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {totalMinutes}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    from recent history
                  </div>
                </div>
              </div>

              <TimeRangeTabs />

              {/* Top Artists Preview */}
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h2
                    className="text-2xl font-semibold"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Top Artists
                  </h2>
                  <button
                    onClick={() => setPage("artists")}
                    className="text-xs text-spotify-green hover:underline"
                  >
                    View all →
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {currentArtists.slice(0, 6).map((a, i) => (
                    <ArtistCard key={a.id} artist={a} rank={i + 1} />
                  ))}
                </div>
              </section>

              {/* Top Tracks Preview */}
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h2
                    className="text-2xl font-semibold"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Top Tracks
                  </h2>
                  <button
                    onClick={() => setPage("tracks")}
                    className="text-xs text-spotify-green hover:underline"
                  >
                    View all →
                  </button>
                </div>
                <div>
                  {currentTracks.slice(0, 8).map((t, i) => (
                    <TrackRow key={t.id} track={t} rank={i + 1} />
                  ))}
                </div>
              </section>

              {/* Recent Preview */}
              {recent.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-5">
                    <h2
                      className="text-2xl font-semibold"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Recently Played
                    </h2>
                    <button
                      onClick={() => setPage("recent")}
                      className="text-xs text-spotify-green hover:underline"
                    >
                      View all →
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {recent.slice(0, 8).map((item, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#141414] transition-colors"
                      >
                        <div className="w-10 h-10 rounded-md overflow-hidden">
                          {item.track?.album?.images?.[0]?.url ? (
                            <img
                              src={item.track.album.images[0].url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full rounded-md flex items-center justify-center text-sm font-bold text-black"
                              style={{ background: getColor(item.track?.name || "A") }}
                            >
                              {(item.track?.name || "A").charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {item.track?.name}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {item.track?.artists?.map((a: any) => a.name).join(", ")}
                          </div>
                        </div>
                        <span className="text-xs text-neutral-600 whitespace-nowrap">
                          {formatTimeAgo(item.played_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ════════════════════ ARTISTS ════════════════════ */}
          {page === "artists" && (
            <div className="animate-fade-up">
              <h2
                className="text-3xl font-semibold mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Top Artists
              </h2>
              <p className="text-neutral-500 text-sm mb-6">
                Your most-listened artists ranked by play frequency
              </p>
              <TimeRangeTabs />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {currentArtists.map((a, i) => (
                  <ArtistCard key={a.id} artist={a} rank={i + 1} />
                ))}
              </div>
              {currentArtists.length === 0 && (
                <p className="text-neutral-500 text-sm mt-8 text-center">
                  No artist data available for this time range.
                </p>
              )}
            </div>
          )}

          {/* ════════════════════ TRACKS ════════════════════ */}
          {page === "tracks" && (
            <div className="animate-fade-up">
              <h2
                className="text-3xl font-semibold mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Top Tracks
              </h2>
              <p className="text-neutral-500 text-sm mb-6">
                Your most-played tracks with popularity scores
              </p>
              <TimeRangeTabs />
              <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[32px_40px_1fr_1fr_56px_36px] items-center gap-3 px-3 py-2.5 border-b border-[#1e1e1e]">
                  <span className="text-[10px] text-neutral-600 text-center">#</span>
                  <span />
                  <span className="text-[10px] text-neutral-600 uppercase tracking-wider">Title</span>
                  <span className="text-[10px] text-neutral-600 uppercase tracking-wider hidden md:block">Album</span>
                  <span className="text-[10px] text-neutral-600 uppercase tracking-wider text-right">Time</span>
                  <span className="text-[10px] text-neutral-600 text-center">Pop</span>
                </div>
                {currentTracks.map((t, i) => (
                  <TrackRow key={t.id} track={t} rank={i + 1} />
                ))}
              </div>
              {currentTracks.length === 0 && (
                <p className="text-neutral-500 text-sm mt-8 text-center">
                  No track data available for this time range.
                </p>
              )}
            </div>
          )}

          {/* ════════════════════ RECENT ════════════════════ */}
          {page === "recent" && (
            <div className="animate-fade-up">
              <h2
                className="text-3xl font-semibold mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Recently Played
              </h2>
              <p className="text-neutral-500 text-sm mb-6">
                Your last 50 plays from Spotify
              </p>
              <div className="space-y-0.5">
                {recent.map((item, i) => (
                  <a
                    key={i}
                    href={item.track?.external_urls?.spotify || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#141414] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                      {item.track?.album?.images?.[0]?.url ? (
                        <img src={item.track.album.images[0].url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full rounded-md flex items-center justify-center text-sm font-bold text-black"
                          style={{ background: getColor(item.track?.name || "A") }}
                        >
                          {(item.track?.name || "A").charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{item.track?.name}</div>
                      <div className="text-xs text-neutral-500 truncate">
                        {item.track?.artists?.map((a: any) => a.name).join(", ")}
                        {" · "}
                        {item.track?.album?.name}
                      </div>
                    </div>
                    <span className="text-xs text-neutral-600 whitespace-nowrap pl-4">
                      {formatTimeAgo(item.played_at)}
                    </span>
                  </a>
                ))}
              </div>
              {recent.length === 0 && (
                <p className="text-neutral-500 text-sm mt-8 text-center">
                  No recent play history available.
                </p>
              )}
            </div>
          )}

          {/* ════════════════════ INSIGHTS ════════════════════ */}
          {page === "insights" && (
            <div className="animate-fade-up">
              <h2
                className="text-3xl font-semibold mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Listening Insights
              </h2>
              <p className="text-neutral-500 text-sm mb-6">
                Charts and patterns from your listening data
              </p>
              <TimeRangeTabs />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Plays by Day */}
                {recentByDay.length > 0 && (
                  <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-1">Plays by Day</h3>
                    <p className="text-xs text-neutral-500 mb-5">From your last 50 plays</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={recentByDay}>
                        <XAxis dataKey="day" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="plays" fill="#1DB954" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Genre Breakdown */}
                {genreData.length > 0 && (
                  <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-1">Genre Breakdown</h3>
                    <p className="text-xs text-neutral-500 mb-5">
                      From your top artists · {TIME_RANGES.find((r) => r.key === timeRange)?.label}
                    </p>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={genreData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          innerRadius={40}
                          paddingAngle={2}
                        >
                          {genreData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                      {genreData.map((g, i) => (
                        <div key={g.name} className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                          <div
                            className="w-2 h-2 rounded-sm flex-shrink-0"
                            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          {g.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Listening by Hour */}
                {recent.length > 0 && (
                  <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-1">Listening by Hour</h3>
                    <p className="text-xs text-neutral-500 mb-5">When you listen most</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={recentByHour}>
                        <XAxis dataKey="hour" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                        <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="plays"
                          stroke="#1DB954"
                          fill="rgba(29,185,84,0.15)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Artist Popularity */}
                {popularityData.length > 0 && (
                  <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-1">Artist Popularity</h3>
                    <p className="text-xs text-neutral-500 mb-5">
                      Spotify popularity index · {TIME_RANGES.find((r) => r.key === timeRange)?.label}
                    </p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={popularityData} layout="vertical">
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: "#999", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={100}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="popularity" fill="#1DB954" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 md:px-8 py-8 border-t border-[#141414] text-center">
        <p className="text-neutral-600 text-xs">
          Data provided by Spotify Web API · Not affiliated with Spotify AB
        </p>
      </footer>
    </div>
  );
}
