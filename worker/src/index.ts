export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
 
    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
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
        if (request.method === 'POST') {
             return await handleiTunesPost(request, env, corsHeaders);
        }

        const artist = url.searchParams.get('artist');
        const title = url.searchParams.get('title');
        if (!artist || !title) {
          return new Response('Missing artist or title', { status: 400, headers: corsHeaders });
        }
        return await handleiTunesGet(artist, title, env, corsHeaders);
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

      // 6. Analyze Song (Groq)
      if (path === '/analyze') {
        const artist = url.searchParams.get('artist');
        const title = url.searchParams.get('title');
        if (!artist || !title) {
          return new Response('Missing artist or title', { status: 400, headers: corsHeaders });
        }
        return await handleAnalyze(artist, title, env, corsHeaders);
      }

      // 7. YouTube Search
      if (path === '/youtube/search') {
        const artist = url.searchParams.get('artist');
        const title = url.searchParams.get('title');
        if (!artist || !title) {
          return new Response('Missing artist or title', { status: 400, headers: corsHeaders });
        }
        return await handleYouTubeSearch(artist, title, env, corsHeaders);
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
    
    // 1. Try enclosure
    const enclosureMatch = itemContent.match(/<enclosure[\s\S]*?url="([^"]+)"/);
    if (enclosureMatch) {
        imageUrl = enclosureMatch[1];
    } else {
        // 2. Try media:content
        const mediaMatch = itemContent.match(/<media:content[\s\S]*?url="([^"]+)"/);
        if (mediaMatch) {
            imageUrl = mediaMatch[1];
        } else {
            // 3. Try img tag in description (before stripping)
            const rawDescription = getTag('description'); 
            const imgMatch = rawDescription.match(/<img[\s\S]*?src="([^"]+)"/);
            if (imgMatch) imageUrl = imgMatch[1];
        }
    }
    
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
 
  const result = items.slice(0, 3); // Limit to 3
 
  // 4. Store in Cache
  await env.NEWS_CACHE.put(CACHE_KEY, JSON.stringify(result), { expirationTtl: CACHE_TTL });
 
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  });
}

async function handleiTunesPost(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const { artist, title, coverUrl, previewUrl } = body;

        if (!artist || !title) {
            return new Response('Missing artist or title', { status: 400, headers: corsHeaders });
        }

        const cacheKey = `itunes-v2:${artist.toLowerCase()}:${title.toLowerCase()}`.replace(/\s+/g, '-');
        
        // Store in KV
        // 7 days expiration
        const data = { coverUrl, previewUrl };
        await env.ITUNES_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 7 });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500, headers: corsHeaders });
    }
}
 
async function handleiTunesGet(artist, title, env, corsHeaders) {
  // Changed cache key prefix to 'itunes-v2' to invalidate old cache
  const cacheKey = `itunes-v2:${artist.toLowerCase()}:${title.toLowerCase()}`.replace(/\s+/g, '-');
  
  // 1. Try Cache
  const cached = await env.ITUNES_CACHE.get(cacheKey, 'json');
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    });
  }

  // 2. Return 404 to trigger client-side fetch
  // We no longer fetch server-side because it's prone to blocking
  return new Response(null, { status: 404, headers: { ...corsHeaders, 'X-Cache': 'MISS' } });
}
 
function handleAuthLogin(service, env) {
  let authUrl = '';
  const state = Math.random().toString(36).substring(7); // Simple state
  
  const redirectUrlObj = new URL(`/auth/${service}/callback`, env.REDIRECT_URI);
  const redirectUri = redirectUrlObj.toString();
 
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

  const frontendUrl = env.FRONTEND_URL && !env.FRONTEND_URL.includes('workers.dev') 
    ? env.FRONTEND_URL 
    : 'https://top2000allertijden.nl';

  if (error || !code) {
    return Response.redirect(`${frontendUrl}/?error=${error || 'no_code'}`, 302);
  }

  const redirectUrlObj = new URL(`/auth/${service}/callback`, env.REDIRECT_URI);
  const redirectUri = redirectUrlObj.toString();

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
     return Response.redirect(`${frontendUrl}/?error=${tokenData.error}`, 302);
  }

  const params = new URLSearchParams();
  params.append('access_token', tokenData.access_token);
  if (tokenData.refresh_token) params.append('refresh_token', tokenData.refresh_token);
  if (tokenData.expires_in) params.append('expires_in', tokenData.expires_in.toString());
  params.append('service', service);

  return Response.redirect(`${frontendUrl}/#callback&${params.toString()}`, 302);
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

async function handleAnalyze(artist, title, env, corsHeaders) {
  if (!env.GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: 'Groq API key not configured' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_MODEL = "llama-3.1-8b-instant";

  const prompt =
    `Schrijf in het Nederlands een korte, enthousiaste uitleg (max 80 woorden) ` +
    `over waarom het nummer "${title}" van "${artist}" zo populair is in de Top 2000. ` +
    `Focus op emotie, nostalgie, mee-zingen of historische betekenis. En deel triviant weetjes over deze track.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Je bent een Nederlandse muziekjournalist die korte, vlotte teksten schrijft over Top 2000-nummers.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text =
      data?.choices?.[0]?.message?.content?.trim() ??
      "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}

async function handleYouTubeSearch(artist, title, env, corsHeaders) {
  if (!env.YOUTUBE_API_KEY) {
    return new Response(JSON.stringify({ error: 'YouTube API key not configured' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  const cacheKey = `youtube:${artist.toLowerCase()}:${title.toLowerCase()}`.replace(/\s+/g, '-');
  
  // 1. Try Cache
  const cached = await env.ITUNES_CACHE.get(cacheKey, 'json');
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    });
  }

  // 2. Fetch from YouTube API
  // Search query: Artist Title Top 2000 a gogo
  const q = `${artist} ${title} Top 2000 a gogo`;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=1&key=${env.YOUTUBE_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`YouTube API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const item = data.items?.[0];

    if (!item) {
        return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    const result = {
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url
    };

    // 3. Store in Cache (30 days)
    await env.ITUNES_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 * 60 * 24 * 30 });

    return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
    });

  } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
  }
}
