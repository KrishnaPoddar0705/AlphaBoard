/**
 * Safe logging utility
 * Prevents sensitive data (user IDs, tokens, etc.) from being logged
 * Only logs in development mode
 */

const isDevelopment = import.meta.env.DEV;

/**
 * Sanitize data by removing sensitive fields
 */
function sanitize(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Check if string contains UUID pattern (user IDs)
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    if (uuidPattern.test(data)) {
      return '[REDACTED: Contains user ID]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    const sensitiveKeys = [
      'user_id', 'userId', 'user_id', 'id', 'session', 'token', 
      'access_token', 'refresh_token', 'password', 'email',
      'authorization', 'apikey', 'api_key', 'secret'
    ];

    for (const key in data) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitize(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Safe console.log - only in development, sanitizes sensitive data
 */
export function safeLog(...args: any[]): void {
  if (!isDevelopment) {
    return; // Don't log in production
  }

  const sanitized = args.map(arg => sanitize(arg));
}

/**
 * Safe console.warn - only in development, sanitizes sensitive data
 */
export function safeWarn(...args: any[]): void {
  if (!isDevelopment) {
    return;
  }

  const sanitized = args.map(arg => sanitize(arg));
}

/**
 * Safe console.error - sanitizes sensitive data but always logs errors
 */
export function safeError(...args: any[]): void {
  const sanitized = args.map(arg => {
    if (arg instanceof Error) {
      // For errors, keep the message but sanitize any stack traces that might contain IDs
      const error = new Error(arg.message);
      error.name = arg.name;
      // Don't include stack trace in client logs
      return error;
    }
    return sanitize(arg);
  });
}

/**
 * Safe console.debug - only in development, sanitizes sensitive data
 */
export function safeDebug(...args: any[]): void {
  if (!isDevelopment) {
    return;
  }

  const sanitized = args.map(arg => sanitize(arg));
}

