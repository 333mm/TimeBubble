import { CommentData, TimestampCommentTrigger } from '../types';
import { OverlayUi } from './overlayUi';

export class PlayerSync {
  private videoEl: HTMLVideoElement | null = null;
  private overlayUi: OverlayUi;
  private triggersBySecond = new Map<number, TimestampCommentTrigger[]>();
  private lastCheckedSecond = -1;
  private triggeredFlowCommentIds = new Set<string>();
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
    this.triggeredFlowCommentIds.clear();
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
    this.triggeredFlowCommentIds.clear();
  }

  private handleSeeked() {
    if (!this.videoEl) return;
    const currentTime = this.videoEl.currentTime;
    const currentSecond = Math.floor(currentTime);

    this.triggeredFlowCommentIds.clear();

    if (this.overlayUi.isFlowModeEnabled()) {
      // フローモード時: シーク先時間で現在画面内に流れているべきコメントを復元
      this.syncFlowCommentsOnSeek(currentTime);
    } else {
      // カードモード時: シーク先秒数をチェック
      this.checkAndTriggerSecond(currentSecond);
    }
    this.lastCheckedSecond = currentSecond;
  }

  private handleTimeUpdate() {
    if (!this.videoEl) return;
    const currentTime = this.videoEl.currentTime;
    const currentSecond = Math.floor(currentTime);

    // 巻き戻しを検知した場合
    if (this.lastCheckedSecond !== -1 && currentSecond < this.lastCheckedSecond) {
      this.overlayUi.clearAll();
      this.triggeredFlowCommentIds.clear();
      if (this.overlayUi.isFlowModeEnabled()) {
        this.syncFlowCommentsOnSeek(currentTime);
      } else {
        this.checkAndTriggerSecond(currentSecond);
      }
      this.lastCheckedSecond = currentSecond;
      return;
    }

    if (this.overlayUi.isFlowModeEnabled()) {
      // フローモード: タイムスタンプ秒のタイミングで画面中央手前に到達するよう先行発火
      this.checkAndTriggerFlowComments(currentTime);
    } else {
      // カードモード: タイムスタンプ秒でカード表示
      if (this.lastCheckedSecond === -1) {
        this.checkAndTriggerSecond(currentSecond);
      } else if (currentSecond !== this.lastCheckedSecond) {
        const startSec = this.lastCheckedSecond + 1;
        const endSec = currentSecond;
        if (endSec - startSec > 2) {
          this.checkAndTriggerSecond(endSec);
        } else {
          for (let sec = startSec; sec <= endSec; sec++) {
            this.checkAndTriggerSecond(sec);
          }
        }
      }
    }

    this.lastCheckedSecond = currentSecond;
  }

  /**
   * カード表示モード用: 該当秒数のコメントをバブルカードで表示
   */
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

  /**
   * フローモード用: タイムスタンプ秒のタイミングで画面中央手前付近(約40%地点)に位置するよう先行発火
   */
  private checkAndTriggerFlowComments(currentTime: number) {
    const leadTimeSec = this.overlayUi.getFlowLeadTimeSeconds();
    const durationMs = this.overlayUi.getFlowDuration();
    const durationSec = durationMs / 1000;

    // 発火予定時刻 T_start = S - leadTimeSec
    // したがって、現在時刻 currentTime において発火すべきタイムスタンプ秒 S は:
    // S ≈ currentTime + leadTimeSec
    const targetTimestampSec = Math.round(currentTime + leadTimeSec);

    // 直近前後1秒を探索（timeupdateの間隔や小数の丸め誤差を吸収）
    for (let s = targetTimestampSec - 1; s <= targetTimestampSec + 1; s++) {
      const triggers = this.triggersBySecond.get(s);
      if (!triggers || triggers.length === 0) continue;

      for (const trigger of triggers) {
        if (this.currentVideoId && trigger.comment.videoId && trigger.comment.videoId !== this.currentVideoId) {
          continue;
        }
        if (this.triggeredFlowCommentIds.has(trigger.id)) {
          continue;
        }

        const triggerStartTime = trigger.timestamp.seconds - leadTimeSec;
        // 開始時刻を通過しており、かつまだ画面外に出ていないか
        if (currentTime >= triggerStartTime && currentTime < triggerStartTime + durationSec) {
          this.triggeredFlowCommentIds.add(trigger.id);
          const offsetMs = Math.max(0, Math.round((currentTime - triggerStartTime) * 1000));
          this.overlayUi.showFlowComment(trigger, offsetMs);
        }
      }
    }

    // 古くなった発火済みIDをSetから適宜掃除 (メモリリーク防止)
    if (this.triggeredFlowCommentIds.size > 200) {
      this.triggeredFlowCommentIds.clear();
    }
  }

  /**
   * シーク完了時: シーク先時間で現在画面内に流れている最中であるべきコメントを復元
   */
  private syncFlowCommentsOnSeek(currentTime: number) {
    const leadTimeSec = this.overlayUi.getFlowLeadTimeSeconds();
    const durationMs = this.overlayUi.getFlowDuration();
    const durationSec = durationMs / 1000;

    // シーク先で画面内にいる可能性があるタイムスタンプ秒 S の範囲:
    // S - leadTimeSec <= currentTime < S - leadTimeSec + durationSec
    // => currentTime + leadTimeSec - durationSec < S <= currentTime + leadTimeSec
    const minS = Math.floor(currentTime + leadTimeSec - durationSec);
    const maxS = Math.ceil(currentTime + leadTimeSec);

    for (let s = minS; s <= maxS; s++) {
      const triggers = this.triggersBySecond.get(s);
      if (!triggers || triggers.length === 0) continue;

      for (const trigger of triggers) {
        if (this.currentVideoId && trigger.comment.videoId && trigger.comment.videoId !== this.currentVideoId) {
          continue;
        }
        const triggerStartTime = trigger.timestamp.seconds - leadTimeSec;
        if (currentTime >= triggerStartTime && currentTime < triggerStartTime + durationSec) {
          this.triggeredFlowCommentIds.add(trigger.id);
          const offsetMs = Math.max(0, Math.round((currentTime - triggerStartTime) * 1000));
          this.overlayUi.showFlowComment(trigger, offsetMs);
        }
      }
    }
  }
}

