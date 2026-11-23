// Fixed-window in-memory rate limiter (resilience against request floods).
export function createRateLimiter({ windowMs = 60_000, max = 300, now = () => Date.now() } = {}) {
  const hits = new Map();
  return function rateLimit(req, res, next) {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const t = now();
    let h = hits.get(key);
    if (!h || t >= h.reset) { h = { count: 0, reset: t + windowMs }; hits.set(key, h); }
    h.count += 1;
    if (hits.size > 10_000) for (const [k, v] of hits) if (t >= v.reset) hits.delete(k); // bound memory
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - h.count)));
    if (h.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((h.reset - t) / 1000)));
      return res.status(429).json({ error: 'Too many requests, slow down' });
    }
    next();
  };
}
