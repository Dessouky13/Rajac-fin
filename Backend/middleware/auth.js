/**
 * Authorization Middleware
 *
 * This middleware provides basic authorization checks for protected endpoints.
 * Currently implements logging and can be extended with JWT authentication in the future.
 *
 * Usage:
 *   const { requireAuth, requireAdmin } = require('./middleware/auth');
 *   app.put('/api/students/:id/fees', requireAuth, handler);
 */

/**
 * Basic authentication middleware (placeholder for future JWT implementation)
 *
 * TODO: Implement JWT token verification when authentication system is ready
 * - Extract token from Authorization header
 * - Verify token signature
 * - Attach user info to req.user
 * - Reject requests with invalid/expired tokens
 */
const requireAuth = (req, res, next) => {
  // Log access attempt for audit trail
  console.log(`[AUTH] Access attempt:`, {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
    body: req.method !== 'GET' ? req.body : undefined
  });

  // TODO: Uncomment when authentication is implemented
  /*
  const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
  */

  // For now, allow all requests but log them
  next();
};

/**
 * Admin-only authorization middleware
 *
 * Requires the user to have admin privileges
 * Currently logs admin access attempts
 *
 * TODO: Check req.user.role === 'admin' when authentication is implemented
 */
const requireAdmin = (req, res, next) => {
  console.log(`[AUTH] Admin access attempt:`, {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString()
  });

  // TODO: Uncomment when authentication is implemented
  /*
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin privileges required'
    });
  }
  */

  next();
};

/**
 * Rate limiting middleware for sensitive operations
 * Prevents abuse by limiting requests per IP address
 */
const rateLimitMap = new Map();

const rateLimit = (maxRequests = 10, windowMs = 60000) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Clean up old entries
    for (const [key, value] of rateLimitMap.entries()) {
      if (now - value.windowStart > windowMs) {
        rateLimitMap.delete(key);
      }
    }

    // Check rate limit
    const record = rateLimitMap.get(ip);

    if (!record) {
      rateLimitMap.set(ip, { count: 1, windowStart: now });
      next();
    } else if (now - record.windowStart > windowMs) {
      // Reset window
      rateLimitMap.set(ip, { count: 1, windowStart: now });
      next();
    } else if (record.count < maxRequests) {
      record.count++;
      next();
    } else {
      console.warn(`[AUTH] Rate limit exceeded for IP ${ip}`);
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${Math.ceil((windowMs - (now - record.windowStart)) / 1000)} seconds.`
      });
    }
  };
};

/**
 * Audit log middleware for tracking critical changes
 * Logs all modifications to student data, payments, and financial records
 */
const auditLog = (action) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Log the operation result
      console.log(`[AUDIT] ${action}:`, {
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        user: req.user?.email || 'unauthenticated',
        action,
        params: req.params,
        body: req.body,
        success: data.success || false,
        error: data.error || null
      });

      return originalJson(data);
    };

    next();
  };
};

module.exports = {
  requireAuth,
  requireAdmin,
  rateLimit,
  auditLog
};
