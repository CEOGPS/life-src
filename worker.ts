import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, getCookie } from 'hono/cookie';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

// Types with KV binding
type Bindings = {
  KV: any;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
  OAUTH_TOKEN_ENDPOINT: string;
  OAUTH_REDIRECT_URI: string;
  ALLOWED_ORIGIN: string;
  COOKIE_NAME: string;
  STRIPE_SECRET_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  ENVIRONMENT: string;
};

type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'https://lifeos1.pages.dev',
      'http://localhost:5173',
      'https://lifeos1.ceogps.com',
      'https://api.lifeos1.ceogps.com',
    ];
    if (allowedOrigins.includes(origin)) return origin;
    return 'https://lifeos1.pages.dev';
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));


// Helper: Cache operations with KV
async function cacheGet(c: any, key: string): Promise<any> {
  try {
    const cached = await c.env.KV.get(key, 'json');
    return cached;
  } catch (error) {
    console.error(`[KV] Get error for ${key}:`, error);
    return null;
  }
}

async function cacheSet(c: any, key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
  try {
    await c.env.KV.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    });
  } catch (error) {
    console.error(`[KV] Set error for ${key}:`, error);
  }
}

async function cacheDelete(c: any, key: string): Promise<void> {
  try {
    await c.env.KV.delete(key);
  } catch (error) {
    console.error(`[KV] Delete error for ${key}:`, error);
  }
}

async function getUserId(c: any): Promise<string | null> {
  let userId = getCookie(c, c.env.COOKIE_NAME || 'session');
  if (!userId) {
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      userId = authHeader.replace('Bearer ', '');
    }
  }
  return userId || null;
}

// ==================== Health & Root Routes ====================

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    worker: 'lifeos1-api',
    environment: c.env.ENVIRONMENT || 'production',
    kv_ready: !!c.env.KV,
    timestamp: new Date().toISOString(),
    endpoints: [
      '/health',
      '/api/oauth/status',
      '/api/oauth/callback',
      '/api/keys/store',
      '/api/keys/get-all',
      '/api/validate-key',
      '/api/stripe/summary',
      '/api/cloudflare/summary',
      '/api/user/check',
      '/api/user/register',
    ],
  });
});

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: performance.now(),
    kv_status: c.env.KV ? 'connected' : 'disconnected',
  });
});

// ==================== OAuth Routes ====================

app.get('/api/oauth/status', async (c) => {
  const userId = await getUserId(c);
  
  if (!userId) {
    return c.json({ connected: [] });
  }
  
  // Check cache first
  const cacheKey = `oauth:status:${userId}`;
  const cached = await cacheGet(c, cacheKey);
  
  if (cached) {
    return c.json(cached);
  }
  
  try {
    // Fetch from Supabase
    const response = await fetch(`${c.env.SUPABASE_URL}/rest/v1/user_connections?user_id=eq.${userId}&select=platform,email,connected_at`, {
      headers: {
        'apikey': c.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
      },
    });
    
    const connections = await response.json();
    const result = { connected: connections };
    
    // Cache for 5 minutes
    await cacheSet(c, cacheKey, result, 300);
    
    return c.json(result);
  } catch (error) {
    console.error('[OAuth] Status error:', error);
    return c.json({ connected: [] });
  }
});

app.get('/api/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const userId = c.req.query('user_id');
  
  if (!code || !state) {
    return c.json({ error: 'code and state are required' }, 400);
  }
  
  try {
    // Exchange code for token
    const tokenResponse = await fetch(c.env.OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: c.env.OAUTH_REDIRECT_URI,
        client_id: c.env.OAUTH_CLIENT_ID,
        client_secret: c.env.OAUTH_CLIENT_SECRET,
      }),
    });
    
    const tokenData = await tokenResponse.json() as any;
    
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error || 'Token exchange failed');
    }
    
    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    const userInfo = await userInfoResponse.json() as any;
    
    // Store connection
    if (userId) {
      await fetch(`${c.env.SUPABASE_URL}/rest/v1/user_connections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': c.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: userId,
          platform: 'google',
          email: userInfo.email,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          connected_at: new Date().toISOString(),
        }),
      });
      
      // Invalidate cache
      await cacheDelete(c, `oauth:status:${userId}`);
    }
    
    // Set session cookie
    if (userId) {
      setCookie(c, c.env.COOKIE_NAME || 'session', userId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 31536000,
        path: '/',
      });
    }
    
    // Redirect to frontend
    const frontendUrl = c.env.ALLOWED_ORIGIN || 'https://lifeos1.pages.dev';
    return c.redirect(`${frontendUrl}/auth/callback?code=${code}&state=${state}`);
    
  } catch (error) {
    console.error('[OAuth] Callback error:', error);
    return c.json({ error: 'OAuth callback failed' }, 500);
  }
});

app.post('/api/oauth/start', async (c) => {
const { provider: _provider, scope, user_id } = await c.req.json();
  
  const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  oauthUrl.searchParams.set('client_id', c.env.OAUTH_CLIENT_ID);
  oauthUrl.searchParams.set('redirect_uri', c.env.OAUTH_REDIRECT_URI);
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('scope', scope || 'email profile');
  oauthUrl.searchParams.set('access_type', 'offline');
  oauthUrl.searchParams.set('prompt', 'consent');
  
  if (user_id) {
    oauthUrl.searchParams.set('state', user_id);
  }
  
  return c.json({ url: oauthUrl.toString() });
});

app.post('/api/oauth/disconnect', async (c) => {
  const { provider, account_email, user_id } = await c.req.json();
  
  if (!user_id) {
    return c.json({ error: 'user_id required' }, 400);
  }
  
  try {
    await fetch(`${c.env.SUPABASE_URL}/rest/v1/user_connections?user_id=eq.${user_id}&platform=eq.${provider}&email=eq.${account_email}`, {
      method: 'DELETE',
      headers: {
        'apikey': c.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
      },
    });
    
    // Invalidate cache
    await cacheDelete(c, `oauth:status:${user_id}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('[OAuth] Disconnect error:', error);
    return c.json({ error: 'Failed to disconnect' }, 500);
  }
});

// ==================== Key Management Routes (with KV Cache) ====================

app.post('/api/keys/store', async (c) => {
  const { service, key } = await c.req.json();
  const userId = await getUserId(c);
  
  if (!service || !key) {
    return c.json({ error: 'service and key are required' }, 400);
  }
  
  try {
    // Store in Supabase
    await fetch(`${c.env.SUPABASE_URL}/rest/v1/api_keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': c.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId || 'anonymous',
        service,
        api_key: key,
        updated_at: new Date().toISOString(),
      }),
    });
    
    // Store in KV for fast access
    if (userId) {
      const kvKey = `keys:${userId}:${service}`;
      await cacheSet(c, kvKey, key, 86400); // 24 hours
      
      // Invalidate keys cache
      await cacheDelete(c, `keys:all:${userId}`);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('[Keys] Store error:', error);
    return c.json({ error: 'Failed to store key' }, 500);
  }
});

app.get('/api/keys/get-all', async (c) => {
  const userId = await getUserId(c);
  
  if (!userId) {
    return c.json({});
  }
  
  // Check KV cache first
  const cacheKey = `keys:all:${userId}`;
  const cached = await cacheGet(c, cacheKey);
  
  if (cached) {
    return c.json(cached);
  }
  
  try {
    const response = await fetch(`${c.env.SUPABASE_URL}/rest/v1/api_keys?user_id=eq.${userId}&select=service,api_key`, {
      headers: {
        'apikey': c.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
      },
    });
    
    const keys = await response.json() as any[];
    const keysMap: Record<string, string> = {};
    
    for (const key of keys) {
      keysMap[key.service] = key.api_key;
      
      // Also cache individual keys
      await cacheSet(c, `keys:${userId}:${key.service}`, key.api_key, 86400);
    }
    
    // Cache all keys for 1 hour
    await cacheSet(c, cacheKey, keysMap, 3600);
    
    return c.json(keysMap);
  } catch (error) {
    console.error('[Keys] Get error:', error);
    return c.json({});
  }
});

app.post('/api/validate-key', async (c) => {
  const { provider, key } = await c.req.json();
  
  if (!provider || !key) {
    return c.json({ valid: false, detail: 'provider and key required' }, 400);
  }
  
  // Check validation cache
  const cacheKey = `validation:${provider}:${key.substring(0, 10)}`;
  const cached = await cacheGet(c, cacheKey);
  
  if (cached) {
    return c.json(cached);
  }
  
  try {
    let isValid = false;
    let detail = '';
    
    switch (provider) {
      case 'openai':
        const openaiRes = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` },
        });
        isValid = openaiRes.ok;
        detail = isValid ? 'Valid OpenAI API key' : 'Invalid OpenAI API key';
        break;
        
      case 'claude':
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
        });
        isValid = claudeRes.status !== 401;
        detail = isValid ? 'Valid Claude API key' : 'Invalid Claude API key';
        break;
        
      case 'stripe':
        const stripeRes = await fetch('https://api.stripe.com/v1/balance', {
          headers: { 'Authorization': `Bearer ${key}` },
        });
        isValid = stripeRes.ok;
        detail = isValid ? 'Valid Stripe key' : 'Invalid Stripe key';
        break;
        
      case 'groq':
        const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` },
        });
        isValid = groqRes.ok;
        detail = isValid ? 'Valid Groq API key' : 'Invalid Groq API key';
        break;
        
      default:
        isValid = true;
        detail = 'Validation not implemented for this provider';
    }
    
    const result = { valid: isValid, detail };
    
    // Cache validation result for 1 hour
    await cacheSet(c, cacheKey, result, 3600);
    
    return c.json(result);
  } catch (error) {
    console.error('[Validate] Error:', error);
    return c.json({ valid: false, detail: error instanceof Error ? error.message : 'Validation failed' });
  }
});

// ==================== Stripe Routes ====================

app.get('/api/stripe/summary', async (c) => {
  const userId = await getUserId(c);
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  
  if (!stripeKey) {
    return c.json({ error: 'Stripe not configured' }, 501);
  }
  
  // Check cache
  if (userId) {
    const cached = await cacheGet(c, `stripe:${userId}`);
    if (cached) {
      return c.json(cached);
    }
  }
  
  try {
    const [balanceRes, chargesRes] = await Promise.all([
      fetch('https://api.stripe.com/v1/balance', {
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      }),
      fetch('https://api.stripe.com/v1/charges?limit=5', {
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      }),
    ]);
    
    const balance = await balanceRes.json();
    const charges = await chargesRes.json();
    
    const result = { balance, charges: charges.data || [] };
    
    // Cache for 5 minutes
    if (userId) {
      await cacheSet(c, `stripe:${userId}`, result, 300);
    }
    
    return c.json(result);
  } catch (error) {
    console.error('[Stripe] Error:', error);
    return c.json({ error: 'Failed to fetch Stripe data' }, 500);
  }
});

// ==================== Cloudflare Routes ====================

app.get('/api/cloudflare/summary', async (c) => {
  const userId = await getUserId(c);
  const cfToken = c.env.CLOUDFLARE_API_TOKEN;
  
  if (!cfToken) {
    return c.json({ error: 'Cloudflare not configured' }, 501);
  }
  
  // Check cache
  if (userId) {
    const cached = await cacheGet(c, `cloudflare:${userId}`);
    if (cached) {
      return c.json(cached);
    }
  }
  
  try {
    const zonesRes = await fetch('https://api.cloudflare.com/client/v4/zones', {
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    const zonesData = await zonesRes.json() as any;
    
    if (!zonesData.success) {
      throw new Error('Failed to fetch zones');
    }
    
    const zones = await Promise.all((zonesData.result || []).slice(0, 5).map(async (zone: any) => {
      const analyticsRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zone.id}/analytics/dashboard`,
        {
          headers: { 'Authorization': `Bearer ${cfToken}` },
        }
      );
      const analytics = await analyticsRes.json() as any;
      
      return {
        id: zone.id,
        name: zone.name,
        status: zone.status,
        requests: analytics.result?.requests?.all?.requests || 0,
        threats: analytics.result?.requests?.all?.threats || 0,
        bandwidth: analytics.result?.requests?.all?.bandwidth || '0',
        uniques: analytics.result?.unique?.visitors?.value || 0,
      };
    }));
    
    const result = { zones };
    
    // Cache for 5 minutes
    if (userId) {
      await cacheSet(c, `cloudflare:${userId}`, result, 300);
    }
    
    return c.json(result);
  } catch (error) {
    console.error('[Cloudflare] Error:', error);
    return c.json({ error: 'Failed to fetch Cloudflare data' }, 500);
  }
});

// ==================== User Routes ====================

app.post('/api/user/check', async (c) => {
  const { uid, email } = await c.req.json();
  
  if (!uid && !email) {
    return c.json({ isRegistered: false }, 400);
  }
  
  // Check cache
  const cacheKey = `user:${uid || email}`;
  const cached = await cacheGet(c, cacheKey);
  
  if (cached !== null) {
    return c.json({ isRegistered: cached });
  }
  
  try {
    const query = uid ? `uid=eq.${uid}` : `email=eq.${email}`;
    const response = await fetch(`${c.env.SUPABASE_URL}/rest/v1/users?${query}&select=id`, {
      headers: {
        'apikey': c.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
      },
    });
    
    const users = await response.json() as any[];
    const isRegistered = users.length > 0;
    
    // Cache for 1 hour
    await cacheSet(c, cacheKey, isRegistered, 3600);
    
    return c.json({ isRegistered });
  } catch (error) {
    console.error('[User] Check error:', error);
    return c.json({ isRegistered: false });
  }
});

app.post('/api/user/register', async (c) => {
  const { uid, email, displayName, photoURL } = await c.req.json();
  
  if (!uid || !email) {
    return c.json({ error: 'uid and email required' }, 400);
  }
  
  try {
    const response = await fetch(`${c.env.SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': c.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        uid,
        email,
        display_name: displayName || null,
        photo_url: photoURL || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to register user');
    }
    
    // Cache user
    await cacheSet(c, `user:${uid}`, true, 3600);
    await cacheSet(c, `user:${email}`, true, 3600);
    
    // Set session cookie
    setCookie(c, c.env.COOKIE_NAME || 'session', uid, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 31536000,
      path: '/',
    });
    
    return c.json({ success: true });
  } catch (error) {
    console.error('[User] Register error:', error);
    return c.json({ error: 'Failed to register user' }, 500);
  }
});

// ==================== Nylas Routes ====================

app.post('/api/nylas/store-grant', async (c) => {
  const { email, grant_id } = await c.req.json();
  const userId = await getUserId(c);
  
  if (!email || !grant_id) {
    return c.json({ error: 'email and grant_id required' }, 400);
  }
  
  try {
    await fetch(`${c.env.SUPABASE_URL}/rest/v1/nylas_grants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': c.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        email,
        grant_id,
        user_id: userId,
        updated_at: new Date().toISOString(),
      }),
    });
    
    // Cache the grant
    if (userId) {
      await cacheSet(c, `nylas:${userId}`, grant_id, 86400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('[Nylas] Store error:', error);
    return c.json({ error: 'Failed to store grant' }, 500);
  }
});

// ==================== OAuth Status All (for multiple providers) ====================

app.get('/api/oauth/status/all', async (c) => {
  const userId = await getUserId(c);
  
  if (!userId) {
    return c.json({});
  }
  
  const cacheKey = `oauth:all:${userId}`;
  const cached = await cacheGet(c, cacheKey);
  
  if (cached) {
    return c.json(cached);
  }
  
  try {
    const response = await fetch(`${c.env.SUPABASE_URL}/rest/v1/user_connections?user_id=eq.${userId}`, {
      headers: {
        'apikey': c.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
      },
    });
    
    const connections = await response.json() as any[];
    const result: Record<string, any> = {};
    
    for (const conn of connections) {
      result[conn.platform] = {
        connected: true,
        email: conn.email,
        connected_at: conn.connected_at,
      };
    }
    
    await cacheSet(c, cacheKey, result, 300);
    
    return c.json(result);
  } catch (error) {
    console.error('[OAuth] Status all error:', error);
    return c.json({});
  }
});

// ==================== KV Admin Routes (for debugging) ====================

app.get('/api/kv/stats', async (c) => {
  if (c.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'Not available in production' }, 403);
  }
  // Only allow in development or for admin users
  if (c.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'Not available in production' }, 403);
  }
  
  try {
    const keys = await c.env.KV.list({ limit: 100 });
    return c.json({
      total_keys: keys.keys.length,
keys: keys.keys.map((k: any) => k.name),
    });
  } catch (error) {
    console.error('[KV] Stats error:', error);
    return c.json({ error: 'Failed to get KV stats' }, 500);
  }
});

app.delete('/api/kv/clear', async (c) => {
  if (c.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'Not available in production' }, 403);
  }
  
  try {
    const keys = await c.env.KV.list({ limit: 1000 });
    for (const key of keys.keys) {
      await c.env.KV.delete(key.name);
    }
    return c.json({ success: true, cleared: keys.keys.length });
  } catch (error) {
    console.error('[KV] Clear error:', error);
    return c.json({ error: 'Failed to clear KV' }, 500);
  }
});

// ==================== 404 Handler ====================

app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    path: c.req.path,
    method: c.req.method,
    available_endpoints: [
      'GET /',
      'GET /health',
      'GET /api/oauth/status',
      'GET /api/oauth/callback',
      'POST /api/oauth/start',
      'POST /api/oauth/disconnect',
      'POST /api/keys/store',
      'GET /api/keys/get-all',
      'POST /api/validate-key',
      'GET /api/stripe/summary',
      'GET /api/cloudflare/summary',
      'POST /api/user/check',
      'POST /api/user/register',
      'POST /api/nylas/store-grant',
      'GET /api/oauth/status/all',
    ],
  }, 404);
});

// ==================== Error Handler ====================

app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    stack: c.env.ENVIRONMENT === 'development' ? err.stack : undefined,
  }, 500);
});

export default app;