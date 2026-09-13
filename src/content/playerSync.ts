import { CommentData, TimestampCommentTrigger } from '../types';
import { OverlayUi } from './overlayUi';

export class PlayerSync {
  private videoEl: HTMLVideoElement | null = null;
  private overlayUi: OverlayUi;
  private triggersBySecond = new Map<number, TimestampCommentTrigger[]>();
  private lastCheckedSecond = -1;
  private timeUpdateListener: (() => void) | null = null;
  private seekingListener: (() => void) | null = null;
  private seekedListener: (() => void) | null = null;
  private currentVideoId: string = '';

  private readonly syncToken = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  constructor(overlayUi: OverlayUi) {
    this.overlayUi = overlayUi;
  }

  public setVideoId(videoId: string) {
    if (this.currentVideoId === videoId) return;
    this.currentVideoId = videoId;
    this.clear();
  }

  public setComments(comments: CommentData[]) {
    this.triggersBySecond.clear();
    this.addComments(comments);
  }

  public addComments(newComments: CommentData[]) {
    for (const comment of newComments) {
      if (this.currentVideoId && comment.videoId && comment.videoId !== this.currentVideoId) {
        continue;
      }
      for (const ts of comment.timestamps) {
        const sec = ts.seconds;
        if (!this.triggersBySecond.has(sec)) {
          this.triggersBySecond.set(sec, []);
        }
        const list = this.triggersBySecond.get(sec)!;
        const triggerId = `${comment.id}_sec_${sec}`;
        const normalizedText = comment.rawText.trim().replace(/\s+/g, ' ');
        const isDuplicate = list.some(
          (t) =>
            t.id === triggerId ||
            t.comment.id === comment.id ||
            t.comment.rawText.trim().replace(/\s+/g, ' ') === normalizedText
        );
        if (!isDuplicate) {
          list.push({
            comment,
            timestamp: ts,
            id: triggerId,
          });
        }
      }
    }
  }

  public attach(video: HTMLVideoElement) {
    // 既存の別PlayerSyncインスタンスがアタッチされていたら安全に解除
    const existingSync = (video as unknown as Record<string, unknown>).__ytCommentOverlaySync__ as PlayerSync | undefined;
    if (existingSync && existingSync !== this) {
      existingSync.detach();
    }

    if (this.videoEl === video) return;
    this.detach();

    this.videoEl = video;
    (video as unknown as Record<string, unknown>).__ytCommentOverlaySync__ = this;
    video.setAttribute('data-yt-overlay-active-token', this.syncToken);
    this.lastCheckedSecond = -1; // 初期化

    this.timeUpdateListener = () => {
      // 排他チェック: 最新インスタンスのトークンと一致しない場合は自滅して二重動作を完全停止
      if (video.getAttribute('data-yt-overlay-active-token') !== this.syncToken) {
        this.detach();
        return;
      }
      this.handleTimeUpdate();
    };

    this.seekingListener = () => {
      if (video.getAttribute('data-yt-overlay-active-token') !== this.syncToken) {
        this.detach();
        return;
      }
      this.handleSeeking();
    };

    this.seekedListener = () => {
      if (video.getAttribute('data-yt-overlay-active-token') !== this.syncToken) {
        this.detach();
        return;
      }
      this.handleSeeked();
    };

    this.videoEl.addEventListener('timeupdate', this.timeUpdateListener);
    this.videoEl.addEventListener('seeking', this.seekingListener);
    this.videoEl.addEventListener('seeked', this.seekedListener);
  }

  public clear() {
    this.triggersBySecond.clear();
    this.lastCheckedSecond = -1;
    this.overlayUi.clearAll();
  }

  public detach() {
    this.clear();
    if (this.videoEl) {
      if ((this.videoEl as unknown as Record<string, unknown>).__ytCommentOverlaySync__ === this) {
        delete (this.videoEl as unknown as Record<string, unknown>).__ytCommentOverlaySync__;
      }
      if (this.timeUpdateListener) {
        this.videoEl.removeEventListener('timeupdate', this.timeUpdateListener);
      }
      if (this.seekingListener) {
        this.videoEl.removeEventListener('seeking', this.seekingListener);
      }
      if (this.seekedListener) {
        this.videoEl.removeEventListener('seeked', this.seekedListener);
      }
      this.videoEl = null;
    }
    this.timeUpdateListener = null;
    this.seekingListener = null;
    this.seekedListener = null;
    this.lastCheckedSecond = -1;
  }

  private handleSeeking() {
    // シーク中はオーバーレイをクリアし、チェック済み秒数をリセット
    this.overlayUi.clearAll();
    this.lastCheckedSecond = -1;
  }

  private handleSeeked() {
    if (!this.videoEl) return;
    const currentSecond = Math.floor(this.videoEl.currentTime);
    // シーク完了直後、シーク先秒数をチェック
    this.checkAndTriggerSecond(currentSecond);
    this.lastCheckedSecond = currentSecond;
  }

  private handleTimeUpdate() {
    if (!this.videoEl) return;
    const currentSecond = Math.floor(this.videoEl.currentTime);

    // まだ未チェックまたはシーク直後
    if (this.lastCheckedSecond === -1) {
      this.checkAndTriggerSecond(currentSecond);
      this.lastCheckedSecond = currentSecond;
      return;
    }

    if (currentSecond === this.lastCheckedSecond) {
      return;
    }

    // 巻き戻しを検知した場合
    if (currentSecond < this.lastCheckedSecond) {
      this.overlayUi.clearAll();
      this.checkAndTriggerSecond(currentSecond);
      this.lastCheckedSecond = currentSecond;
      return;
    }

    // 通常再生の進捗 (進んだ秒数を順にチェック)
    const startSec = this.lastCheckedSecond + 1;
    const endSec = currentSecond;

    // 飛びすぎている場合 (3秒以上) は現在秒のみ
    if (endSec - startSec > 2) {
      this.checkAndTriggerSecond(endSec);
    } else {
      for (let sec = startSec; sec <= endSec; sec++) {
        this.checkAndTriggerSecond(sec);
      }
    }

    this.lastCheckedSecond = currentSecond;
  }

  private checkAndTriggerSecond(sec: number) {
    const triggers = this.triggersBySecond.get(sec);
    if (!triggers || triggers.length === 0) return;

    const seenTexts = new Set<string>();
    const uniqueTriggers: TimestampCommentTrigger[] = [];

    for (const t of triggers) {
      if (this.currentVideoId && t.comment.videoId && t.comment.videoId !== this.currentVideoId) {
        continue;
      }
      const normText = t.comment.rawText.trim().replace(/\s+/g, ' ');
      if (!seenTexts.has(normText)) {
        seenTexts.add(normText);
        uniqueTriggers.push(t);
      }
    }

    uniqueTriggers.forEach((trigger, idx) => {
      window.setTimeout(() => {
        if (this.currentVideoId && trigger.comment.videoId && trigger.comment.videoId !== this.currentVideoId) {
          return;
        }
        this.overlayUi.showComment(trigger);
      }, idx * 120);
    });
  }
}
