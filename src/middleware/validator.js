const { z } = require('zod');
const { URL } = require('url');

// Schema for audit request
const auditSchema = z.object({
  url: z.string().trim().url({ message: 'Invalid URL format. Must include protocol (http:// or https://)' }),
  timeoutMs: z.number().int().min(500).max(15000).optional().default(5000),
  ignoreCache: z.boolean().optional().default(false)
});

// Private IP ranges to prevent SSRF (Server-Side Request Forgery)
const BLOCKED_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

const isPrivateIP = (hostname) => {
  if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) return true;
  
  // Check IPv4 private ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x)
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, p1, p2] = ipv4Match.map(Number);
    if (p1 === 10) return true;
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
    if (p1 === 192 && p2 === 168) return true;
    if (p1 === 169 && p2 === 254) return true; // Link-local / AWS metadata
    if (p1 === 127) return true;
  }
  
  return false;
};

const validateAuditRequest = (req, res, next) => {
  const result = auditSchema.safeParse(req.body);
  
  if (!result.success) {
    const issue = result.error.issues[0];
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation failed',
        details: result.error.format()
      },
      requestId: req.requestId
    });
  }

  try {
    const parsedUrl = new URL(result.data.url);
    if (isPrivateIP(parsedUrl.hostname)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SECURITY_SSRF_BLOCKED',
          message: 'Access to local/private network addresses is restricted for security.'
        },
        requestId: req.requestId
      });
    }
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'URL_PARSE_ERROR',
        message: 'Unable to parse provided target URL.'
      },
      requestId: req.requestId
    });
  }

  req.validatedData = result.data;
  next();
};

module.exports = {
  validateAuditRequest,
  auditSchema
};
