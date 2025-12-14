export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
 
    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
 
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
 
    try {
      // --- ROUTES ---
 
      // 1. News Feed
      if (path === '/news') {
        return await handleNews(env, corsHeaders);
      }
 
      // 2. iTunes Metadata
      if (path === '/itunes') {
        const artist = url.searchParams.get('artist');
        const title = url.searchParams.get('title');
        if (!artist || !title) {
          return new Response('Missing artist or title', { status: 400, headers: corsHeaders });
        }
        return await handleiTunes(artist, title, env, corsHeaders);
      }
 
      // 3. Auth Login
      if (path.match(/\/auth\/(spotify|youtube)\/login/)) {
        const service = path.split('/')[2];
        return handleAuthLogin(service, env);
      }
 
      // 4. Auth Callback
      if (path.match(/\/auth\/(spotify|youtube)\/callback/)) {
        const service = path.split('/')[2];
        return await handleAuthCallback(request, service, env);
      }
 
      // 5. Auth Refresh
      if (path.match(/\/auth\/(spotify|youtube)\/refresh/)) {
        const service = path.split('/')[2];
        return await handleAuthRefresh(request, service, env, corsHeaders);
      }
 
      return new Response('Not Found', { status: 404, headers: corsHeaders });
 
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500, headers: corsHeaders });
    }
  },
};
 
// --- HANDLERS ---
 
async function handleNews(env, corsHeaders) {
  const CACHE_KEY = 'news_feed_json';
  const CACHE_TTL = 900; // 15 minutes
 
  // 1. Try Cache
  const cached = await env.NEWS_CACHE.get(CACHE_KEY, 'json');
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    });
  }
 
  // 2. Fetch RSS
  const FEED_URL = 'https://www.nporadio2.nl/nieuws/rss';
  const response = await fetch(FEED_URL);
  if (!response.ok) {
    throw new Error('Failed to fetch RSS feed');
  }
  const xml = await response.text();
 
  // 3. Parse XML (Simple Regex Approach)
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
 
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];
    const getTag = (tag) => {
      const regex = new RegExp(`<${tag}.*?>([\\s\\S]*?)<\/${tag}>`);
      const m = itemContent.match(regex);
      return m ? m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
    };
 
    const title = getTag('title');
    const link = getTag('link');
    const description = getTag('description').replace(/<[^>]*>?/gm, ''); // Strip HTML
    const category = getTag('category');
    const pubDate = getTag('pubDate');
 
    // Image extraction
    let imageUrl = null;
    const enclosureMatch = itemContent.match(/<enclosure.*?url="(.*?)".*?>/);
    if (enclosureMatch) imageUrl = enclosureMatch[1];
    
    // Filter logic (Top 2000 related)
    const fullText = `${title} ${description} ${category}`.toLowerCase();
    if (fullText.includes('top 2000') || fullText.includes('top2000')) {
       items.push({
        title,
        link,
        description: description.substring(0, 200) + '...',
        pubDate,
        imageUrl
      });
    }
  }
 
  const result = items.slice(0, 5); // Limit to 5
 
  // 4. Store in Cache
  await env.NEWS_CACHE.put(CACHE_KEY, JSON.stringify(result), { expirationTtl: CACHE_TTL });
 
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  });
}
 
async function handleiTunes(artist, title, env, corsHeaders) {
  const cacheKey = `itunes:${artist.toLowerCase()}:${title.toLowerCase()}`.replace(/\s+/g, '-');
  
  // 1. Try Cache
  const cached = await env.ITUNES_CACHE.get(cacheKey, 'json');
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    });
  }
 
  // 2. Fetch iTunes (with Retries/Queries)
  const clean = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const queries = [
    `${artist} ${title}`,
    `${title} ${artist}`,
    title
  ];
  
  let data = { coverUrl: null, previewUrl: null };
  
  for (const q of queries) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1&country=NL`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      if (json.results && json.results.length > 0) {
        const track = json.results[0];
        data = {
          coverUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : null,
          previewUrl: track.previewUrl
        };
        break; // Found it
      }
    }
  }
 
  // 3. Store Cache (Cache misses too to prevent hammering)
  // Cache hits for 7 days, misses for 1 day
  const ttl = data.coverUrl ? 60 * 60 * 24 * 7 : 60 * 60 * 24; 
  await env.ITUNES_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: ttl });
 
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  });
}
 
function handleAuthLogin(service, env) {
  let authUrl = '';
  const state = Math.random().toString(36).substring(7); // Simple state
  
  const redirectUri = `${env.REDIRECT_URI}/auth/${service}/callback`.replace('//auth', '/auth');
 
  if (service === 'spotify') {
    const scope = 'playlist-modify-public playlist-modify-private user-read-private user-read-email';
    authUrl = `https://accounts.spotify.com/authorize?` +
      `response_type=code` +
      `&client_id=${env.SPOTIFY_CLIENT_ID}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`;
  } else if (service === 'youtube') {
    const scope = 'https://www.googleapis.com/auth/youtube.force-ssl';
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `response_type=code` +
      `&client_id=${env.YOUTUBE_CLIENT_ID}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&access_type=offline` +
      `&prompt=consent` + 
      `&state=${state}`;
  }
 
  return Response.redirect(authUrl, 302);
}
 
async function handleAuthCallback(request, service, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
 
  if (error || !code) {
    return Response.redirect(`${env.FRONTEND_URL}/?error=${error || 'no_code'}`, 302);
  }
 
  const redirectUri = `${env.REDIRECT_URI}/auth/${service}/callback`.replace('//auth', '/auth');
 
  let tokenData = {};
 
  if (service === 'spotify') {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: env.SPOTIFY_CLIENT_ID,
      client_secret: env.SPOTIFY_CLIENT_SECRET,
    });
 
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    tokenData = await resp.json();
 
  } else if (service === 'youtube') {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: env.YOUTUBE_CLIENT_ID,
      client_secret: env.YOUTUBE_CLIENT_SECRET,
    });
 
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    tokenData = await resp.json();
  }
 
  if (tokenData.error) {
     return Response.redirect(`${env.FRONTEND_URL}/?error=${tokenData.error}`, 302);
  }
 
  const params = new URLSearchParams();
  params.append('access_token', tokenData.access_token);
  if (tokenData.refresh_token) params.append('refresh_token', tokenData.refresh_token);
  if (tokenData.expires_in) params.append('expires_in', tokenData.expires_in.toString());
  params.append('service', service);
 
  return Response.redirect(`${env.FRONTEND_URL}/#callback&${params.toString()}`, 302);
}
 
async function handleAuthRefresh(request, service, env, corsHeaders) {
  const url = new URL(request.url);
  const refreshToken = url.searchParams.get('refresh_token');
  
  if (!refreshToken) {
    return new Response('Missing refresh_token', { status: 400, headers: corsHeaders });
  }
 
  let tokenData = {};
 
  if (service === 'spotify') {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.SPOTIFY_CLIENT_ID,
      client_secret: env.SPOTIFY_CLIENT_SECRET,
    });
    
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    tokenData = await resp.json();
 
  } else if (service === 'youtube') {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.YOUTUBE_CLIENT_ID,
      client_secret: env.YOUTUBE_CLIENT_SECRET,
    });
 
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    tokenData = await resp.json();
  }
 
  if (tokenData.error) {
    return new Response(JSON.stringify(tokenData), { status: 400, headers: corsHeaders });
  }
  
  return new Response(JSON.stringify(tokenData), { 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  });
}
