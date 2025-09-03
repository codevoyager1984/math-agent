import { toast } from 'sonner';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

function unsecuredCopyToClipboard(text: string) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Unable to copy to clipboard', err);
  }
  document.body.removeChild(textArea);
}

export function isValidUrl(string: string) {
  try {
    // 使用 URL 构造函数来判断是否可以正确解析
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export const copyToClipboard = async (text: string, msg?: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg || '复制成功');
  } catch (err) {
    unsecuredCopyToClipboard(text);
    toast.success(msg || '复制成功');
  }
};

export function shortenString(str: string) {
  if (!str) {
    return '';
  }
  const maxLength = 10;

  // 如果字符串长度小于等于最大长度，直接返回
  if (str.length <= maxLength) {
    return str;
  }

  // 计算前后保留字符的数量
  const charsToShow = Math.floor((maxLength - 3) / 2);
  const start = str.slice(0, charsToShow);
  const end = str.slice(-charsToShow);

  return `${start}...${end}`;
}

export function timeAgo(dateString: string | Date | number): string {
  const now: Date = new Date();

  let past: Date;
  if (typeof dateString === 'string') {
    // 检查字符串是否可能是数字格式的 UNIX 时间戳
    if (/^\d+$/.test(dateString)) {
      // 判断是秒还是毫秒
      const timestamp = parseInt(dateString, 10);
      // 如果长度小于等于13位，可能是毫秒；大于13位，可能是微秒或纳秒，需要转换
      past = new Date(timestamp <= 9999999999 ? timestamp * 1000 : timestamp);
    } else {
      // 对于UTC ISO字符串，直接创建日期对象
      // 但我们需要明确指定这是UTC时间
      past = new Date(dateString + 'Z'); // 添加Z表示这是UTC时间
    }
  } else if (typeof dateString === 'number') {
    // 处理数字类型的 UNIX 时间戳
    // 判断是秒还是毫秒
    past = new Date(dateString <= 9999999999 ? dateString * 1000 : dateString);
    console.log('past', past);
  } else {
    past = dateString;
  }

  const diffInSeconds: number = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 0) {
    const futureDiffInSeconds = Math.abs(diffInSeconds);
    if (futureDiffInSeconds < 60) {
      return '即将';
    }

    const futureDiffInMinutes: number = Math.floor(futureDiffInSeconds / 60);
    if (futureDiffInMinutes < 60) {
      return `${futureDiffInMinutes} 分钟后`;
    }

    const futureDiffInHours: number = Math.floor(futureDiffInMinutes / 60);
    if (futureDiffInHours < 24) {
      return `${futureDiffInHours} 小时后`;
    }

    const futureDiffInDays: number = Math.floor(futureDiffInHours / 24);
    if (futureDiffInDays < 30) {
      return `${futureDiffInDays} 天后`;
    }

    const futureDiffInMonths: number = Math.floor(futureDiffInDays / 30);
    if (futureDiffInMonths < 12) {
      return `${futureDiffInMonths} 个月后`;
    }

    const futureDiffInYears: number = Math.floor(futureDiffInMonths / 12);
    return `${futureDiffInYears} 年后`;
  } else {
    if (diffInSeconds < 60) {
      return '刚刚';
    }

    const diffInMinutes: number = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} 分钟前`;
    }

    const diffInHours: number = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} 小时前`;
    }

    const diffInDays: number = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} 天前`;
    }

    const diffInMonths: number = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} 个月前`;
    }

    const diffInYears: number = Math.floor(diffInMonths / 12);
    return `${diffInYears} 年前`;
  }
}

export function countryCodeToFlagEmoji(countryCode: string) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function formatUnixTimestamp(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000); // 将 Unix 时间戳转换为毫秒
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; // 自动获取当前时区
  const formattedDate = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timeZone, // 设置为当前时区
  }).format(date);

  return formattedDate.replace(/\//g, '.'); // 替换斜杠为点
}

export function formatTimeDifference(unixTimestamp: number): string {
  if (!unixTimestamp) {
    return '-';
  }
  const now = new Date();
  const targetDate = new Date(unixTimestamp * 1000);
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);

  const isFuture = diffInSeconds < 0;
  const absDiff = Math.abs(diffInSeconds);

  if (absDiff < 60) {
    return isFuture ? '即将' : '刚刚';
  } else if (absDiff < 3600) {
    const minutes = Math.floor(absDiff / 60);
    return isFuture ? `${minutes} 分钟后` : `${minutes} 分钟前`;
  } else if (absDiff < 86400) {
    const hours = Math.floor(absDiff / 3600);
    return isFuture ? `${hours} 小时后` : `${hours} 小时前`;
  } else if (absDiff < 2592000) {
    const days = Math.floor(absDiff / 86400);
    return isFuture ? `${days} 天后` : `${days} 天前`;
  } else if (absDiff < 31536000) {
    const months = Math.floor(absDiff / 2592000);
    return isFuture ? `${months} 个月后` : `${months} 个月前`;
  } else {
    const years = Math.floor(absDiff / 31536000);
    return isFuture ? `${years} 年后` : `${years} 年前`;
  }
}

export function formatTimeString(timeStr: string) {
  const date = new Date(timeStr); // 将 Unix 时间戳转换为毫秒
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; // 自动获取当前时区
  const formattedDate = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timeZone, // 设置为当前时区
  }).format(date);

  return formattedDate.replace(/\//g, '.'); // 替换斜杠为点
}

export function getValueByExpression(obj: { [x: string]: any }, expression: string): any {
  return expression.split('.').reduce((acc, key) => acc && acc[key], obj) as any;
}

export function decodeJwtToken<T = any>(token: string): T {
  if (!token) {
    return {
      exp: 1,
    } as T;
  }
  // 提取并解码 JWT payload 部分（第二段）
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );

  return JSON.parse(jsonPayload);
}

export function formatReadableNumber(number: number, precision = 2) {
  if (number < 1000) {
    return number;
  }
  if (number < 1000000) {
    return (number / 1000).toFixed(precision) + 'K';
  }
  if (number < 1000000000) {
    return (number / 1000000).toFixed(precision) + 'M';
  }
  return (number / 1000000000).toFixed(precision) + 'B';
}

export function formatSecondsToReadableTime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  if (days >= 1) {
    return `${days}天`;
  } else {
    const hours = Math.floor(seconds / 3600);
    return `${hours}小时`;
  }
}

/**
 * 将UTC时间转换为本地时区时间并格式化
 * @param utcTimeString UTC时间字符串，格式如: "2025-06-26T08:28:25.289000"
 * @param format 格式化模板，默认为 'MM-DD HH:mm'
 * @returns 格式化后的本地时间字符串
 */
export function formatUtcToLocal(utcTimeString: string | null | undefined, format: string = 'MM-DD HH:mm'): string {
  if (!utcTimeString) {
    return '-';
  }
  
  try {
    return dayjs.utc(utcTimeString).local().format(format);
  } catch (error) {
    console.error('时间格式化错误:', error);
    return '-';
  }
}

/**
 * 将UTC时间转换为本地时区的完整日期时间格式
 * @param utcTimeString UTC时间字符串
 * @returns 格式化后的完整日期时间字符串
 */
export function formatUtcToLocalFull(utcTimeString: string | null | undefined): string {
  return formatUtcToLocal(utcTimeString, 'YYYY-MM-DD HH:mm:ss');
}

/**
 * 格式化时间戳，用于统一应用中的时间显示
 * @param timestamp UTC时间戳字符串
 * @param format 自定义格式，可选
 * @returns 格式化后的时间字符串
 */
export const formatTimestamp = {
  /**
   * 日期和时间 (YYYY-MM-DD HH:mm)
   */
  dateTime: (timestamp: string | null | undefined): string => {
    return formatUtcToLocal(timestamp, 'YYYY-MM-DD HH:mm');
  },
  
  /**
   * 带秒的日期和时间 (YYYY-MM-DD HH:mm:ss)
   */
  dateTimeFull: (timestamp: string | null | undefined): string => {
    return formatUtcToLocal(timestamp, 'YYYY-MM-DD HH:mm:ss');
  },
  
  /**
   * 仅日期 (YYYY-MM-DD)
   */
  dateOnly: (timestamp: string | null | undefined): string => {
    return formatUtcToLocal(timestamp, 'YYYY-MM-DD');
  },
  
  /**
   * 仅时间 (HH:mm)
   */
  timeOnly: (timestamp: string | null | undefined): string => {
    return formatUtcToLocal(timestamp, 'HH:mm');
  },
  
  /**
   * 自定义格式
   */
  custom: (timestamp: string | null | undefined, format: string): string => {
    return formatUtcToLocal(timestamp, format);
  }
};
