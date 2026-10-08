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
  private pauseListener: (() => void) | null = null;
  private playListener: (() => void) | null = null;
  private endedListener: (() => void) | null = null;
  private currentVideoId: string = '';
  private isSeeking: boolean = false;

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

      // リアルタイムチャット (Live / Twitch) または タイムスタンプなしコメントの場合: 即時ディスパッチ
      if (
        comment.source === 'live_chat' ||
        comment.source === 'twitch_chat' ||
        !comment.timestamps ||
        comment.timestamps.length === 0
      ) {
        this.dispatchLiveComment(comment);
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

  private dispatchLiveComment(comment: CommentData) {
    if (this.videoEl?.paused) return;

    const isTwitch = comment.platform === 'twitch' || comment.sourcePlatform === 'twitch' || comment.source === 'twitch_chat' || (typeof location !== 'undefined' && location.hostname.includes('twitch.tv'));
    const liveEnabled = isTwitch
      ? (this.overlayUi.getSettings().twitchEnabled ?? true)
      : (this.overlayUi.getSettings().liveChatEnabled ?? true);
    if (!liveEnabled) return;

    const dummyTrigger: TimestampCommentTrigger = {
      comment,
      timestamp: { seconds: Math.floor(this.videoEl?.currentTime || 0), formatted: 'Live' },
      id: comment.id,
    };

    const mode = this.overlayUi.getEffectiveLiveDisplayMode();
    if (mode === 'flow') {
      this.overlayUi.showFlowComment(dummyTrigger, 0);
    } else if (mode === 'chatbox') {
      this.overlayUi.enqueueChatboxComment(comment);
    } else {
      // カードモード: スパチャ/人気コメント、または流量が落ち着いている場合にカード表示
      if (comment.isSuperChat || !this.overlayUi.isHighTraffic()) {
        this.overlayUi.showComment(dummyTrigger);
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

    this.pauseListener = () => {
      if (video.getAttribute('data-yt-overlay-active-token') !== this.syncToken) {
        this.detach();
        return;
      }
      this.overlayUi.pausePlayback();
    };

    this.playListener = () => {
      if (video.getAttribute('data-yt-overlay-active-token') !== this.syncToken) {
        this.detach();
        return;
      }
      this.overlayUi.resumePlayback();
    };

    this.endedListener = () => {
      if (video.getAttribute('data-yt-overlay-active-token') !== this.syncToken) {
        this.detach();
        return;
      }
      this.overlayUi.pausePlayback();
    };

    this.videoEl.addEventListener('timeupdate', this.timeUpdateListener);
    this.videoEl.addEventListener('seeking', this.seekingListener);
    this.videoEl.addEventListener('seeked', this.seekedListener);
    this.videoEl.addEventListener('pause', this.pauseListener);
    this.videoEl.addEventListener('play', this.playListener);
    this.videoEl.addEventListener('ended', this.endedListener);

    // 初期状態の同期
    if (this.videoEl.paused) {
      this.overlayUi.pausePlayback();
    } else {
      this.overlayUi.resumePlayback();
    }
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
      if (this.pauseListener) {
        this.videoEl.removeEventListener('pause', this.pauseListener);
      }
      if (this.playListener) {
        this.videoEl.removeEventListener('play', this.playListener);
      }
      if (this.endedListener) {
        this.videoEl.removeEventListener('ended', this.endedListener);
      }
      this.videoEl = null;
    }
    this.timeUpdateListener = null;
    this.seekingListener = null;
    this.seekedListener = null;
    this.pauseListener = null;
    this.playListener = null;
    this.endedListener = null;
    this.lastCheckedSecond = -1;
  }

  private handleSeeking() {
    this.isSeeking = true;
    // シーク中はオーバーレイをクリアし、チェック済み秒数とレーンをリセット
    this.overlayUi.clearAll();
    this.overlayUi.resetFlowLanes();
    this.lastCheckedSecond = -1;
    this.triggeredFlowCommentIds.clear();
  }

  private handleSeeked() {
    if (!this.videoEl) return;
    this.isSeeking = false;
    const currentTime = this.videoEl.currentTime;
    const currentSecond = Math.floor(currentTime);

    this.overlayUi.clearAll();
    this.overlayUi.resetFlowLanes();
    this.triggeredFlowCommentIds.clear();

    if (this.overlayUi.isFlowModeEnabled()) {
      // フローモード時: シーク先時間で現在画面内に流れているべきコメントを復元
      this.syncFlowCommentsOnSeek(currentTime);
    } else {
      // カードモード時: シーク先秒数をチェック
      this.checkAndTriggerSecond(currentSecond);
    }
    this.lastCheckedSecond = currentSecond;

    // シーク完了時の動画停止状態をOverlayUiに反映
    if (this.videoEl.paused) {
      this.overlayUi.pausePlayback();
    } else {
      this.overlayUi.resumePlayback();
    }
  }

  private handleTimeUpdate() {
    if (!this.videoEl || this.isSeeking) return;
    if (!this.overlayUi.getSettings().enabled) return;
    const currentTime = this.videoEl.currentTime;
    const currentSecond = Math.floor(currentTime);

    // 巻き戻しを検知した場合
    if (this.lastCheckedSecond !== -1 && currentSecond < this.lastCheckedSecond) {
      this.overlayUi.clearAll();
      this.overlayUi.resetFlowLanes();
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
   * ※ 重なり防止および「出現直後にすぐ消える」現象を防ぐため、十分な残り時間があるもののみを別レーンに分散配置
   */
  private syncFlowCommentsOnSeek(currentTime: number) {
    const leadTimeSec = this.overlayUi.getFlowLeadTimeSeconds();
    const durationMs = this.overlayUi.getFlowDuration();
    const durationSec = durationMs / 1000;

    // シーク先で画面内にいる可能性があるタイムスタンプ秒 S の範囲:
    const minS = Math.floor(currentTime + leadTimeSec - durationSec);
    const maxS = Math.ceil(currentTime + leadTimeSec);

    // 候補コメントを収集
    interface FlowCandidate {
      trigger: TimestampCommentTrigger;
      offsetMs: number;
      remainingMs: number;
    }
    const candidates: FlowCandidate[] = [];
    const seenTexts = new Set<string>();

    for (let s = minS; s <= maxS; s++) {
      const triggers = this.triggersBySecond.get(s);
      if (!triggers || triggers.length === 0) continue;

      for (const trigger of triggers) {
        if (this.currentVideoId && trigger.comment.videoId && trigger.comment.videoId !== this.currentVideoId) {
          continue;
        }
        if (this.triggeredFlowCommentIds.has(trigger.id)) {
          continue;
        }

        const normText = trigger.comment.rawText.trim().replace(/\s+/g, ' ');
        if (seenTexts.has(normText)) {
          continue;
        }

        const triggerStartTime = trigger.timestamp.seconds - leadTimeSec;
        const offsetMs = Math.round((currentTime - triggerStartTime) * 1000);
        const remainingMs = durationMs - offsetMs;

        // 途中で消えるのを防ぐ:
        // 残り時間が短すぎるコメント（アニメーション終盤で画面左側に現れてすぐ消えるもの）は復元せずスキップ
        const minRemainingMs = Math.max(3000, durationMs * 0.45);
        if (offsetMs >= 0 && remainingMs >= minRemainingMs) {
          seenTexts.add(normText);
          candidates.push({ trigger, offsetMs, remainingMs });
        }
      }
    }

    // 残り時間が長く、画面右側〜中央に綺麗に出現するものを優先（最大3件）
    candidates.sort((a, b) => b.remainingMs - a.remainingMs);
    const selected = candidates.slice(0, 3);

    // 各コメントに異なるレーン（0, 1, 2...）を割り当てて重なりを防止
    selected.forEach((c, idx) => {
      this.triggeredFlowCommentIds.add(c.trigger.id);
      this.overlayUi.showFlowComment(c.trigger, c.offsetMs, false, idx);
    });
  }
}

