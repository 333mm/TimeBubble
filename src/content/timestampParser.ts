import { TimestampOccurrence } from '../types';

/**
 * タイムスタンプ文字列 (例: "01:23", "1:02:45", "0:08") を秒数に変換する
 */
export function timeStringToSeconds(timeStr: string): number {
  const parts = timeStr.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return -1;

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return -1;
}

/**
 * 秒数をフォーマットされたタイムスタンプ文字列 (例: "01:23", "1:02:45") に変換する
 */
export function secondsToTimeString(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num: number) => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * コメント本文のテキストまたはHTMLからすべてのタイムスタンプを抽出する
 */
export function extractTimestamps(text: string): TimestampOccurrence[] {
  // 正規表現: \b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b
  // 例: 0:00, 1:23, 01:23, 1:02:03, 12:34:56
  const regex = /(?:(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d))/g;
  const results: TimestampOccurrence[] = [];
  const seenSeconds = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const sec = timeStringToSeconds(fullMatch);
    if (sec >= 0 && !seenSeconds.has(sec)) {
      seenSeconds.add(sec);
      results.push({
        seconds: sec,
        formatted: fullMatch,
      });
    }
  }

  // 秒数昇順にソート
  return results.sort((a, b) => a.seconds - b.seconds);
}
