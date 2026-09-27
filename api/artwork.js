// GET /api/artwork?title=...&type=movie|tv
//
// Artwork lookup strategy:
// 1) TMDB when TMDB_API_KEY is configured on the server (best poster match).
// 2) TVMaze for TV series (no key required).
// 3) Apple iTunes Search as a broad fallback for movies/TV.
//
// The client only calls this endpoint for titles that do not already have a
// provider supplied logo/poster, so existing artwork is always preserved.

function cleanTitle(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/\b(4k|uhd|fhd|hd|sd|2160p|1080p|720p|480p|h\.?265|h\.?264|hevc|x264|x265|10bit|hdr10?|dual[\s._-]?audio|dublado|legendado|web[\s._-]?rip|webdl|bluray|brrip|remux)\b/gi, ' ')
    .replace(/[\[\]{}]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 180);
}

async function fetchJson(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tmdb(title, type) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  const endpoint = type === 'tv' ? 'tv' : 'movie';
  for (const language of ['pt-BR', 'en-US']) {
    const q = new URLSearchParams({ api_key: key, language, query: title, include_adult: 'false', page: '1' });
    const data = await fetchJson(`https://api.themoviedb.org/3/search/${endpoint}?${q}`);
    const hit = data?.results?.[0];
    if (hit?.poster_path) {
      return {
        poster: `https://image.tmdb.org/t/p/w780${hit.poster_path}`,
        name: hit.title || hit.name || title,
        year: (hit.release_date || hit.first_air_date || '').slice(0, 4) || null,
      };
    }
  }
  return null;
}

async function tvmaze(title) {
  const data = await fetchJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
  const hit = data?.[0]?.show;
  const poster = hit?.image?.original || hit?.image?.medium || '';
  if (!poster) return null;
  return { poster, name: hit.name || title, year: (hit.premiered || '').slice(0, 4) || null };
}

async function itunes(title, type, country) {
  const entity = type === 'tv' ? 'tvShow' : 'movie';
  const q = new URLSearchParams({ term: title, media: type === 'tv' ? 'tv' : 'movie', entity, limit: '1', country });
  const data = await fetchJson(`https://itunes.apple.com/search?${q}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 NeoPlayer artwork lookup' },
  });
  const hit = data?.results?.[0];
  if (!hit) return null;
  const source = hit.artworkUrl100 || hit.artworkUrl60 || '';
  const poster = source.replace(/\/\d+x\d+bb(\.(jpg|png))/i, '/600x600bb$1');
  if (!poster) return null;
  return { poster, name: hit.trackName || hit.collectionName || title, year: (hit.releaseDate || '').slice(0, 4) || null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const title = cleanTitle(req.query?.title);
  const type = req.query?.type === 'tv' ? 'tv' : 'movie';
  if (!title) return res.status(400).json({ error: 'Informe o título.' });

  let hit = await tmdb(title, type);
  if (!hit && type === 'tv') hit = await tvmaze(title);
  if (!hit) hit = await itunes(title, type, 'BR');
  if (!hit) hit = await itunes(title, type, 'US');
  if (!hit && type === 'tv') hit = await itunes(title, 'movie', 'US');

  res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
  return res.status(200).json(hit ? { poster: hit.poster, name: hit.name, year: hit.year } : { poster: null });
}
