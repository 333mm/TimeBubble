import type { TimestampOccurrence } from '../types';

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

/**
 * 目次・チャプター・まとめ・トラックリスト等のインデックスコメントかどうかを判定する
 */
export function isIndexOrSummaryComment(rawText: string, timestamps: TimestampOccurrence[]): boolean {
  // 1. タイムスタンプが5個以上ある場合は一律で目次・まとめコメントとみなす
  if (timestamps.length >= 5) {
    return true;
  }

  // 2. タイムスタンプが3個以上あり、かつ目次・チャプター・まとめ関連のキーワードが含まれている場合
  if (timestamps.length >= 3) {
    const summaryKeywordsRegex = /(まとめ|目次|チャプター|タイムスタンプ|タイムテーブル|トラックリスト|セトリ|セットリスト|曲目|chapters?|timestamps?|tracklist|index|setlist)/i;
    if (summaryKeywordsRegex.test(rawText)) {
      return true;
    }
  }

  // 3. タイムスタンプ範囲表記 (例: "0:30-0:35", "0:30~0:35", "0:30〜0:35") が2箇所以上含まれている場合
  const rangeRegex = /(?:(?:(?:\d{1,2}:)?[0-5]?\d:[0-5]\d)\s*[-~〜–—]\s*(?:(?:\d{1,2}:)?[0-5]?\d:[0-5]\d))/g;
  const rangeMatches = rawText.match(rangeRegex);
  if (rangeMatches && rangeMatches.length >= 2) {
    return true;
  }

  return false;
}

