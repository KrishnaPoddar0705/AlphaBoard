/**
 * Error sanitization utility
 * Removes sensitive information from error messages before displaying to users
 */

/**
 * Sanitize error message by removing sensitive data
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) {
    return 'An unexpected error occurred';
  }

  // If it's a string, sanitize it
  if (typeof error === 'string') {
    return sanitizeErrorString(error);
  }

  // If it's an Error object, sanitize the message
  if (error instanceof Error) {
    return sanitizeErrorString(error.message);
  }

  // If it has a message property
  if (error.message) {
    return sanitizeErrorString(error.message);
  }

  // If it has an error property (nested error)
  if (error.error) {
    return sanitizeErrorMessage(error.error);
  }

  // Fallback
  return 'An unexpected error occurred';
}

/**
 * Sanitize error string by removing sensitive patterns
 */
function sanitizeErrorString(message: string): string {
  if (!message) {
    return 'An unexpected error occurred';
  }

  let sanitized = message;

  // Remove UUIDs (user IDs, etc.)
  sanitized = sanitized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '[REDACTED]'
  );

  // Remove email addresses
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[REDACTED]'
  );

  // Remove tokens (long alphanumeric strings)
  sanitized = sanitized.replace(
    /[a-zA-Z0-9]{32,}/g,
    '[REDACTED]'
  );

  // Remove file paths that might contain user info
  sanitized = sanitized.replace(
    /\/[^\s]*(user|users|home|private)[^\s]*/gi,
    '[REDACTED]'
  );

  // Remove database connection strings
  sanitized = sanitized.replace(
    /(postgres|mysql|mongodb):\/\/[^\s]+/gi,
    '[REDACTED]'
  );

  // Remove API keys
  sanitized = sanitized.replace(
    /(api[_-]?key|apikey|secret|token|password|pwd)[\s:=]+[^\s]+/gi,
    '[REDACTED]'
  );

  // Remove stack traces (lines starting with "at" or file paths)
  const lines = sanitized.split('\n');
  const sanitizedLines = lines.filter(line => {
    const trimmed = line.trim();
    // Keep error messages but remove stack trace lines
    return !trimmed.startsWith('at ') && 
           !trimmed.match(/^\w+:\/\/|\/\w+/) && // Remove URLs and file paths
           !trimmed.match(/^\s*File "/); // Remove Python file paths
  });
  sanitized = sanitizedLines.join('\n');

  // If message is too technical, provide generic message
  if (sanitized.includes('SQL') || sanitized.includes('database') || sanitized.includes('connection')) {
    return 'A database error occurred. Please try again later.';
  }

  // If message contains internal details, provide generic message
  if (sanitized.includes('Traceback') || sanitized.includes('Exception') || sanitized.includes('Error:')) {
    // Extract just the meaningful part
    const meaningfulPart = sanitized.split('\n')[0];
    if (meaningfulPart.length < 200) {
      return meaningfulPart;
    }
    return 'An error occurred. Please try again.';
  }

  return sanitized || 'An unexpected error occurred';
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error: any): string {
  const sanitized = sanitizeErrorMessage(error);

  // Map common error patterns to user-friendly messages
  if (sanitized.toLowerCase().includes('unauthorized') || sanitized.toLowerCase().includes('401')) {
    return 'You are not authorized to perform this action. Please log in and try again.';
  }

  if (sanitized.toLowerCase().includes('forbidden') || sanitized.toLowerCase().includes('403')) {
    return 'You do not have permission to access this resource.';
  }

  if (sanitized.toLowerCase().includes('not found') || sanitized.toLowerCase().includes('404')) {
    return 'The requested resource was not found.';
  }

  if (sanitized.toLowerCase().includes('network') || sanitized.toLowerCase().includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (sanitized.toLowerCase().includes('timeout')) {
    return 'The request timed out. Please try again.';
  }

  if (sanitized.toLowerCase().includes('validation') || sanitized.toLowerCase().includes('invalid')) {
    return 'Invalid input. Please check your data and try again.';
  }

  // Return sanitized message if it's reasonable length
  if (sanitized.length < 200) {
    return sanitized;
  }

  // Otherwise return generic message
  return 'An error occurred. Please try again.';
}



