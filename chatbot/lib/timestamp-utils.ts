/**
 * Formats a timestamp into a human-readable relative time string
 * @param timestamp - The timestamp to format (Date, string, or number)
 * @returns Formatted time string (e.g., "几秒前", "几分钟前", "2024-01-15")
 */
export function formatRelativeTime(timestamp: Date | string | number): string {
  const now = new Date();
  const date = new Date(timestamp);
  
  // Handle invalid dates
  if (isNaN(date.getTime())) {
    console.warn('Invalid timestamp:', timestamp);
    return '未知时间';
  }
  
  // Calculate the difference in milliseconds
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  // Debug logging for development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('Timestamp debug:', {
      timestamp,
      date: date.toISOString(),
      now: now.toISOString(),
      diffMs,
      diffSeconds,
      diffMinutes,
      diffHours,
      diffDays
    });
  }
  
  // If more than 30 days, show the actual date
  if (diffDays > 30) {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  
  // Less than 1 minute
  if (diffSeconds < 60) {
    if (diffSeconds < 5) {
      return '刚刚';
    }
    return `${diffSeconds}秒前`;
  }
  
  // Less than 1 hour
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }
  
  // Less than 1 day
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }
  
  // 1-30 days
  return `${diffDays}天前`;
}

/**
 * Formats a timestamp into a more detailed format for tooltips
 * @param timestamp - The timestamp to format
 * @returns Detailed time string (e.g., "2024年1月15日 下午2:30")
 */
export function formatDetailedTime(timestamp: Date | string | number): string {
  const date = new Date(timestamp);
  
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
