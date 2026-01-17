
import crypto from 'crypto';

const config = {
  password: process.env.PASSWORD || '111111',
  timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '2'),
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  blockedHosts: (process.env.BLOCKED_HOSTS || 'localhost,127.0.0.1,0.0.0.0,::1').split(','),
  blockedPrefixes: (process.env.BLOCKED_IP_PREFIXES || '192.168.,10.,172.').split(','),
  filteredHeaders: (process.env.FILTERED_HEADERS || 'content-security-policy,cookie,set-cookie,x-frame-options,access-control-allow-origin').split(',')
};

function isValidUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const allowedProtocols = ['http:', 'https:'];
    
    if (!allowedProtocols.includes(parsed.protocol)) return false;
    if (config.blockedHosts.includes(parsed.hostname)) return false;
    
    for (const prefix of config.blockedPrefixes) {
      if (parsed.hostname.startsWith(prefix)) return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

function validateProxyAuth(query: any): boolean {
  const authHash = query.auth as string;
  const timestamp = query.t as string;
  
  const serverPassword = config.password;
  if (!serverPassword) return false;
  
  const serverPasswordHash = crypto.createHash('sha256').update(serverPassword).digest('hex');
  
  if (!authHash || authHash !== serverPasswordHash) {
    return false;
  }
  
  if (timestamp) {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000;
    if (now - parseInt(timestamp) > maxAge) {
      return false;
    }
  }
  
  return true;
}

export default defineEventHandler(async (event) => {
  const encodedUrl = getRouterParam(event, 'encodedUrl');
  const query = getQuery(event);
  
  if (!encodedUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Missing URL parameters' });
  }

  // 1. Validate Auth
  if (!validateProxyAuth(query)) {
    throw createError({
       statusCode: 401,
       statusMessage: 'Unauthorized Proxy Access'
    });
  }

  // 2. Decode URL
  const targetUrl = decodeURIComponent(encodedUrl);

  // 3. Validate URL Safety
  if (!isValidUrl(targetUrl)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' });
  }

  // 4. Make Request
  try {
    // Handling retries manually or just simple fetch for now. Nuxt's $fetch doesn't stream by default the same way axios does easily.
    // For Proxying streaming response (e.g. m3u8 or large files), using `sendProxy` is better, or `fetch` with `stream`.
    // H3's `sendProxy` is powerful.
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': config.userAgent,
        'Accept': query.accept as string || '*/*',
        'Referer': getHeader(event, 'referer') || ''
      },
      // @ts-ignore
      timeout: config.timeout
    });

    // Handle Headers
    const forbiddenHeaders = ['content-encoding', 'content-length', 'transfer-encoding', 'connection'];
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!config.filteredHeaders.includes(lowerKey) && !forbiddenHeaders.includes(lowerKey)) {
        setHeader(event, key, value);
      }
    });

    // Set Status
    setResponseStatus(event, response.status, response.statusText);

    // Return Body
    return response.body;

  } catch (error: any) {
    console.error('Proxy Error Details:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Proxy Error: ${error.message}`
    });
  }
});
