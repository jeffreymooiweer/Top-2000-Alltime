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
 
      // 8. Top 2000 Data (All-time list)
      if (path === '/data/top2000' || path === '/data/all-time') {
          return await handleTop2000Data(env, corsHeaders, url.searchParams.get('force') === 'true');
      }

      // 9. Soundiiz Export (CSV)
      if (path === '/export/soundiiz') {
          const year = url.searchParams.get('year');
          return await handleSoundiizExport(env, corsHeaders, year);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
 
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500, headers: corsHeaders });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(updateTop2000Data(env));
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

  // Changed cache key to invalidate old non-channel-restricted results
  const cacheKey = `youtube-v2:${artist.toLowerCase()}:${title.toLowerCase()}`.replace(/\s+/g, '-');
  
  // 1. Try Cache
  const cached = await env.ITUNES_CACHE.get(cacheKey, 'json');
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    });
  }

  // 2. Get Channel ID (Cached)
  let channelId = await env.ITUNES_CACHE.get('channel_id:Top2000agogo');
  if (!channelId) {
     try {
       const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=Top2000agogo&key=${env.YOUTUBE_API_KEY}`;
       const channelResp = await fetch(channelUrl);
       const channelData = await channelResp.json();
       channelId = channelData.items?.[0]?.id;
       
       if (channelId) {
         await env.ITUNES_CACHE.put('channel_id:Top2000agogo', channelId);
       }
     } catch (e) {
       console.error('Failed to fetch channel ID:', e);
     }
  }

  // 3. Fetch from YouTube API
  const q = `${artist} ${title}`;
  let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=1&key=${env.YOUTUBE_API_KEY}`;
  
  if (channelId) {
    url += `&channelId=${channelId}`;
  } else {
    // Fallback if channel ID fetch failed
    url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q + ' Top 2000 a gogo')}&type=video&maxResults=1&key=${env.YOUTUBE_API_KEY}`;
  }

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

    // 4. Store in Cache (30 days)
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

// ... Soundiiz Export Handler
async function handleSoundiizExport(env, corsHeaders, year) {
  const CACHE_KEY = 'top2000_alltime_data_v1';
  
  // 1. Get Data from Cache
  let songs = await env.ITUNES_CACHE.get(CACHE_KEY, 'json');
  
  if (!songs) {
     // If not in cache, try to update
     try {
         songs = await updateTop2000Data(env);
     } catch (e) {
         return new Response(`Error fetching data: ${e.message}`, { status: 500, headers: corsHeaders });
     }
  }

  // 2. Filter/Sort
  let filteredSongs = [...songs];
  
  if (year && year !== 'all-time') {
      const yearInt = parseInt(year); // Ensure year is treated as string key in rankings
      const yearKey = year.toString();

      // Filter songs that have a rank in this year
      filteredSongs = filteredSongs.filter(s => 
          s.rankings[yearKey] !== null && s.rankings[yearKey] !== undefined
      );
      
      // Sort by rank in that year
      filteredSongs.sort((a, b) => {
          const rankA = a.rankings[yearKey] || 9999;
          const rankB = b.rankings[yearKey] || 9999;
          return rankA - rankB;
      });
  } else {
      // All-time: already sorted by totalScore/allTimeRank in the stored data
      // But just in case
      filteredSongs.sort((a, b) => (a.allTimeRank || 9999) - (b.allTimeRank || 9999));
  }

  // 3. Generate CSV
  // Soundiiz format: Title, Artist, Album
  const csvRows = ['Title,Artist,Album'];
  
  filteredSongs.forEach(song => {
      // Escape quotes
      const title = (song.title || '').replace(/"/g, '""');
      const artist = (song.artist || '').replace(/"/g, '""');
      const album = ''; // We don't have album data
      
      csvRows.push(`"${title}","${artist}","${album}"`);
  });
  
  const csvContent = csvRows.join('\n');

  // 4. Return Response
  const yearLabel = year === 'all-time' || !year ? 'Allertijden' : year;
  const filename = `Top2000-${yearLabel}.csv`;

  return new Response(csvContent, {
      headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`
      }
  });
}

// --- Top 2000 Data Logic ---

async function handleTop2000Data(env, corsHeaders, forceRefresh = false) {
  const CACHE_KEY = 'top2000_alltime_data_v1';
  const CACHE_TTL = 60 * 60 * 24; // 1 day

  // 1. Try Cache (if not forced)
  if (!forceRefresh) {
      const cached = await env.ITUNES_CACHE.get(CACHE_KEY, 'json');
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=3600' }
        });
      }
  }

  try {
      // 2. Refresh Data
      const data = await updateTop2000Data(env);
      
      return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
      });
  } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
  }
}

async function updateTop2000Data(env) {
    console.log("Starting Top 2000 Data Update...");
    const CACHE_KEY = 'top2000_alltime_data_v1';
    const CACHE_TTL = 60 * 60 * 24; // 1 day

    // 1. Fetch Wikipedia Data
    const rawSongs = await scrapeWikipediaDataWorker();
    
    if (rawSongs.length === 0) {
        throw new Error("No data scraped from Wikipedia");
    }

    // 2. Calculate Scores (Reusing logic from App.tsx)
    
    // Determine the effective data range
    let maxYear = 0;
    let maxYearCount = 0;
    
    const allYears = new Set();
    rawSongs.forEach(s => {
       Object.keys(s.rankings).forEach(y => {
           const yInt = parseInt(y);
           if(!isNaN(yInt)) allYears.add(yInt);
       });
    });
    
    if (allYears.size > 0) {
       maxYear = Math.max(...Array.from(allYears));
       maxYearCount = rawSongs.filter(s => s.rankings[maxYear.toString()] !== undefined && s.rankings[maxYear.toString()] !== null).length;
    }

    const isLatestYearIncomplete = maxYearCount < 1500;
    const effectiveAllTimeYear = isLatestYearIncomplete ? maxYear - 1 : maxYear;
    
    const calculateScoreForYear = (rank) => {
        if (rank !== null && rank !== undefined && rank > 0 && rank <= 2000) {
            return 2001 - rank;
        }
        return 0;
    };

    const calculateAllTimeScore = (song, limitYear) => {
        let score = 0;
        Object.entries(song.rankings).forEach(([yearStr, rank]) => {
            const year = parseInt(yearStr);
            if (limitYear !== undefined && year > limitYear) return;
            score += calculateScoreForYear(rank);
        });
        return score;
    };

    // Calculate scores
    let scoredSongs = rawSongs.map(song => {
      const totalScore = calculateAllTimeScore(song, effectiveAllTimeYear);
      const previousTotalScore = calculateAllTimeScore(song, effectiveAllTimeYear - 1);
      
      return {
          ...song,
          totalScore,
          previousTotalScore
      };
    });

    // Assign All-Time Ranks (Current Safe Year)
    scoredSongs.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    scoredSongs = scoredSongs.map((song, index) => ({
      ...song,
      allTimeRank: index + 1
    }));

    // Assign All-Time Ranks (Previous Safe Year)
    const prevSorted = [...scoredSongs].sort((a, b) => (b.previousTotalScore || 0) - (a.previousTotalScore || 0));
    
    const prevRankMap = new Map();
    prevSorted.forEach((song, index) => {
        if ((song.previousTotalScore || 0) > 0) {
            prevRankMap.set(song.id, index + 1);
        }
    });

    // Merge back
    const finalSongs = scoredSongs.map(song => {
        const { previousTotalScore, ...rest } = song; 
        return {
            ...rest,
            previousAllTimeRank: prevRankMap.get(song.id)
        };
    });

    // 3. Store in KV
    await env.ITUNES_CACHE.put(CACHE_KEY, JSON.stringify(finalSongs), { expirationTtl: CACHE_TTL });
    
    console.log(`Updated Top 2000 data with ${finalSongs.length} songs.`);
    return finalSongs;
}

// Custom Wikipedia Scraper for Workers (No DOMParser)
async function scrapeWikipediaDataWorker() {
    const WIKI_API_URL = "https://nl.wikipedia.org/w/api.php";
    const PAGE_TITLE = "Lijst_van_Radio_2-Top_2000's";
    
    const params = new URLSearchParams({
      action: 'parse',
      page: PAGE_TITLE,
      prop: 'text',
      format: 'json',
      origin: '*'
    });

    const response = await fetch(`${WIKI_API_URL}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Top2000-AllTime-Worker/1.0 (https://top2000allertijden.nl)'
      }
    });
    
    // Debug: Handle non-JSON responses
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        // If the response is not JSON, throw an error with the content
        throw new Error(`Wikipedia API returned non-JSON. Status: ${response.status}. Content: "${text.substring(0, 200)}..."`);
    }
    
    if (!data.parse || !data.parse.text) {
      throw new Error("Invalid Wikipedia response structure");
    }

    const htmlContent = data.parse.text['*'];
    
    // Find the right table
    // Strategy: Split by <table>...</table>, count max <th> or cells looking like years
    
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let match;
    let targetTableRows = [];
    let maxCols = 0;

    while ((match = tableRegex.exec(htmlContent)) !== null) {
        const tableContent = match[1];
        // Split rows
        const rows = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
        if (!rows || rows.length < 5) continue;
        
        // Count cols in first few rows
        let currentMax = 0;
        for(let r=0; r<Math.min(3, rows.length); r++) {
            const cells = rows[r].match(/<(td|th)[^>]*>/gi);
            if (cells) currentMax = Math.max(currentMax, cells.length);
        }

        if (currentMax > 20 && currentMax > maxCols) {
            maxCols = currentMax;
            targetTableRows = rows;
        }
    }

    if (targetTableRows.length === 0) {
        console.error("No suitable table found");
        return [];
    }

    // Process Rows
    // Helper to strip tags
    const stripTags = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const cleanCell = (cellHtml) => {
        // Remove refs, style, script
        let cleaned = cellHtml
            .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<span class="sortkey"[^>]*>[\s\S]*?<\/span>/gi, '');
        return stripTags(cleaned);
    };

    let yearColumnMap = {}; // { colIndex: yearString }
    let artistIdx = -1;
    let titleIdx = -1;
    let releaseYearIdx = -1;
    let headerRowIndex = 0;

    // Scan for headers
    for(let r=0; r < Math.min(targetTableRows.length, 5); r++) {
        const rowHtml = targetTableRows[r];
        // Extract cells content
        const cellsMatch = rowHtml.match(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi);
        if (!cellsMatch) continue;

        const cells = cellsMatch.map(c => {
            const inner = c.match(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/i);
            return inner ? inner[2] : '';
        });

        cells.forEach((cellContent, idx) => {
            const text = cleanCell(cellContent).toLowerCase();
            
            if (text.includes('artiest')) artistIdx = idx;
            if (text.includes('titel') || text === 'nummer') titleIdx = idx;
            
            if (text === 'jaar' && !text.match(/\d/)) { 
                releaseYearIdx = idx;
            }
            
            // Year Detection
            const yearMatch = text.match(/(?:'|’|^)?(\d{2,4})\b/);
            if (yearMatch) {
                let y = parseInt(yearMatch[1]);
                if (y < 100) y = y >= 90 ? 1900 + y : 2000 + y;
                
                if (y >= 1999 && y <= 2030) {
                    yearColumnMap[idx] = y.toString();
                }
            }
        });

        if (Object.keys(yearColumnMap).length > 5) {
            headerRowIndex = r;
            break;
        }
    }

    if (artistIdx === -1) artistIdx = 2; 
    if (titleIdx === -1) titleIdx = 1;

    const songs = [];

    for (let i = headerRowIndex + 1; i < targetTableRows.length; i++) {
        const rowHtml = targetTableRows[i];
        // Extract cells content
        // Note: This regex is simple and might fail on nested tags or specific layouts, 
        // but for Wikipedia table rows usually <td> content </td> it works ok.
        const cellsMatch = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        if (!cellsMatch || cellsMatch.length < Math.max(artistIdx, titleIdx)) continue;

        const cells = cellsMatch.map(c => {
             const inner = c.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
             return inner ? inner[1] : '';
        });

        const artist = cleanCell(cells[artistIdx] || '');
        const title = cleanCell(cells[titleIdx] || '');

        if (!artist || !title) continue;

        let releaseYear = 0;
        if (releaseYearIdx !== -1) {
            const val = cleanCell(cells[releaseYearIdx] || '');
            const y = parseInt(val);
            if (!isNaN(y) && y > 1900 && y < 2100) releaseYear = y;
        }

        const rankings = {};
        let hasData = false;

        Object.keys(yearColumnMap).forEach((colIdxStr) => {
            const colIdx = parseInt(colIdxStr);
            const year = yearColumnMap[colIdx];
            const val = cleanCell(cells[colIdx] || '');
            
            const num = parseInt(val.replace(/\./g, ''));
            if (!isNaN(num) && num > 0) {
                rankings[year] = num;
                hasData = true;
            } else {
                rankings[year] = null;
            }
        });

        if (hasData) {
            const id = `${artist}-${title}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
            songs.push({
                id,
                artist,
                title,
                releaseYear, 
                rankings
            });
        }
    }

    return songs;
}
