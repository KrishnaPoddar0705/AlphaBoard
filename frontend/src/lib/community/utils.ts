/**
 * Format date to relative time (e.g., "2 hours ago", "3 days ago")
 */
export function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  let result = '';
  if (diffSecs < 60) {
    result = 'just now';
  } else if (diffMins < 60) {
    result = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'}`;
  } else if (diffHours < 24) {
    result = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'}`;
  } else if (diffDays < 7) {
    result = `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
  } else if (diffWeeks < 4) {
    result = `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'}`;
  } else if (diffMonths < 12) {
    result = `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'}`;
  } else {
    result = `${diffYears} ${diffYears === 1 ? 'year' : 'years'}`;
  }

  return options?.addSuffix ? `${result} ago` : result;
}

