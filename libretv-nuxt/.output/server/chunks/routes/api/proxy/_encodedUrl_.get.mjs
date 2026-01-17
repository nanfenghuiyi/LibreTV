import { c as defineEventHandler, g as getRouterParam, e as getQuery, f as createError, h as sendProxy } from '../../../_/nitro.mjs';
import require$$1 from 'crypto';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

const config = {
  password: process.env.PASSWORD || "111111",
  timeout: parseInt(process.env.REQUEST_TIMEOUT || "5000"),
  maxRetries: parseInt(process.env.MAX_RETRIES || "2"),
  userAgent: process.env.USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  blockedHosts: (process.env.BLOCKED_HOSTS || "localhost,127.0.0.1,0.0.0.0,::1").split(","),
  blockedPrefixes: (process.env.BLOCKED_IP_PREFIXES || "192.168.,10.,172.").split(","),
  filteredHeaders: (process.env.FILTERED_HEADERS || "content-security-policy,cookie,set-cookie,x-frame-options,access-control-allow-origin").split(",")
};
function isValidUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const allowedProtocols = ["http:", "https:"];
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
function validateProxyAuth(query) {
  const authHash = query.auth;
  const timestamp = query.t;
  const serverPassword = config.password;
  const serverPasswordHash = require$$1.createHash("sha256").update(serverPassword).digest("hex");
  if (!authHash || authHash !== serverPasswordHash) {
    return false;
  }
  if (timestamp) {
    const now = Date.now();
    const maxAge = 10 * 60 * 1e3;
    if (now - parseInt(timestamp) > maxAge) {
      return false;
    }
  }
  return true;
}
const _encodedUrl__get = defineEventHandler(async (event) => {
  const encodedUrl = getRouterParam(event, "encodedUrl");
  const query = getQuery(event);
  if (!encodedUrl) {
    throw createError({ statusCode: 400, statusMessage: "Missing URL parameters" });
  }
  if (!validateProxyAuth(query)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized Proxy Access"
    });
  }
  const targetUrl = decodeURIComponent(encodedUrl);
  if (!isValidUrl(targetUrl)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid URL" });
  }
  try {
    return sendProxy(event, targetUrl, {
      headers: {
        "User-Agent": config.userAgent,
        "Accept": query.accept || "*/*"
      },
      fetchOptions: {
        timeout: config.timeout
      },
      onResponse(event2, response) {
        const headers = response.headers;
        config.filteredHeaders.forEach((h) => {
          headers.delete(h);
        });
      }
    });
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Proxy Error: ${error.message}`
    });
  }
});

export { _encodedUrl__get as default };
//# sourceMappingURL=_encodedUrl_.get.mjs.map
