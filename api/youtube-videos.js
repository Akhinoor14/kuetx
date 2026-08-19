// api/youtube-videos.js — Vercel Serverless Function
//
// Landing page video showcase (owner ask, this session): a rotating
// card on the landing page that plays KUETx's own YouTube videos
// in-place. Fetching the channel's video list requires the YouTube
// Data API v3, which requires an API key — that key can NEVER be
// shipped to the browser (Vite bundles anything prefixed VITE_ into
// the public JS, so it would be readable by anyone via DevTools).
// This Function is the fix: it runs server-side on Vercel, reads the
// key from a NON-VITE_-prefixed env var (so it's Vercel-only, never
// bundled into the client), calls YouTube on the browser's behalf,
// and returns only the safe, minimal fields the UI actually needs
// (video id + title). The browser never sees the API key.
//
// Env var required (Vercel dashboard -> Settings -> Environment
// Variables): YOUTUBE_API_KEY — see this repo's README/CHANGES for
// the value. Deliberately NOT named VITE_YOUTUBE_API_KEY — that
// prefix is what tells Vite to bundle it into client code, which is
// exactly what must NOT happen here.
//
// Caching: YouTube Data API v3's free daily quota is limited (10,000
// units/day; a single "channel uploads" list-fetch costs a handful of
// units per call), and without caching every landing-page visit would
// burn quota. This Function sets a `Cache-Control` header so Vercel's
// edge network (and browsers) can reuse the same response for a few
// hours — see CACHE_SECONDS below — instead of hitting YouTube on
// every request. This mirrors the caching pattern already used in
// cloudflare-worker/src/index.js (that Worker caches Google's JWKS
// for an hour) and service-images-worker, just via HTTP cache headers
// instead of an in-memory module variable, since Vercel Functions are
// not guaranteed to stay warm between invocations the way a Worker
// isolate can.
//
// KUETx's channel: https://www.youtube.com/@KUETxofficial
// Channel ID (resolved once, hardcoded below so this Function doesn't
// need an extra API call just to resolve the @handle -> ID each time):
const CHANNEL_ID = 'UCs0oX6NA-FTkuCGH555UVtg';

// How many of the channel's most recent uploads to return. Keep this
// modest — the UI only shows one at a time in a rotating card, this
// is just the pool it rotates through.
const MAX_RESULTS = 8;

// How long Vercel's edge cache (and browsers) may reuse a response
// before re-checking YouTube. 6 hours is a reasonable balance: a new
// upload shows up on the landing page within a few hours, without
// spending quota on every visitor.
const CACHE_SECONDS = 6 * 60 * 60;

export default async function handler(req, res) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    // Fails loudly in logs (missing env var is a deploy misconfig, not
    // a runtime fluke) but returns a clean empty list to the browser
    // so the landing page's VideoShowcase component can just hide
    // itself rather than showing a broken player.
    console.error('[api/youtube-videos] YOUTUBE_API_KEY is not set in this deployment\'s environment variables.');
    res.status(200).json({ videos: [] });
    return;
  }

  try {
    // Step 1: resolve the channel's "uploads" playlist ID. Every
    // YouTube channel has one auto-generated playlist containing all
    // of its uploads in order — fetching THIS playlist's items is the
    // standard, quota-cheap way to list a channel's videos (cheaper
    // than YouTube's search.list endpoint, which costs far more quota
    // per call for the same result).
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${apiKey}`;
    const channelRes = await fetch(channelUrl);
    const channelData = await channelRes.json();

    const uploadsPlaylistId =
      channelData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      console.error('[api/youtube-videos] Could not resolve uploads playlist for channel', CHANNEL_ID, channelData);
      res.status(200).json({ videos: [] });
      return;
    }

    // Step 2: fetch the most recent items from that uploads playlist.
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${MAX_RESULTS}&key=${apiKey}`;
    const playlistRes = await fetch(playlistUrl);
    const playlistData = await playlistRes.json();

    const videos = (playlistData?.items || [])
      // A playlist item can reference a video that was later deleted
      // or made private — its videoId still resolves but the video
      // itself no longer plays, so guard against a missing id.
      .filter((item) => item?.snippet?.resourceId?.videoId)
      .map((item) => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
      }));

    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`
    );
    res.status(200).json({ videos });
  } catch (err) {
    console.error('[api/youtube-videos] Fetch failed:', err);
    res.status(200).json({ videos: [] });
  }
}
