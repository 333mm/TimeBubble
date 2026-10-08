import { CommentData, DEFAULT_SETTINGS, OverlayPosition, OverlaySettings, ReplyData, ReplyFetchResult, TimestampCommentTrigger } from '../types';
import { timeStringToSeconds } from './timestampParser';
import { saveSettings } from '../utils/storage';
import overlayCssRaw from './overlay.css?raw';

const STYLE_ID = 'yt-comment-overlay-styles';
const CONTAINER_ID = 'yt-comment-overlay-container';

const SUPPORT_DEV_LABELS: Record<string, string> = {
  ja: '開発者をサポート',
  en: 'Support Developer',
  es: 'Apoyar al desarrollador',
  zh: '支持开发者',
};

export class OverlayUi {
  private containerEl: HTMLElement | null = null;
  private playerElement: HTMLElement | null = null;
  private modalRootEl: HTMLElement | null = null;
  private quickToggleBtnEl: HTMLElement | null = null;
  private chatboxContainerEl: HTMLElement | null = null;
  private playerControlsBarEl: HTMLElement | null = null;
  private recentCommentTimestamps: number[] = [];
  private onPipToggleCallback: (() => void) | null = null;
  private onModeCycleCallback: (() => void) | null = null;
  private likedCommentIds = new Set<string>();
  private settings: OverlaySettings = DEFAULT_SETTINGS;
  private activeCards = new Map<string, {
    el: HTMLElement;
    timerId: number | null;
    remainingMs: number;
    startedAt: number;
  }>();
  private activeFlowItems = new Map<HTMLElement, {
    timerId: number | null;
    remainingMs: number;
    startedAt: number;
  }>();
  private isPlaybackPaused = false;
  private exitingElements = new Set<HTMLElement>();
  private testCommentCounter = 0;
  private fetchRepliesCallback: ((comment: CommentData) => Promise<ReplyFetchResult>) | null = null;
  // フローモード用: アクティブな流れるコメント要素
  private flowLanes: Array<number> = []; // 各レーンの使用解除タイムスタンプ (ms)

  /** 返信フェッチ用コールバックを設定 */
  public setFetchRepliesCallback(cb: (comment: CommentData) => Promise<ReplyFetchResult>) {
    this.fetchRepliesCallback = cb;
  }

  /** PiPトグルコールバックを設定 */
  public setOnPipToggleCallback(cb: () => void) {
    this.onPipToggleCallback = cb;
  }

  /** モード切替コールバックを設定 */
  public setOnModeCycleCallback(cb: () => void) {
    this.onModeCycleCallback = cb;
  }

  /** オーバーレイ用CSSのRaw文字列を返す */
  public getCssRaw(): string {
    return overlayCssRaw;
  }

  /** 現在マウントされているプレイヤー要素を返す */
  public getPlayerElement(): HTMLElement | null {
    return this.playerElement;
  }

  /** オーバーレイコンテナ要素を返す (PiP移行用) */
  public getContainerElement(): HTMLElement | null {
    return this.containerEl;
  }

  /** 現在の設定オブジェクトを返す */
  public getSettings(): OverlaySettings {
    return this.settings;
  }

  /** 有効な表示モードを取得 ('card' | 'flow' | 'chatbox') */
  public getEffectiveDisplayMode(): 'card' | 'flow' | 'chatbox' {
    if (this.settings.displayMode === 'chatbox') return 'chatbox';
    if (this.settings.displayMode === 'flow' || this.settings.flowMode) return 'flow';
    return 'card';
  }

  /** 有効なライブ表示モードを取得 ('card' | 'flow' | 'chatbox') */
  public getEffectiveLiveDisplayMode(): 'card' | 'flow' | 'chatbox' {
    return this.settings.liveChatMode || 'flow';
  }

  /** コメント流量が激しいかどうか (毎秒トラフィック判定) */
  public isHighTraffic(): boolean {
    const now = Date.now();
    this.recentCommentTimestamps = this.recentCommentTimestamps.filter((t) => now - t < 3000);
    this.recentCommentTimestamps.push(now);
    const density = this.settings.liveChatMaxDensity || this.settings.flowDensity || 'normal';
    const threshold = density === 'low' ? 3 : density === 'high' ? 12 : 6;
    return this.recentCommentTimestamps.length > threshold;
  }

  /** フローモードが有効かどうかを返す */
  public isFlowModeEnabled(): boolean {
    return !!(this.settings.flowMode || this.settings.displayMode === 'flow');
  }

  /** フローコメントの画面横断所要時間(ms)を計算 */
  public getFlowDuration(playerWidth?: number, isLive = false): number {
    const width = playerWidth || this.playerElement?.clientWidth || 640;
    const speed = isLive
      ? (this.settings.liveFlowSpeed || this.settings.flowSpeed || 'normal')
      : (this.settings.flowSpeed || 'normal');
    const base = speed === 'slow' ? 9000 : speed === 'fast' ? 4500 : 6500;
    const scale = Math.max(0.85, Math.min(1.25, width / 960));
    return Math.round(base * scale);
  }

  /** タイムスタンプ秒の瞬間に画面中央手前付近(約40%地点)へ到達するための先行秒数を計算 */
  public getFlowLeadTimeSeconds(playerWidth?: number, isLive = false): number {
    const durationMs = this.getFlowDuration(playerWidth, isLive);
    // 画面中央手前（右端から40%移動した地点）に達するまでの時間（秒）
    return (durationMs * 0.40) / 1000;
  }

  /**
   * 動画再生一時停止時: コメントの流れとカードの表示残りカウントを一時停止
   */
  public pausePlayback() {
    if (this.isPlaybackPaused) return;
    this.isPlaybackPaused = true;
    const now = Date.now();

    // 1. カード表示のタイマー停止と残り時間の記録
    for (const item of this.activeCards.values()) {
      if (item.timerId !== null) {
        window.clearTimeout(item.timerId);
        item.timerId = null;
        const elapsed = now - item.startedAt;
        item.remainingMs = Math.max(0, item.remainingMs - elapsed);
      }
    }

    // 2. 流れるコメントのアニメーション一時停止と削除タイマー停止
    for (const [flowEl, item] of this.activeFlowItems.entries()) {
      flowEl.classList.add('is-paused');
      if (item.timerId !== null) {
        window.clearTimeout(item.timerId);
        item.timerId = null;
        const elapsed = now - item.startedAt;
        item.remainingMs = Math.max(0, item.remainingMs - elapsed);
      }
    }
  }

  /**
   * 動画再生再開時: コメントの流れとカードの表示残りカウントを再開
   */
  public resumePlayback() {
    if (!this.isPlaybackPaused) return;
    this.isPlaybackPaused = false;
    const now = Date.now();

    // 1. カード表示の残りタイマーを再開
    for (const [key, item] of this.activeCards.entries()) {
      if (item.timerId === null && item.remainingMs > 0) {
        item.startedAt = now;
        item.timerId = window.setTimeout(() => {
          this.dismissCard(key);
        }, item.remainingMs);
      }
    }

    // 2. 流れるコメントのアニメーション再開と削除タイマー再開
    for (const [flowEl, item] of this.activeFlowItems.entries()) {
      flowEl.classList.remove('is-paused');
      if (item.timerId === null && item.remainingMs > 0) {
        item.startedAt = now;
        item.timerId = window.setTimeout(() => {
          this.activeFlowItems.delete(flowEl);
          if (flowEl.parentElement) {
            flowEl.parentElement.removeChild(flowEl);
          }
        }, item.remainingMs);
      }
    }
  }


  private getOwnerDocument(): Document {
    return this.playerElement?.ownerDocument || (typeof document !== 'undefined' ? document : null as any);
  }

  constructor() {
    this.ensureGlobalStyles();
  }

  private ensureGlobalStyles(targetDoc: Document = document) {
    if (!targetDoc) return;
    let styleEl = targetDoc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = targetDoc.createElement('style');
      styleEl.id = STYLE_ID;
      (targetDoc.head || targetDoc.documentElement).appendChild(styleEl);
    }
    if (styleEl.textContent !== overlayCssRaw) {
      styleEl.textContent = overlayCssRaw;
    }
  }

  public init(settings: OverlaySettings) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.ensureGlobalStyles();
  }

  public updateSettings(newSettings: OverlaySettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.applySettingsToContainer();
  }

  /**
   * 動画プレイヤーへのマウント
   */
  public mount(playerElement: HTMLElement): boolean {
    const ownerDoc = playerElement.ownerDocument || document;
    this.ensureGlobalStyles(ownerDoc);
    this.playerElement = playerElement;

    // 親要素の position が static なら relative を付与して絶対配置の基準にする (bodyは除く)
    const win = ownerDoc.defaultView || window;
    const computedPos = win.getComputedStyle(playerElement).position;
    if (playerElement !== ownerDoc.body && computedPos === 'static') {
      playerElement.style.position = 'relative';
    }
    if (playerElement !== ownerDoc.body) {
      playerElement.style.overflow = 'hidden';
    }

    // すでに同じ親にマウントされていれば設定更新のみで完了（表示中カードを消さない！）
    if (this.containerEl && this.containerEl.parentElement === playerElement) {
      this.applySettingsToContainer();
      return true;
    }

    // 別ドキュメントや別の親から切り替わる場合、古いコンテナを解除
    if (this.containerEl && this.containerEl.parentElement !== playerElement) {
      this.containerEl.parentElement?.removeChild(this.containerEl);
      this.containerEl = null;
    }

    // DOM全体から既存のコンテナ（古いサイズや孤立したもの）をすべて探索
    const existingContainers = ownerDoc.querySelectorAll<HTMLElement>(`#${CONTAINER_ID}`);
    let targetContainer: HTMLElement | null = null;

    for (const el of Array.from(existingContainers)) {
      if (el.parentElement === playerElement && !targetContainer) {
        targetContainer = el;
      } else {
        // 重複している余分なコンテナはDOMから安全に完全除去
        el.parentElement?.removeChild(el);
      }
    }

    if (targetContainer) {
      this.containerEl = targetContainer;
      this.mountQuickToggleButton(playerElement);
      this.applySettingsToContainer();
      return true;
    }

    // 新規作成 (ターゲットドキュメント内で作成)
    const container = ownerDoc.createElement('div');
    container.id = CONTAINER_ID;
    const size = this.settings.size || 'medium';
    container.className = `pos-${this.settings.position} size-${size}`;

    this.containerEl = container;
    playerElement.appendChild(container);
    this.mountQuickToggleButton(playerElement);
    this.applySettingsToContainer();

    console.log('[YT-Comment-Overlay] Successfully mounted container to:', playerElement);
    return true;
  }

  public destroy() {
    this.closeExpandedComment();
    this.removeQuickToggleButton();
    this.removePlayerControlsBar();
    this.clearAll();
    const existingContainers = document.querySelectorAll<HTMLElement>(`#${CONTAINER_ID}`);
    existingContainers.forEach((el) => el.parentElement?.removeChild(el));
    this.containerEl = null;
  }

  public clearAll() {
    this.closeExpandedComment();
    for (const item of this.activeCards.values()) {
      if (item.timerId !== null) {
        clearTimeout(item.timerId);
      }
      if (item.el.parentElement) {
        item.el.parentElement.removeChild(item.el);
      }
    }
    this.activeCards.clear();

    for (const el of this.exitingElements) {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    }
    this.exitingElements.clear();

    for (const [el, item] of this.activeFlowItems.entries()) {
      if (item.timerId !== null) {
        clearTimeout(item.timerId);
      }
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    }
    this.activeFlowItems.clear();
  }


  private applySettingsToContainer() {
    // ページ上に重複コンテナがあれば1つを残して削除
    const existingContainers = document.querySelectorAll<HTMLElement>(`#${CONTAINER_ID}`);
    if (existingContainers.length > 1) {
      for (let i = 1; i < existingContainers.length; i++) {
        existingContainers[i].parentElement?.removeChild(existingContainers[i]);
      }
      this.containerEl = existingContainers[0];
    }

    if (this.playerElement && (!this.containerEl || !this.containerEl.parentElement)) {
      this.mount(this.playerElement);
      return;
    }

    if (!this.containerEl) return;

    const size = this.settings.size || 'medium';
    this.containerEl.className = `pos-${this.settings.position} size-${size}`;
    this.containerEl.style.display = this.settings.enabled ? 'flex' : 'none';

    // 文字・アイコン・バッジは100%不透明を維持し、背景とアウトラインのみ透明度を適用
    this.containerEl.style.opacity = '1';
    const rawOpacity = typeof this.settings.opacity === 'number' ? this.settings.opacity : 80;
    const bgAlpha = Math.max(0, Math.min(1, rawOpacity / 100));
    this.containerEl.style.setProperty('--yt-co-bg-opacity', bgAlpha.toString());
    this.containerEl.style.setProperty('--yt-co-border-opacity', (bgAlpha * 0.22).toString());

    // YouTube外の一般ページ（document.bodyマウント）の場合は画面四隅に固定配置
    if (this.containerEl.parentElement === document.body) {
      this.containerEl.style.position = 'fixed';
      this.containerEl.style.zIndex = '2147483647';
      this.containerEl.style.pointerEvents = 'none';
      if (this.settings.position === 'top-right') {
        this.containerEl.style.top = '16px';
        this.containerEl.style.right = '16px';
        this.containerEl.style.bottom = 'auto';
        this.containerEl.style.left = 'auto';
      } else if (this.settings.position === 'top-left') {
        this.containerEl.style.top = '16px';
        this.containerEl.style.left = '16px';
        this.containerEl.style.bottom = 'auto';
        this.containerEl.style.right = 'auto';
      } else if (this.settings.position === 'bottom-right') {
        this.containerEl.style.bottom = '16px';
        this.containerEl.style.right = '16px';
        this.containerEl.style.top = 'auto';
        this.containerEl.style.left = 'auto';
      } else if (this.settings.position === 'bottom-left') {
        this.containerEl.style.bottom = '16px';
        this.containerEl.style.left = '16px';
        this.containerEl.style.top = 'auto';
        this.containerEl.style.right = 'auto';
      }
    } else {
      this.containerEl.style.position = 'absolute';
      this.containerEl.style.removeProperty('z-index');
      this.containerEl.style.removeProperty('top');
      this.containerEl.style.removeProperty('right');
      this.containerEl.style.removeProperty('bottom');
      this.containerEl.style.removeProperty('left');
    }

    this.updateQuickToggleButton();
  }

  public setPosition(pos: OverlayPosition) {
    this.settings.position = pos;
    this.applySettingsToContainer();
  }

  /**
   * テスト用吹き出し・流れるコメント表示 (ポップアップから要求時)
   * 選択中のモード（カード表示 / 流れるコメント）に応じて適切なプレビューを表示
   */
  public showTestComment(testKind?: 'timestamp' | 'live') {
    console.log('[TimeBubble] showTestComment executing, kind:', testKind);

    // まだマウントされていない場合は強制探索してマウント (YouTube外の一般ページの場合は document.body)
    if (!this.containerEl || !this.containerEl.parentElement) {
      const video = document.querySelector<HTMLVideoElement>('video');
      const playerCandidate =
        video?.closest<HTMLElement>('#movie_player, .html5-video-player') ||
        document.querySelector<HTMLElement>('#movie_player, .html5-video-player') ||
        video?.parentElement ||
        document.querySelector<HTMLElement>('#player-container, #ytd-player, ytd-watch-flexy') ||
        document.body;

      if (playerCandidate) {
        this.mount(playerCandidate);
      }
    }

    const isLive = testKind === 'live';

    if (isLive) {
      const liveMode = this.getEffectiveLiveDisplayMode();
      const liveSamples = [
        { text: 'キターーーー！！配信待機してました！🎉', author: 'ライブファンA', badge: 'VIP', color: '#c084fc' },
        { text: 'ナイス配信！いつも応援してます🔥', author: 'サポーターB', badge: 'SUPER', color: '#f59e0b', isSuper: true, amount: '¥1,000' },
        { text: '荒らしは即座に対処します。楽しく見ましょう！', author: 'モデレーターC', badge: 'MOD', color: '#4ade80' },
        { text: '音質めちゃくちゃクリアで最高です✨', author: 'リスナーD', badge: 'SUB', color: '#38bdf8' },
      ];

      if (liveMode === 'flow') {
        liveSamples.forEach((sample, i) => {
          setTimeout(() => {
            this.testCommentCounter += 1;
            const testTrigger: TimestampCommentTrigger = {
              id: `test_live_flow_${Date.now()}_${i}_${this.testCommentCounter}`,
              comment: {
                id: `test_live_${this.testCommentCounter}`,
                authorName: sample.author,
                authorAvatarUrl: '',
                authorChannelUrl: '',
                contentHtml: sample.text,
                rawText: sample.text,
                userColor: sample.color,
                badges: [sample.badge],
                isSuperChat: !!sample.isSuper,
                superChatAmount: sample.amount,
                superChatColor: sample.isSuper ? '#f59e0b' : undefined,
                likeCount: 0,
                formattedLikeCount: '0',
                publishedTimeText: 'Live',
                timestamps: [{ seconds: 0, formatted: 'Live' }],
                sourcePlatform: 'youtube',
              },
              timestamp: { seconds: 0, formatted: 'Live' },
            };
            this.showFlowComment(testTrigger, 0, true);
          }, i * 350);
        });
        return;
      }

      if (liveMode === 'chatbox') {
        liveSamples.forEach((sample, i) => {
          setTimeout(() => {
            this.testCommentCounter += 1;
            this.enqueueChatboxComment({
              id: `test_live_chat_${this.testCommentCounter}`,
              authorName: sample.author,
              authorAvatarUrl: '',
              authorChannelUrl: '',
              contentHtml: sample.text,
              rawText: sample.text,
              userColor: sample.color,
              badges: [sample.badge],
              isSuperChat: !!sample.isSuper,
              superChatAmount: sample.amount,
              superChatColor: sample.isSuper ? '#f59e0b' : undefined,
              likeCount: 0,
              formattedLikeCount: '0',
              publishedTimeText: 'Live',
              timestamps: [{ seconds: 0, formatted: 'Live' }],
              sourcePlatform: 'youtube',
              source: 'live_chat',
            });
          }, i * 250);
        });
        return;
      }

      // ライブ: カードモード
      if (this.containerEl) {
        this.containerEl.style.display = 'flex';
        this.containerEl.style.opacity = '1';
        this.applySettingsToContainer();
      }
      liveSamples.slice(0, 2).forEach((sample, i) => {
        setTimeout(() => {
          this.testCommentCounter += 1;
          const testTrigger: TimestampCommentTrigger = {
            id: `test_live_card_${Date.now()}_${i}_${this.testCommentCounter}`,
            comment: {
              id: `test_live_${this.testCommentCounter}`,
              authorName: sample.author,
              authorAvatarUrl: '',
              authorChannelUrl: '',
              contentHtml: sample.text,
              rawText: sample.text,
              userColor: sample.color,
              badges: [sample.badge],
              isSuperChat: !!sample.isSuper,
              superChatAmount: sample.amount,
              superChatColor: sample.isSuper ? '#f59e0b' : undefined,
              likeCount: 0,
              formattedLikeCount: '0',
              publishedTimeText: 'Live',
              timestamps: [{ seconds: 0, formatted: 'Live' }],
              sourcePlatform: 'youtube',
            },
            timestamp: { seconds: 0, formatted: 'Live' },
          };
          this.showComment(testTrigger, true);
        }, i * 240);
      });
      return;
    }

    // タイムスタンプコメントのテスト表示
    const testSamples = [
      { text: '01:23 ここが一番好きなシーン！何度見ても最高です✨', author: 'テスト視聴者A', likes: 350, time: '01:23' },
      { text: 'この演出鳥肌立った…神回すぎる！🔥 02:45', author: 'テスト視聴者B', likes: 1200, time: '02:45' },
      { text: '03:10 音響とBGMの入り方が完璧👏 何度でもリピートできる', author: 'テスト視聴者C', likes: 88, time: '03:10' },
      { text: 'ここ伏線回収だったのか！すごすぎる…！ 04:05', author: 'テスト視聴者D', likes: 540, time: '04:05' },
      { text: '05:30 作画のクオリティが映画レベルで圧倒される🎬', author: 'テスト視聴者E', likes: 210, time: '05:30' },
    ];

    const effectiveMode = this.getEffectiveDisplayMode();

    if (effectiveMode === 'flow') {
      const count = 4;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          this.testCommentCounter += 1;
          const sample = testSamples[i % testSamples.length];
          const testTrigger: TimestampCommentTrigger = {
            id: `test_trigger_flow_${Date.now()}_${i}_${this.testCommentCounter}`,
            comment: {
              id: `test_comment_${this.testCommentCounter}`,
              authorName: sample.author,
              authorAvatarUrl: '',
              authorChannelUrl: 'https://www.youtube.com',
              contentHtml: sample.text,
              rawText: sample.text,
              likeCount: sample.likes,
              formattedLikeCount: String(sample.likes),
              publishedTimeText: '数分前',
              timestamps: [{ seconds: 0, formatted: sample.time }],
            },
            timestamp: { seconds: 0, formatted: sample.time },
          };
          this.showFlowComment(testTrigger, 0, true);
        }, i * 350);
      }
      return;
    }

    if (effectiveMode === 'chatbox') {
      testSamples.slice(0, 3).forEach((sample, i) => {
        setTimeout(() => {
          this.testCommentCounter += 1;
          this.enqueueChatboxComment({
            id: `test_ts_chat_${this.testCommentCounter}`,
            authorName: sample.author,
            authorAvatarUrl: '',
            authorChannelUrl: 'https://www.youtube.com',
            contentHtml: sample.text,
            rawText: sample.text,
            likeCount: sample.likes,
            formattedLikeCount: String(sample.likes),
            publishedTimeText: '数分前',
            timestamps: [{ seconds: 0, formatted: sample.time }],
          });
        }, i * 250);
      });
      return;
    }

    if (this.containerEl) {
      this.containerEl.style.display = 'flex';
      this.containerEl.style.opacity = '1';
      this.applySettingsToContainer();
    }

    const stackCount = Math.max(1, Math.min(this.settings.maxStackCount || 3, testSamples.length));
    for (let i = 0; i < stackCount; i++) {
      setTimeout(() => {
        this.testCommentCounter += 1;
        const sample = testSamples[i % testSamples.length];

        const testTrigger: TimestampCommentTrigger = {
          id: `test_trigger_${Date.now()}_${i}_${this.testCommentCounter}`,
          comment: {
            id: `test_comment_${this.testCommentCounter}`,
            authorName: `${sample.author} (#${i + 1}/${stackCount})`,
            authorAvatarUrl: '',
            authorChannelUrl: 'https://www.youtube.com',
            contentHtml: sample.text,
            rawText: sample.text,
            likeCount: sample.likes,
            formattedLikeCount: String(sample.likes),
            publishedTimeText: '数分前',
            timestamps: [{ seconds: 0, formatted: sample.time }],
          },
          timestamp: { seconds: 0, formatted: sample.time },
        };

        this.showComment(testTrigger, true);
      }, i * 220);
    }
  }


  /**
   * コメント吹き出しをスタックに追加して表示
   */
  public showComment(trigger: TimestampCommentTrigger, force = false) {
    const isLive = trigger.timestamp.formatted === 'Live' || trigger.comment.sourcePlatform === 'twitch';
    if (!force) {
      if (isLive) {
        const liveEnabled = trigger.comment.sourcePlatform === 'twitch' ? (this.settings.twitchEnabled ?? true) : (this.settings.liveChatEnabled ?? true);
        if (!liveEnabled) return;
        if (this.getEffectiveLiveDisplayMode() !== 'card') return;
      } else {
        if (!this.settings.enabled) return;
        if (this.getEffectiveDisplayMode() !== 'card') return;
      }
    }

    if (!this.containerEl || !this.containerEl.parentElement) {
      const video = document.querySelector<HTMLVideoElement>('video');
      const playerCandidate =
        this.playerElement ||
        video?.closest<HTMLElement>('#movie_player, .html5-video-player') ||
        document.querySelector<HTMLElement>('#movie_player, .html5-video-player') ||
        video?.parentElement ||
        document.body;

      if (playerCandidate) {
        this.mount(playerCandidate);
      }
    }

    if (!this.containerEl) {
      console.warn('[YT-Comment-Overlay] Container not ready to show comment');
      return;
    }

    if (force) {
      this.containerEl.style.display = 'flex';
      this.containerEl.style.opacity = '1';
    }

    const now = Date.now();
    const durationSec = isLive
      ? (this.settings.liveDisplayDuration ?? this.settings.displayDuration ?? 6)
      : this.settings.displayDuration;
    const durationMs = durationSec * 1000;

    const key = trigger.id;
    if (this.activeCards.has(key)) {
      const existing = this.activeCards.get(key)!;
      if (existing.timerId !== null) {
        clearTimeout(existing.timerId);
      }
      existing.remainingMs = durationMs;
      existing.startedAt = now;
      if (!this.isPlaybackPaused) {
        existing.timerId = window.setTimeout(() => {
          this.dismissCard(key);
        }, durationMs);
      } else {
        existing.timerId = null;
      }
      return;
    }

    // 画面上にすでに同じ内容のコメントが表示されている場合は二重表示を防止
    const cleanNewText = trigger.comment.rawText.replace(/\s+/g, ' ').trim();
    for (const [activeKey, item] of this.activeCards.entries()) {
      const existingText = item.el.querySelector('.yt-overlay-body')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (
        existingText &&
        (existingText === cleanNewText ||
          (cleanNewText.length > 6 && existingText.includes(cleanNewText)) ||
          (existingText.length > 6 && cleanNewText.includes(existingText)))
      ) {
        if (item.timerId !== null) {
          clearTimeout(item.timerId);
        }
        item.remainingMs = durationMs;
        item.startedAt = now;
        if (!this.isPlaybackPaused) {
          item.timerId = window.setTimeout(() => {
            this.dismissCard(activeKey);
          }, durationMs);
        } else {
          item.timerId = null;
        }
        return;
      }
    }

    // 最大スタック数を超えている場合は一番古いコメントを押し出しアニメーションで退場させる
    while (this.activeCards.size >= this.settings.maxStackCount) {
      const oldestKey = this.activeCards.keys().next().value;
      if (oldestKey) {
        this.pushOutCard(oldestKey);
      } else {
        break;
      }
    }

    const bubble = this.createBubbleElement(trigger);
    this.containerEl.appendChild(bubble);
    console.log('🎉 [YT-Comment-Overlay] Comment bubble added to DOM:', key);

    let timerId: number | null = null;
    if (!this.isPlaybackPaused) {
      timerId = window.setTimeout(() => {
        this.dismissCard(key);
      }, durationMs);
    }

    this.activeCards.set(key, {
      el: bubble,
      timerId,
      remainingMs: durationMs,
      startedAt: now,
    });
  }

  /**
   * スタック上限超過時、古いコメントを上に押し出すアニメーションで退場させる
   */
  private pushOutCard(key: string) {
    const item = this.activeCards.get(key);
    if (!item) return;

    if (item.timerId !== null) {
      clearTimeout(item.timerId);
    }
    this.activeCards.delete(key);


    const el = item.el;
    this.exitingElements.add(el);
    el.classList.add('is-exiting');

    const measuredHeight = el.getBoundingClientRect().height || el.offsetHeight || 100;
    const computedStyle = window.getComputedStyle(el);
    const padTop = computedStyle.paddingTop;
    const padBottom = computedStyle.paddingBottom;
    const gap = this.settings.size === 'large' ? 14 : this.settings.size === 'small' ? 8 : 10;

    // 退場中のGPU負荷（backdrop-filter再計算）を一時解除
    el.style.backdropFilter = 'none';
    (el.style as any).webkitBackdropFilter = 'none';
    el.style.background = 'rgba(18, 22, 34, 0.95)';
    el.style.pointerEvents = 'none';
    el.style.overflow = 'hidden';

    // CSS変数も設定（CSSフォールバック用）
    el.style.setProperty('--card-height', `${measuredHeight}px`);
    el.style.setProperty('--card-pad-top', padTop);
    el.style.setProperty('--card-pad-bottom', padBottom);
    el.style.setProperty('--bubble-gap', `${gap}px`);

    const totalDuration = 600;
    const phase1Ratio = 0.38;

    if (typeof el.animate === 'function') {
      const anim = el.animate(
        [
          // 前半 (0%〜38%): 高さを100%完全維持したまま、opacity のみを 1 -> 0 へフェードアウト（文字変形ゼロ）
          {
            opacity: 1,
            transform: 'translateY(0)',
            height: `${measuredHeight}px`,
            maxHeight: `${measuredHeight}px`,
            paddingTop: padTop,
            paddingBottom: padBottom,
            marginBottom: '0px',
            borderTopWidth: '1px',
            borderBottomWidth: '1px',
            offset: 0,
            easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
          },
          {
            opacity: 0,
            transform: 'translateY(-8px)',
            height: `${measuredHeight}px`, // 高さは一切縮めない
            maxHeight: `${measuredHeight}px`,
            paddingTop: padTop,            // パディングも一切縮めない
            paddingBottom: padBottom,
            marginBottom: '0px',
            borderTopWidth: '1px',
            borderBottomWidth: '1px',
            offset: phase1Ratio,           // 38%時点で完全透明
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // 後半の収縮イージング
          },
          // 後半 (38%〜100%): 完全に透明になったカードの高さをスーーッと収縮させ、下のカードをスムーズに繰り上げ
          {
            opacity: 0,
            transform: 'translateY(-24px)',
            height: '0px',
            maxHeight: '0px',
            paddingTop: '0px',
            paddingBottom: '0px',
            marginBottom: `-${gap}px`,
            borderTopWidth: '0px',
            borderBottomWidth: '0px',
            offset: 1,
          },
        ],
        {
          duration: totalDuration,
          fill: 'forwards',
        }
      );

      anim.onfinish = () => {
        if (el.parentElement) {
          el.parentElement.removeChild(el);
        }
        this.exitingElements.delete(el);
      };
    } else {
      el.classList.add('bubble-pushed-out');
      window.setTimeout(() => {
        if (el.parentElement) {
          el.parentElement.removeChild(el);
        }
        this.exitingElements.delete(el);
      }, totalDuration + 20);
    }
  }

  private dismissCard(key: string, immediate = false) {
    const item = this.activeCards.get(key);
    if (!item) return;

    if (item.timerId !== null) {
      clearTimeout(item.timerId);
    }
    this.activeCards.delete(key);


    const el = item.el;
    if (immediate) {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
      return;
    }

    this.exitingElements.add(el);
    el.classList.add('is-exiting');

    const measuredHeight = el.getBoundingClientRect().height || el.offsetHeight || 100;
    const computedStyle = window.getComputedStyle(el);
    const padTop = computedStyle.paddingTop;
    const padBottom = computedStyle.paddingBottom;
    const gap = this.settings.size === 'large' ? 14 : this.settings.size === 'small' ? 8 : 10;
    const isLeft = this.settings.position.includes('left');
    const exitX = isLeft ? -24 : 24;

    el.style.pointerEvents = 'none';
    el.style.overflow = 'hidden';

    // CSS変数も設定（CSSフォールバック用）
    el.style.setProperty('--card-height', `${measuredHeight}px`);
    el.style.setProperty('--card-pad-top', padTop);
    el.style.setProperty('--card-pad-bottom', padBottom);
    el.style.setProperty('--exit-x', `${exitX}px`);
    el.style.setProperty('--bubble-gap', `${gap}px`);

    const totalDuration = 600;
    const phase1Ratio = 0.38;

    if (typeof el.animate === 'function') {
      const anim = el.animate(
        [
          // 前半 (0%〜38%): 高さを100%完全維持したまま、opacity のみを 1 -> 0 へフェードアウト（文字変形ゼロ）
          {
            opacity: 1,
            transform: 'translateX(0)',
            height: `${measuredHeight}px`,
            maxHeight: `${measuredHeight}px`,
            paddingTop: padTop,
            paddingBottom: padBottom,
            marginBottom: '0px',
            borderTopWidth: '1px',
            borderBottomWidth: '1px',
            offset: 0,
            easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
          },
          {
            opacity: 0,
            transform: `translateX(${exitX * 0.5}px)`,
            height: `${measuredHeight}px`, // 高さは一切縮めない
            maxHeight: `${measuredHeight}px`,
            paddingTop: padTop,            // パディングも一切縮めない
            paddingBottom: padBottom,
            marginBottom: '0px',
            borderTopWidth: '1px',
            borderBottomWidth: '1px',
            offset: phase1Ratio,           // 38%時点で完全透明
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // 後半の収縮イージング
          },
          // 後半 (38%〜100%): 完全に透明になったカードの高さをスーーッと収縮させ、下のカードをスムーズに繰り上げ
          {
            opacity: 0,
            transform: `translateX(${exitX}px)`,
            height: '0px',
            maxHeight: '0px',
            paddingTop: '0px',
            paddingBottom: '0px',
            marginBottom: `-${gap}px`,
            borderTopWidth: '0px',
            borderBottomWidth: '0px',
            offset: 1,
          },
        ],
        {
          duration: totalDuration,
          fill: 'forwards',
        }
      );

      anim.onfinish = () => {
        if (el.parentElement) {
          el.parentElement.removeChild(el);
        }
        this.exitingElements.delete(el);
      };
    } else {
      el.classList.add('bubble-exit');
      window.setTimeout(() => {
        if (el.parentElement) {
          el.parentElement.removeChild(el);
        }
        this.exitingElements.delete(el);
      }, totalDuration + 20);
    }
  }

  /**
   * Trusted Types / CSP に完全準拠した安全なDOM生成 (innerHTML不使用)
   */
  private createBubbleElement(trigger: TimestampCommentTrigger): HTMLElement {
    const doc = this.getOwnerDocument();
    const { comment, timestamp } = trigger;
    const isLive = timestamp.formatted === 'Live' || comment.sourcePlatform === 'twitch';
    const bubble = doc.createElement('div');
    const size = isLive
      ? (this.settings.liveSize || this.settings.size || 'medium')
      : (this.settings.size || 'medium');
    bubble.className = `yt-co-bubble yt-co-size-${size}`;
    bubble.setAttribute('data-size', size);

    if (isLive) {
      if (typeof this.settings.liveOpacity === 'number') {
        const bgAlpha = Math.max(0, Math.min(1, this.settings.liveOpacity / 100));
        bubble.style.setProperty('--card-bg-alpha', bgAlpha.toString());
      }
    } else {
      if (typeof this.settings.opacity === 'number') {
        const bgAlpha = Math.max(0, Math.min(1, this.settings.opacity / 100));
        bubble.style.setProperty('--card-bg-alpha', bgAlpha.toString());
      }
    }

    if (!isLive && this.settings.highlightPopular) {
      if (comment.likeCount >= this.settings.topTierThreshold) {
        bubble.classList.add('is-toptier');
      } else if (comment.likeCount >= this.settings.popularThreshold) {
        bubble.classList.add('is-popular');
      }
    } else if (isLive && comment.isSuperChat) {
      bubble.classList.add('is-toptier');
    }

    bubble.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openExpandedComment(trigger);
    });

    // ヘッダー構造
    const header = doc.createElement('div');
    header.className = 'yt-co-header';

    const meta = doc.createElement('div');
    meta.className = 'yt-co-meta';

    const author = doc.createElement('span');
    author.className = 'yt-co-author';
    if (isLive && comment.userColor) {
      author.style.color = comment.userColor;
    }
    author.textContent = comment.authorName;

    meta.appendChild(author);

    if (comment.isDescription) {
      const descBadge = doc.createElement('span');
      descBadge.className = 'yt-co-chapter-badge';
      descBadge.textContent = '見どころ';
      meta.appendChild(descBadge);
    }

    // ユーザーアイコン
    const shouldShowAvatar = isLive
      ? (this.settings.liveShowAvatars ?? this.settings.showLiveAvatars ?? true)
      : (this.settings.showAvatars ?? true);
    if (shouldShowAvatar) {
      const avatarEl = this.createAvatarElement(comment.authorName, comment.authorAvatarUrl);
      header.appendChild(avatarEl);
    }

    // ライブバッジ
    const shouldShowBadges = isLive
      ? (this.settings.liveShowBadges ?? this.settings.showBadges ?? true)
      : false;
    if (shouldShowBadges && comment.badges && comment.badges.length > 0) {
      comment.badges.forEach((b) => {
        const badgeEl = this.createBadgeElement(b);
        meta.appendChild(badgeEl);
      });
    }

    if (isLive && comment.isSuperChat && comment.superChatAmount) {
      const scBadge = doc.createElement('span');
      scBadge.className = 'yt-co-chapter-badge';
      scBadge.style.background = comment.superChatColor || '#f59e0b';
      scBadge.style.color = '#fff';
      scBadge.textContent = `💰 ${comment.superChatAmount}`;
      meta.appendChild(scBadge);
    }

    header.appendChild(meta);

    // いいね数バッジ
    if (comment.likeCount > 0) {
      const likesBadge = doc.createElement('span');
      likesBadge.className = 'yt-co-likes-badge';

      const likeSvg = this.createSvgElement('0 0 24 24', 12, 12);
      likeSvg.classList.add('yt-co-likes-icon');
      const likePath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      likePath.setAttribute('d', 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z');
      likeSvg.appendChild(likePath);

      likesBadge.appendChild(likeSvg);
      likesBadge.appendChild(doc.createTextNode(` ${comment.formattedLikeCount}`));
      header.appendChild(likesBadge);
    }

    // 本文テキスト（時間の部分をバッジに置き換えてインライン配置）
    const content = doc.createElement('div');
    content.className = 'yt-co-content';
    this.renderContentWithTimestamps(content, comment.rawText, timestamp.formatted);

    // フッター (詳細表示・拡張インジケーター)
    const footer = doc.createElement('div');
    footer.className = 'yt-co-footer';

    const footerText = doc.createElement('span');
    footerText.textContent = '詳細を表示';

    const expandSvg = this.createSvgElement('0 0 24 24', 11, 11);
    expandSvg.classList.add('yt-co-expand-icon');
    expandSvg.setAttribute('stroke', 'currentColor');
    expandSvg.setAttribute('stroke-width', '2');
    expandSvg.setAttribute('fill', 'none');
    const expandPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    expandPath.setAttribute('d', 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7');
    expandSvg.appendChild(expandPath);

    footer.appendChild(footerText);
    footer.appendChild(expandSvg);

    bubble.appendChild(header);
    bubble.appendChild(content);
    bubble.appendChild(footer);

    return bubble;
  }

  /**
   * コメント本文内のタイムスタンプ（時間表記）部分を検出し、バッジ要素に置き換えてインライン配置
   */
  private renderContentWithTimestamps(contentEl: HTMLElement, rawText: string, currentTimestamp: string) {
    // タイムスタンプパターン: (HH:)?MM:SS
    const tsRegex = /(?:(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d))/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let foundAny = false;

    while ((match = tsRegex.exec(rawText)) !== null) {
      foundAny = true;
      const matchStart = match.index;
      const matchEnd = tsRegex.lastIndex;
      const matchedTime = match[0];

      if (matchStart > lastIndex) {
        contentEl.appendChild(document.createTextNode(rawText.slice(lastIndex, matchStart)));
      }

      const badge = this.createTimestampBadge(matchedTime);
      contentEl.appendChild(badge);

      lastIndex = matchEnd;
    }

    if (lastIndex < rawText.length) {
      contentEl.appendChild(document.createTextNode(rawText.slice(lastIndex)));
    }

    // 本文内にタイムスタンプ文字列が存在しなかった場合のフォールバック（先頭にバッジを付与）
    if (!foundAny && currentTimestamp) {
      const badge = this.createTimestampBadge(currentTimestamp);
      contentEl.insertBefore(document.createTextNode(' '), contentEl.firstChild);
      contentEl.insertBefore(badge, contentEl.firstChild);
    }
  }

  /**
   * インライン用のタイムスタンプバッジ要素を生成
   */
  private createTimestampBadge(timeText: string): HTMLElement {
    const doc = this.getOwnerDocument();
    const tsBadge = doc.createElement('span');
    const size = this.settings.size || 'medium';
    tsBadge.className = `yt-co-ts-badge yt-co-size-${size}`;
    tsBadge.title = `${timeText} へジャンプ`;

    const playSvg = this.createSvgElement('0 0 24 24', 9, 9);
    playSvg.setAttribute('fill', 'currentColor');
    const playPoly = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    playPoly.setAttribute('points', '6 4 20 12 6 20 6 4');
    playSvg.appendChild(playPoly);

    const tsText = doc.createTextNode(timeText);
    tsBadge.appendChild(playSvg);
    tsBadge.appendChild(tsText);

    // バッジクリックで該当タイムスタンプへ動画シーク
    tsBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      const sec = timeStringToSeconds(timeText);
      if (sec >= 0) {
        const video = this.playerElement?.querySelector<HTMLVideoElement>('video') || document.querySelector<HTMLVideoElement>('video');
        if (video) {
          video.currentTime = sec;
        }
      }
    });

    return tsBadge;
  }

  private createSvgElement(viewBox: string, width: number, height: number): SVGSVGElement {
    const doc = this.getOwnerDocument();
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('width', width.toString());
    svg.setAttribute('height', height.toString());
    return svg;
  }

  private createAvatarElement(authorName: string, avatarUrl: string): HTMLElement {
    const doc = this.getOwnerDocument();
    const hasValidUrl = Boolean(avatarUrl && avatarUrl.startsWith('http'));

    if (hasValidUrl) {
      const img = doc.createElement('img');
      img.className = 'yt-co-avatar';
      img.src = avatarUrl;
      img.alt = authorName;
      img.loading = 'lazy';
      img.onerror = () => {
        const fallback = this.generateInitialAvatar(authorName);
        if (img.parentElement) {
          img.parentElement.replaceChild(fallback, img);
        }
      };
      return img;
    }

    return this.generateInitialAvatar(authorName);
  }

  private generateInitialAvatar(name: string): HTMLElement {
    const doc = this.getOwnerDocument();
    const cleanName = (name || 'ユ').trim();
    const firstChar = Array.from(cleanName)[0] || 'ユ';

    const fallback = doc.createElement('div');
    fallback.className = 'yt-co-avatar-fallback';
    fallback.textContent = firstChar;

    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
      hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      ['#6366f1', '#a855f7'],
      ['#3b82f6', '#06b6d4'],
      ['#ec4899', '#f43f5e'],
      ['#10b981', '#14b8a6'],
      ['#f59e0b', '#d97706'],
      ['#8b5cf6', '#d946ef'],
    ];
    const colorPair = colors[Math.abs(hash) % colors.length];
    fallback.style.background = `linear-gradient(135deg, ${colorPair[0]}, ${colorPair[1]})`;

    return fallback;
  }

  /**
   * クリック時にコメントウィンドウを拡張し、全文字表示・いいね・返信を行える詳細モーダルを開く
   */
  public openExpandedComment(trigger: TimestampCommentTrigger) {
    this.closeExpandedComment();

    const { comment, timestamp } = trigger;
    const playerEl =
      this.playerElement ||
      document.querySelector<HTMLElement>('#movie_player, .html5-video-player') ||
      document.body;

    const modalRoot = document.createElement('div');
    modalRoot.id = 'yt-comment-overlay-modal-root';

    // 背景半透明バックドロップ (クリックで閉じる)
    const backdrop = document.createElement('div');
    backdrop.className = 'yt-co-modal-backdrop';
    backdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeExpandedComment();
    });

    // 拡張カード本体
    const card = document.createElement('div');
    card.className = 'yt-co-expanded-card';
    card.addEventListener('click', (e) => e.stopPropagation());

    // 1. ヘッダー (アイコン・ユーザー名からYouTubeチャンネルへ新しいタブでリンク)
    const header = document.createElement('div');
    header.className = 'yt-co-expanded-header';

    const channelUrl = this.resolveAuthorChannelUrl(comment);

    const avatarEl = this.createAvatarElement(comment.authorName, comment.authorAvatarUrl);
    let avatarContainer: HTMLElement = avatarEl;

    if (channelUrl) {
      const avatarLink = document.createElement('a');
      avatarLink.className = 'yt-co-expanded-avatar-link';
      avatarLink.href = channelUrl;
      avatarLink.target = '_blank';
      avatarLink.rel = 'noopener noreferrer';
      avatarLink.title = `${comment.authorName} のYouTubeチャンネルを開く（新しいタブ）`;
      avatarLink.appendChild(avatarEl);
      avatarLink.addEventListener('click', (e) => e.stopPropagation());
      avatarContainer = avatarLink;
    }

    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';
    info.style.gap = '3px';

    const authorRow = document.createElement('div');
    authorRow.className = 'yt-co-expanded-author';

    if (channelUrl) {
      const authorLink = document.createElement('a');
      authorLink.className = 'yt-co-expanded-author-link';
      authorLink.href = channelUrl;
      authorLink.target = '_blank';
      authorLink.rel = 'noopener noreferrer';
      authorLink.textContent = comment.authorName;
      authorLink.title = `${comment.authorName} のYouTubeチャンネルを開く（新しいタブ）`;
      authorLink.addEventListener('click', (e) => e.stopPropagation());
      authorRow.appendChild(authorLink);
    } else {
      authorRow.textContent = comment.authorName;
    }

    if (comment.isDescription) {
      const badge = document.createElement('span');
      badge.className = 'yt-co-chapter-badge';
      badge.textContent = '見どころ';
      authorRow.appendChild(badge);
    }

    const timeRow = document.createElement('div');
    timeRow.className = 'yt-co-expanded-time';
    timeRow.textContent = comment.publishedTimeText || 'YouTube コメント';

    info.appendChild(authorRow);
    info.appendChild(timeRow);

    // 右上閉じる（×）ボタン
    const closeBtn = document.createElement('button');
    closeBtn.className = 'yt-co-modal-close-btn';
    closeBtn.title = '閉じる';
    const closeSvg = this.createSvgElement('0 0 24 24', 14, 14);
    closeSvg.setAttribute('stroke', 'currentColor');
    closeSvg.setAttribute('stroke-width', '2.5');
    closeSvg.setAttribute('fill', 'none');
    const closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    closePath.setAttribute('d', 'M18 6L6 18M6 6l12 12');
    closeSvg.appendChild(closePath);
    closeBtn.appendChild(closeSvg);
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeExpandedComment();
    });

    header.appendChild(avatarContainer);
    header.appendChild(info);
    header.appendChild(closeBtn);

    // 2. 本文（全文字スクロール表示・タイムスタンプバッジ付き）
    const body = document.createElement('div');
    body.className = 'yt-co-expanded-body';
    this.renderContentWithTimestamps(body, comment.rawText, timestamp.formatted);

    // 3. アクションツールバー (いいね / 返信 / 閉じる)
    const actions = document.createElement('div');
    actions.className = 'yt-co-expanded-actions';

    // いいねボタン
    const isLiked = this.likedCommentIds.has(comment.id);
    let currentLikes = comment.likeCount + (isLiked ? 1 : 0);

    const likeBtn = document.createElement('button');
    likeBtn.className = `yt-co-action-btn yt-co-like-btn ${isLiked ? 'is-liked' : ''}`;
    const heartSvg = this.createSvgElement('0 0 24 24', 14, 14);
    heartSvg.setAttribute('stroke', 'currentColor');
    heartSvg.setAttribute('stroke-width', '2');
    heartSvg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
    const heartPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    heartPath.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
    heartSvg.appendChild(heartPath);

    const likeCountSpan = document.createElement('span');
    likeCountSpan.textContent = currentLikes > 0 ? String(currentLikes) : 'いいね';

    likeBtn.appendChild(heartSvg);
    likeBtn.appendChild(likeCountSpan);

    likeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.likedCommentIds.has(comment.id)) {
        this.likedCommentIds.delete(comment.id);
        currentLikes = Math.max(0, currentLikes - 1);
        likeBtn.classList.remove('is-liked');
        heartSvg.setAttribute('fill', 'none');
      } else {
        this.likedCommentIds.add(comment.id);
        currentLikes += 1;
        likeBtn.classList.add('is-liked');
        heartSvg.setAttribute('fill', 'currentColor');
      }
      likeCountSpan.textContent = currentLikes > 0 ? String(currentLikes) : 'いいね';
    });

    // 返信ボタン
    const replyBtn = document.createElement('button');
    replyBtn.className = 'yt-co-action-btn yt-co-reply-btn';
    const replySvg = this.createSvgElement('0 0 24 24', 14, 14);
    replySvg.setAttribute('stroke', 'currentColor');
    replySvg.setAttribute('stroke-width', '2');
    replySvg.setAttribute('fill', 'none');
    const replyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    replyPath.setAttribute('d', 'M3 10h10a5 5 0 0 1 5 5v2m-15-7l4-4m-4 4l4 4');
    replySvg.appendChild(replyPath);
    const replyTextSpan = document.createElement('span');
    replyTextSpan.textContent = '返信';

    replyBtn.appendChild(replySvg);
    replyBtn.appendChild(replyTextSpan);

    // サポートリンク (Ko-fi)
    const currentLang = this.settings.language || 'ja';
    const supportLabel = SUPPORT_DEV_LABELS[currentLang] || SUPPORT_DEV_LABELS.ja;

    const supportLink = document.createElement('a');
    supportLink.className = 'yt-co-action-btn yt-co-support-btn';
    supportLink.href = 'https://ko-fi.com/sanmiri';
    supportLink.target = '_blank';
    supportLink.rel = 'noopener noreferrer';
    supportLink.title = `${supportLabel} (Ko-fi)`;

    const supportHeartSvg = this.createSvgElement('0 0 24 24', 13, 13);
    supportHeartSvg.setAttribute('fill', 'currentColor');
    const supportHeartPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    supportHeartPath.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
    supportHeartSvg.appendChild(supportHeartPath);

    const supportSpan = document.createElement('span');
    supportSpan.textContent = supportLabel;

    supportLink.appendChild(supportHeartSvg);
    supportLink.appendChild(supportSpan);
    supportLink.addEventListener('click', (e) => e.stopPropagation());

    // 閉じるアクションボタン
    const closeActionBtn = document.createElement('button');
    closeActionBtn.className = 'yt-co-action-btn yt-co-close-btn';
    closeActionBtn.style.marginLeft = 'auto';
    closeActionBtn.textContent = '閉じる';
    closeActionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeExpandedComment();
    });

    actions.appendChild(likeBtn);
    actions.appendChild(replyBtn);
    actions.appendChild(supportLink);
    actions.appendChild(closeActionBtn);

    // 4. インライン返信フォーム
    const replyContainer = document.createElement('div');
    replyContainer.className = 'yt-co-reply-container';

    const textarea = document.createElement('textarea');
    textarea.className = 'yt-co-reply-textarea';
    textarea.placeholder = `${comment.authorName} さんへ返信...`;

    const replyFooter = document.createElement('div');
    replyFooter.className = 'yt-co-reply-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'yt-co-btn-secondary';
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.addEventListener('click', () => {
      replyContainer.classList.remove('is-open');
      replyBtn.classList.remove('is-active');
      textarea.value = '';
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'yt-co-btn-primary';
    submitBtn.textContent = '返信する';
    submitBtn.addEventListener('click', () => {
      const val = textarea.value.trim();
      if (!val) return;
      textarea.style.display = 'none';
      replyFooter.style.display = 'none';

      const successMsg = document.createElement('div');
      successMsg.className = 'yt-co-reply-success';
      successMsg.textContent = '✓ 返信を送信しました（YouTubeに反映されます）';
      replyContainer.appendChild(successMsg);

      setTimeout(() => {
        this.closeExpandedComment();
      }, 1400);
    });

    replyFooter.appendChild(cancelBtn);
    replyFooter.appendChild(submitBtn);

    replyContainer.appendChild(textarea);
    replyContainer.appendChild(replyFooter);

    replyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = replyContainer.classList.toggle('is-open');
      replyBtn.classList.toggle('is-active', isOpen);
      if (isOpen) {
        setTimeout(() => textarea.focus(), 100);
      }
    });

    // 5. 返信表示セクション
    const repliesSection = document.createElement('div');
    repliesSection.className = 'yt-co-replies-section';

    // 返信を読み込むボタン（返信がある場合のみ表示）
    const hasReplies = (comment.replyCount ?? 0) > 0 || !!comment.replyContinuationToken;
    if (hasReplies || !comment.isDescription) {
      const loadRepliesBtn = document.createElement('button');
      loadRepliesBtn.className = 'yt-co-load-replies-btn';
      const repliesIcon = this.createSvgElement('0 0 24 24', 13, 13);
      repliesIcon.setAttribute('stroke', 'currentColor');
      repliesIcon.setAttribute('stroke-width', '2');
      repliesIcon.setAttribute('fill', 'none');
      const repliesPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      repliesPath.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
      repliesIcon.appendChild(repliesPath);
      const repliesLabel = document.createElement('span');
      repliesLabel.textContent = comment.replyCount
        ? `返信を表示 (${comment.replyCount}件)`
        : '返信を表示';
      loadRepliesBtn.appendChild(repliesIcon);
      loadRepliesBtn.appendChild(repliesLabel);
      let isLoadingReplies = false;
      loadRepliesBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (isLoadingReplies) return;
        isLoadingReplies = true;

        loadRepliesBtn.disabled = true;
        loadRepliesBtn.classList.add('is-hidden');
        loadRepliesBtn.style.setProperty('display', 'none', 'important');

        // 既存のローディングやエラー・空メッセージ等をクリア
        repliesSection.querySelectorAll('.yt-co-replies-loading, .yt-co-replies-empty, .yt-co-reply-item').forEach((el) => el.remove());

        const loadingEl = document.createElement('div');
        loadingEl.className = 'yt-co-replies-loading';
        loadingEl.textContent = '返信を読み込み中...';
        repliesSection.appendChild(loadingEl);

        let result: ReplyFetchResult = { replies: [] };
        try {
          if (this.fetchRepliesCallback) {
            result = await this.fetchRepliesCallback(comment);
          }
        } catch (fetchErr: any) {
          result = {
            replies: [],
            errorCode: 'E-301:EXCEPTION',
            debugMessage: `コールバック実行例外: ${fetchErr?.message || fetchErr}`,
          };
        } finally {
          isLoadingReplies = false;
          if (loadingEl.parentElement) {
            repliesSection.removeChild(loadingEl);
          }
        }

        // 念のため再クリアして重複描画を確実に防止
        repliesSection.querySelectorAll('.yt-co-replies-loading, .yt-co-replies-empty').forEach((el) => el.remove());

        if (result.replies.length === 0) {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'yt-co-replies-empty';

          const msgEl = document.createElement('div');
          msgEl.textContent = '返信はありません';
          emptyEl.appendChild(msgEl);

          if (result.errorCode) {
            const codeBadge = document.createElement('div');
            codeBadge.className = 'yt-co-reply-error-badge';
            codeBadge.textContent = `[エラーコード: ${result.errorCode}]`;
            codeBadge.title = result.debugMessage
              ? `クリックで詳細ログを表示\n${result.debugMessage}`
              : 'クリックで詳細ログを表示';
            codeBadge.addEventListener('click', (ev) => {
              ev.stopPropagation();
              console.warn('[TimeBubble] 返信取得診断ログ:', result.debugMessage || result.errorCode);
              alert(`【返信取得 診断ログ】\n\nエラーコード:\n${result.errorCode}\n\n詳細経緯:\n${result.debugMessage || '詳細なし'}`);
            });
            emptyEl.appendChild(codeBadge);
          }

          repliesSection.appendChild(emptyEl);
          return;
        }

        for (const reply of result.replies) {
          const replyEl = this.createReplyElement(reply);
          repliesSection.appendChild(replyEl);
        }
      });
      repliesSection.appendChild(loadRepliesBtn);
    }

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);
    card.appendChild(repliesSection);
    card.appendChild(replyContainer);

    modalRoot.appendChild(backdrop);
    modalRoot.appendChild(card);

    playerEl.appendChild(modalRoot);
    this.modalRootEl = modalRoot;
  }


  public closeExpandedComment() {
    if (this.modalRootEl && this.modalRootEl.parentElement) {
      this.modalRootEl.parentElement.removeChild(this.modalRootEl);
      this.modalRootEl = null;
    }
    // DOM上に残存する古いモーダル要素があればすべて安全に削除
    document.querySelectorAll('#yt-comment-overlay-modal-root').forEach((el) => {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    });
  }

  /** 返信1件のDOM要素を生成 */
  private createReplyElement(reply: ReplyData): HTMLElement {
    const el = document.createElement('div');
    el.className = 'yt-co-reply-item';

    const avatar = this.createAvatarElement(reply.authorName, reply.authorAvatarUrl);
    avatar.classList.add('yt-co-reply-avatar');

    const content = document.createElement('div');
    content.className = 'yt-co-reply-content';

    const authorEl = document.createElement('span');
    authorEl.className = 'yt-co-reply-author';
    if (reply.authorChannelUrl) {
      const link = document.createElement('a');
      link.href = reply.authorChannelUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = reply.authorName;
      link.addEventListener('click', (e) => e.stopPropagation());
      authorEl.appendChild(link);
    } else {
      authorEl.textContent = reply.authorName;
    }

    const textEl = document.createElement('div');
    textEl.className = 'yt-co-reply-text';
    textEl.textContent = reply.rawText;

    const metaEl = document.createElement('div');
    metaEl.className = 'yt-co-reply-meta';
    if (reply.publishedTimeText) {
      const timeSpan = document.createElement('span');
      timeSpan.textContent = reply.publishedTimeText;
      metaEl.appendChild(timeSpan);
    }
    if (reply.likeCount > 0) {
      const likesSpan = document.createElement('span');
      likesSpan.className = 'yt-co-reply-likes';
      likesSpan.textContent = `♥ ${reply.formattedLikeCount}`;
      metaEl.appendChild(likesSpan);
    }

    content.appendChild(authorEl);
    content.appendChild(textEl);
    content.appendChild(metaEl);

    el.appendChild(avatar);
    el.appendChild(content);
    return el;
  }

  /**
   * レーンの使用状況をリセットする（シーク時・巻き戻し時用）
   */
  public resetFlowLanes() {
    this.flowLanes = Array(6).fill(0);
  }

  /**
   * ニコニコ動画風の流れるコメントを表示する
   * @param trigger タイムスタンプコメント
   * @param timeOffsetMs シーク時等に既に経過している時間 (ミリ秒)
   * @param force 設定の有効無効チェックをバイパスするか (テスト用)
   * @param preferredLaneIndex 指定レーン番号（シーク時の重なり防止用）
   */
  public showFlowComment(
    trigger: TimestampCommentTrigger,
    timeOffsetMs = 0,
    force = false,
    preferredLaneIndex?: number
  ) {
    const isLive = trigger.timestamp.formatted === 'Live' || trigger.comment.sourcePlatform === 'twitch';
    if (!force) {
      if (isLive) {
        const liveEnabled = trigger.comment.sourcePlatform === 'twitch' ? (this.settings.twitchEnabled ?? true) : (this.settings.liveChatEnabled ?? true);
        if (!liveEnabled) return;
        if (this.getEffectiveLiveDisplayMode() !== 'flow') return;
      } else {
        if (!this.settings.enabled) return;
        if (!this.isFlowModeEnabled()) return;
      }
    }

    const playerEl = this.playerElement ||
      document.querySelector<HTMLElement>('#movie_player, .html5-video-player') ||
      document.body;
    if (!playerEl) return;

    const { comment } = trigger;
    const LANE_COUNT = 6;
    const now = Date.now();

    // レーン初期化
    if (this.flowLanes.length < LANE_COUNT) {
      this.flowLanes = Array(LANE_COUNT).fill(0);
    }

    // レーンを選択 (preferredLaneIndex があればそれを優先、無ければ使用解除時刻が最も古いものを使用)
    let laneIndex = 0;
    if (preferredLaneIndex !== undefined && preferredLaneIndex >= 0 && preferredLaneIndex < LANE_COUNT) {
      laneIndex = preferredLaneIndex;
    } else {
      let minTime = Infinity;
      for (let i = 0; i < LANE_COUNT; i++) {
        if (this.flowLanes[i] <= now) {
          laneIndex = i;
          break;
        }
        if (this.flowLanes[i] < minTime) {
          minTime = this.flowLanes[i];
          laneIndex = i;
        }
      }
    }

    const ownerDoc = playerEl.ownerDocument || document;
    const flowEl = ownerDoc.createElement('div');
    const size = isLive
      ? (this.settings.liveFlowSize || this.settings.flowSize || 'medium')
      : (this.settings.flowSize || 'medium');
    flowEl.className = `yt-co-flow-comment size-${size}`;

    // フロー背景不透明度の適用
    const rawOpacity = isLive
      ? (this.settings.liveFlowOpacity ?? this.settings.flowOpacity ?? 65)
      : (typeof this.settings.flowOpacity === 'number' ? this.settings.flowOpacity : 65);
    const bgAlpha = Math.max(0, Math.min(1, rawOpacity / 100));
    flowEl.style.setProperty('--yt-co-flow-bg-alpha', bgAlpha.toString());

    // 人気コメントまたはスパチャのカラー
    if (!isLive && this.settings.highlightPopular) {
      if (comment.likeCount >= this.settings.topTierThreshold) {
        flowEl.classList.add('is-toptier');
      } else if (comment.likeCount >= this.settings.popularThreshold) {
        flowEl.classList.add('is-popular');
      }
    } else if (isLive && comment.isSuperChat) {
      flowEl.classList.add('is-toptier');
      if (comment.superChatColor) {
        flowEl.style.borderColor = comment.superChatColor;
      }
    }

    // アバター
    const shouldShowAvatar = isLive
      ? (this.settings.liveShowAvatars ?? this.settings.showLiveAvatars ?? true)
      : (this.settings.showAvatars ?? true);
    if (shouldShowAvatar) {
      const avatar = this.createAvatarElement(comment.authorName, comment.authorAvatarUrl);
      avatar.classList.add('yt-co-flow-avatar');
      flowEl.appendChild(avatar);
    }

    // ライブバッジ
    const shouldShowBadges = isLive
      ? (this.settings.liveShowBadges ?? this.settings.showBadges ?? true)
      : false;
    if (shouldShowBadges && comment.badges && comment.badges.length > 0) {
      comment.badges.forEach((b) => {
        const badgeEl = this.createBadgeElement(b);
        flowEl.appendChild(badgeEl);
      });
    }

    const textEl = ownerDoc.createElement('span');
    textEl.className = 'yt-co-flow-text';
    if (isLive && comment.userColor) {
      textEl.style.color = comment.userColor;
    }
    textEl.textContent = comment.rawText.replace(/\n/g, ' ');

    flowEl.appendChild(textEl);

    // レーン位置（セーフエリアを確保し、各種アスペクト比での見切れを防止）
    const win = ownerDoc.defaultView || window;
    const playerHeight = playerEl.clientHeight || win.innerHeight || 360;
    const safeTop = Math.max(16, Math.floor(playerHeight * 0.05));
    const safeBottom = Math.max(68, Math.floor(playerHeight * 0.12)); // 下部シークバー・コントロールバーの被り防止
    const usableHeight = Math.max(120, playerHeight - safeTop - safeBottom);
    const laneHeight = Math.floor(usableHeight / LANE_COUNT);
    const topPx = safeTop + (laneIndex * laneHeight) + Math.floor(laneHeight * 0.08);
    flowEl.style.top = `${topPx}px`;

    playerEl.appendChild(flowEl);

    // アニメーション時間（flowSpeed設定に対応）
    const playerWidth = playerEl.clientWidth || win.innerWidth || 640;
    const duration = this.getFlowDuration(playerWidth, isLive);
    flowEl.style.setProperty('--yt-co-flow-duration', `${duration}ms`);
    flowEl.style.setProperty('--yt-co-flow-start-x', `${playerWidth}px`);

    // シーク時等、既に時間が経過している場合はマイナスdelayで途中位置から即時再生
    if (timeOffsetMs > 0 && timeOffsetMs < duration) {
      flowEl.style.animationDelay = `-${timeOffsetMs}ms`;
    }

    // 動画が一時停止中の場合はアニメーションも一時停止
    if (this.isPlaybackPaused) {
      flowEl.classList.add('is-paused');
    }

    // レーン解放予定時刻を更新（テキスト幅の半分移動した時点）
    const halfwayTime = duration * 0.45;
    this.flowLanes[laneIndex] = now + Math.max(0, halfwayTime - timeOffsetMs);

    // アニメーション終了後にDOMから安全に削除するタイマー管理
    const totalRemaining = Math.max(200, duration - timeOffsetMs) + 200;
    let flowTimerId: number | null = null;
    if (!this.isPlaybackPaused) {
      flowTimerId = window.setTimeout(() => {
        this.activeFlowItems.delete(flowEl);
        if (flowEl.parentElement) {
          flowEl.parentElement.removeChild(flowEl);
        }
      }, totalRemaining);
    }

    this.activeFlowItems.set(flowEl, {
      timerId: flowTimerId,
      remainingMs: totalRemaining,
      startedAt: now,
    });

    // クリックで詳細表示
    flowEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openExpandedComment(trigger);
    });

  }

  /**
   * ミニチャットボックスモードへのコメント追加
   */
  /**
   * Twitch / YouTube Live のバッジ（画像URLまたはSVGアイコン）要素を生成
   */
  private createBadgeElement(badgeStr: string): HTMLElement {
    const ownerDoc = this.getOwnerDocument();

    // 1. 画像URL形式 (YouTubeメンバーシップカスタムバッジ / Twitch画像CDN)
    if (badgeStr.startsWith('http://') || badgeStr.startsWith('https://') || badgeStr.startsWith('//')) {
      const img = ownerDoc.createElement('img');
      img.className = 'yt-co-chatbox-badge-img';
      img.src = badgeStr;
      img.alt = 'badge';
      img.loading = 'lazy';
      img.onerror = () => {
        if (img.parentElement) {
          const fallback = ownerDoc.createElement('span');
          fallback.className = 'yt-co-chatbox-badge';
          fallback.textContent = '★';
          img.parentElement.replaceChild(fallback, img);
        }
      };
      return img;
    }

    // 2. 組み込みバッジSVGアイコン (Twitch / YouTube標準バッジ)
    const key = badgeStr.toLowerCase().trim();
    const wrap = ownerDoc.createElement('span');
    wrap.className = `yt-co-chatbox-badge-wrap badge-${key}`;
    wrap.title = badgeStr;

    if (key === 'broadcaster' || key === 'owner' || key === 'creator') {
      // 配信者・オーナー: 赤/ゴールド 王冠
      const svg = this.createSvgElement('0 0 24 24', 14, 14);
      svg.classList.add('yt-co-chatbox-badge-icon', 'badge-broadcaster');
      const p = ownerDoc.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', '#e11d48');
      p.setAttribute('d', 'M2.5 19h19v2h-19v-2zm1.5-3.5L2 6.5l6 4 4-6 4 6 6-4-2 9h-16z');
      svg.appendChild(p);
      wrap.appendChild(svg);
      return wrap;
    }

    if (key === 'moderator' || key === 'mod') {
      // モデレーター: エメラルドグリーン 剣/レンチ
      const svg = this.createSvgElement('0 0 24 24', 14, 14);
      svg.classList.add('yt-co-chatbox-badge-icon', 'badge-moderator');
      const p = ownerDoc.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', '#10b981');
      p.setAttribute('d', 'M14.5 2.5L12 5l2.5 2.5-1.5 1.5-2.5-2.5L3 14v4h4l7.5-7.5 2.5 2.5 1.5-1.5-2.5-2.5 2.5-2.5-4-4zM5 16.5l-1-1L10.5 9 12 10.5 5.5 17H5v-.5z');
      svg.appendChild(p);
      wrap.appendChild(svg);
      return wrap;
    }

    if (key === 'vip') {
      // VIP: パープル/ピンク ダイヤモンド
      const svg = this.createSvgElement('0 0 24 24', 14, 14);
      svg.classList.add('yt-co-chatbox-badge-icon', 'badge-vip');
      const p = ownerDoc.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', '#c026d3');
      p.setAttribute('d', 'M12 2L4 9l8 13 8-13-8-13zm0 3.2L16.4 9H7.6L12 5.2zM6.5 10.5h11L12 18.5 6.5 10.5z');
      svg.appendChild(p);
      wrap.appendChild(svg);
      return wrap;
    }

    if (key === 'subscriber' || key === 'member' || key === 'sub') {
      // サブスクライバー / メンバー: 星バッジ
      const svg = this.createSvgElement('0 0 24 24', 14, 14);
      svg.classList.add('yt-co-chatbox-badge-icon', 'badge-subscriber');
      const p = ownerDoc.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', '#0ea5e9');
      p.setAttribute('d', 'M12 2l2.9 6.6 7.1.6-5.3 4.8 1.6 7-6.3-3.7-6.3 3.7 1.6-7-5.3-4.8 7.1-.6L12 2z');
      svg.appendChild(p);
      wrap.appendChild(svg);
      return wrap;
    }

    if (key === 'verified') {
      // 認証済み: ブルー チェックマーク
      const svg = this.createSvgElement('0 0 24 24', 14, 14);
      svg.classList.add('yt-co-chatbox-badge-icon', 'badge-verified');
      const p = ownerDoc.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', '#38bdf8');
      p.setAttribute('d', 'M12 2l2.4 2.1 3.2-.4 1.3 2.9 3 .9-.2 3.2 2.1 2.4-1.7 2.7.9 3-2.9 1.3-.4 3.2-3.2-.2-2.4 2.1-2.7-1.7-3 .9-1.3-2.9-3.2-.4.2-3.2L2.1 12l1.7-2.7-.9-3 2.9-1.3.4-3.2 3.2.2L12 2zm-1.5 13.5l6-6-1.4-1.4-4.6 4.6-2.1-2.1-1.4 1.4 3.5 3.5z');
      svg.appendChild(p);
      wrap.appendChild(svg);
      return wrap;
    }

    if (key === 'turbo' || key === 'premium') {
      // Turbo / Premium: パープル 稲妻
      const svg = this.createSvgElement('0 0 24 24', 14, 14);
      svg.classList.add('yt-co-chatbox-badge-icon', 'badge-turbo');
      const p = ownerDoc.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', '#8b5cf6');
      p.setAttribute('d', 'M11 21h-1l1-7H7.5c-.9 0-1.2-.6-.9-1.2L13 3h1l-1 7h3.5c.9 0 1.1.7.7 1.3L11 21z');
      svg.appendChild(p);
      wrap.appendChild(svg);
      return wrap;
    }

    // 3. その他未知のバッジ文字列: スタイリッシュな小型タグ
    const fallbackSpan = ownerDoc.createElement('span');
    fallbackSpan.className = 'yt-co-chatbox-badge';
    fallbackSpan.textContent = badgeStr;
    return fallbackSpan;
  }

  /**
   * ミニチャットボックスモードへのコメント追加
   */
  public enqueueChatboxComment(comment: CommentData) {
    const isLive = comment.sourcePlatform === 'twitch' || comment.source === 'live_chat';
    if (isLive) {
      const liveEnabled = comment.sourcePlatform === 'twitch' ? (this.settings.twitchEnabled ?? true) : (this.settings.liveChatEnabled ?? true);
      if (!liveEnabled) return;
      if (this.getEffectiveLiveDisplayMode() !== 'chatbox') return;
    } else {
      if (!this.settings.enabled) return;
      if (this.getEffectiveDisplayMode() !== 'chatbox') return;
    }

    if (!this.playerElement) return;

    const ownerDoc = this.getOwnerDocument();

    if (!this.chatboxContainerEl || !this.chatboxContainerEl.parentElement) {
      let box = this.playerElement.querySelector<HTMLElement>('.yt-co-chatbox-container');
      if (!box) {
        box = ownerDoc.createElement('div');
        box.className = 'yt-co-chatbox-container';
        this.playerElement.appendChild(box);
      }
      this.chatboxContainerEl = box;
    }

    const itemEl = ownerDoc.createElement('div');
    itemEl.className = `yt-co-chatbox-item ${comment.isSuperChat ? 'is-superchat' : ''}`;

    if (comment.isSuperChat && comment.superChatAmount) {
      const superEl = ownerDoc.createElement('div');
      superEl.className = 'yt-co-superchat-badge';
      superEl.textContent = `💰 ${comment.superChatAmount}`;
      itemEl.appendChild(superEl);
    }

    const rowEl = ownerDoc.createElement('div');
    rowEl.style.display = 'flex';
    rowEl.style.gap = '6px';
    rowEl.style.alignItems = 'center';
    rowEl.style.flexWrap = 'wrap';

    // ユーザーアイコン
    const shouldShowAvatar = isLive
      ? (this.settings.liveShowAvatars ?? this.settings.showLiveAvatars ?? true)
      : (this.settings.showAvatars ?? true);
    if (shouldShowAvatar) {
      const avatarEl = this.createAvatarElement(comment.authorName, comment.authorAvatarUrl);
      avatarEl.classList.add('yt-co-chatbox-avatar');
      rowEl.appendChild(avatarEl);
    }

    // バッジ画像 / SVG
    const shouldShowBadges = isLive
      ? (this.settings.liveShowBadges ?? this.settings.showBadges ?? true)
      : false;
    if (shouldShowBadges && comment.badges && comment.badges.length > 0) {
      comment.badges.forEach((b) => {
        const badgeEl = this.createBadgeElement(b);
        rowEl.appendChild(badgeEl);
      });
    }

    const authorSpan = ownerDoc.createElement('span');
    authorSpan.className = 'yt-co-chatbox-author';
    if (comment.userColor) {
      authorSpan.style.color = comment.userColor;
    }
    authorSpan.textContent = `${comment.authorName || 'ユーザー'}:`;
    rowEl.appendChild(authorSpan);

    const textSpan = ownerDoc.createElement('span');
    textSpan.className = 'yt-co-chatbox-text';
    textSpan.textContent = comment.rawText || '';
    rowEl.appendChild(textSpan);

    itemEl.appendChild(rowEl);

    this.chatboxContainerEl.appendChild(itemEl);

    // 最大同時表示数 (最新6件を保持)
    while (this.chatboxContainerEl.children.length > 6) {
      const first = this.chatboxContainerEl.firstElementChild;
      if (first) this.chatboxContainerEl.removeChild(first);
    }

    // 7秒後にフェードアウト
    window.setTimeout(() => {
      itemEl.classList.add('is-fading');
      window.setTimeout(() => {
        if (itemEl.parentElement) itemEl.parentElement.removeChild(itemEl);
      }, 400);
    }, 7000);
  }


  /**
   * 投稿者のYouTubeチャンネルURLを解決
   */
  private resolveAuthorChannelUrl(comment: CommentData): string {
    if (comment.authorChannelUrl) {
      return comment.authorChannelUrl;
    }
    const name = (comment.authorName || '').trim();
    if (!name || name === 'ユーザー' || name === '動画投稿者') {
      return '';
    }
    if (name.startsWith('@')) {
      return `https://www.youtube.com/${name}`;
    }
    // 特殊文字や空白を除去してハンドル風URLまたはチャンネル検索を構築
    const handleCandidate = name.replace(/[^\p{L}\p{N}_-]/gu, '');
    if (handleCandidate) {
      return `https://www.youtube.com/@${encodeURIComponent(handleCandidate)}`;
    }
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`;
  }

  /**
   * プレイヤー上のクイックON/OFFトグルボタンを初期化・マウント
   */
  private mountQuickToggleButton(playerElement: HTMLElement) {
    this.removeQuickToggleButton();

    // YouTubeプレイヤー、または動画の親要素上でのみ表示
    const isYtPlayer =
      playerElement.id === 'movie_player' ||
      playerElement.classList.contains('html5-video-player') ||
      Boolean(playerElement.querySelector('video'));

    if (!isYtPlayer && playerElement === document.body) {
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'yt-co-quick-toggle-btn';
    btn.type = 'button';
    btn.className = `yt-co-quick-toggle-btn yt-co-quick-pos-${this.settings.position} ${this.settings.enabled ? 'is-enabled' : 'is-disabled'}`;

    this.renderQuickToggleContent(btn);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleEnabled();
    });

    playerElement.appendChild(btn);
    this.quickToggleBtnEl = btn;
  }

  private renderQuickToggleContent(btn: HTMLElement) {
    const isEn = this.settings.enabled;
    btn.title = isEn ? 'TimeBubble: ON (クリックで非表示)' : 'TimeBubble: OFF (クリックで表示)';

    while (btn.firstChild) {
      btn.removeChild(btn.firstChild);
    }

    const svg = this.createSvgElement('0 0 24 24', 13, 13);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
    svg.appendChild(path);

    if (isEn) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '10');
      circle.setAttribute('r', '2');
      circle.setAttribute('fill', 'currentColor');
      svg.appendChild(circle);
    } else {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '2');
      line.setAttribute('y1', '2');
      line.setAttribute('x2', '22');
      line.setAttribute('y2', '22');
      svg.appendChild(line);
    }

    btn.appendChild(svg);
  }

  private updateQuickToggleButton() {
    if (!this.quickToggleBtnEl) return;
    const isEn = this.settings.enabled;
    this.quickToggleBtnEl.className = `yt-co-quick-toggle-btn yt-co-quick-pos-${this.settings.position} ${isEn ? 'is-enabled' : 'is-disabled'}`;
    this.renderQuickToggleContent(this.quickToggleBtnEl);
  }

  private removeQuickToggleButton() {
    if (this.quickToggleBtnEl && this.quickToggleBtnEl.parentElement) {
      this.quickToggleBtnEl.parentElement.removeChild(this.quickToggleBtnEl);
    }
    const existing = document.querySelectorAll('#yt-co-quick-toggle-btn');
    existing.forEach((el) => el.parentElement?.removeChild(el));
    this.quickToggleBtnEl = null;
  }

  private async toggleEnabled() {
    this.settings.enabled = !this.settings.enabled;
    await saveSettings({ enabled: this.settings.enabled });
    this.applySettingsToContainer();
  }

  /**
   * プレイヤー内コントロールバーに TimeBubble 操作ボタンをマウント
   */
  public mountPlayerControlsBar(controlsBar: HTMLElement) {
    if (this.playerControlsBarEl && this.playerControlsBarEl.parentElement === controlsBar) {
      return;
    }
    this.removePlayerControlsBar();

    const container = document.createElement('div');
    container.id = 'yt-co-player-controls-container';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.height = '100%';
    container.style.verticalAlign = 'top';

    // 1. モード切替ボタン
    const modeBtn = document.createElement('button');
    modeBtn.className = 'yt-co-player-btn ytp-button';
    modeBtn.type = 'button';
    modeBtn.title = `TimeBubble: 表示モード切替 (現在: ${this.settings.displayMode})`;

    const modeSvg = this.createSvgElement('0 0 24 24', 18, 18);
    modeSvg.setAttribute('fill', 'none');
    modeSvg.setAttribute('stroke', 'currentColor');
    modeSvg.setAttribute('stroke-width', '2');
    modeSvg.setAttribute('stroke-linecap', 'round');
    modeSvg.setAttribute('stroke-linejoin', 'round');
    const modePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    modePath.setAttribute('d', 'M4 6h16M4 12h16M4 18h12');
    modeSvg.appendChild(modePath);
    modeBtn.appendChild(modeSvg);

    modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.cycleDisplayMode();
      modeBtn.title = `TimeBubble: 表示モード切替 (現在: ${this.settings.displayMode})`;
    });

    // 2. PiP ボタン
    const pipBtn = document.createElement('button');
    pipBtn.className = 'yt-co-player-btn ytp-button';
    pipBtn.type = 'button';
    pipBtn.title = 'TimeBubble: コメント付きPiP再生';

    const pipSvg = this.createSvgElement('0 0 24 24', 18, 18);
    pipSvg.setAttribute('fill', 'none');
    pipSvg.setAttribute('stroke', 'currentColor');
    pipSvg.setAttribute('stroke-width', '2');
    pipSvg.setAttribute('stroke-linecap', 'round');
    pipSvg.setAttribute('stroke-linejoin', 'round');
    const pipRect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pipRect1.setAttribute('x', '2');
    pipRect1.setAttribute('y', '3');
    pipRect1.setAttribute('width', '20');
    pipRect1.setAttribute('height', '14');
    pipRect1.setAttribute('rx', '2');
    pipRect1.setAttribute('ry', '2');
    pipSvg.appendChild(pipRect1);
    const pipRect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pipRect2.setAttribute('x', '12');
    pipRect2.setAttribute('y', '9');
    pipRect2.setAttribute('width', '8');
    pipRect2.setAttribute('height', '6');
    pipRect2.setAttribute('rx', '1');
    pipRect2.setAttribute('ry', '1');
    pipRect2.setAttribute('fill', 'currentColor');
    pipSvg.appendChild(pipRect2);
    pipBtn.appendChild(pipSvg);

    pipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.onPipToggleCallback) {
        this.onPipToggleCallback();
      }
    });

    container.appendChild(modeBtn);
    container.appendChild(pipBtn);

    if (controlsBar.firstChild) {
      controlsBar.insertBefore(container, controlsBar.firstChild);
    } else {
      controlsBar.appendChild(container);
    }
    this.playerControlsBarEl = container;
  }

  public removePlayerControlsBar() {
    if (this.playerControlsBarEl && this.playerControlsBarEl.parentElement) {
      this.playerControlsBarEl.parentElement.removeChild(this.playerControlsBarEl);
    }
    const existing = document.querySelectorAll('#yt-co-player-controls-container');
    existing.forEach((el) => el.parentElement?.removeChild(el));
    this.playerControlsBarEl = null;
  }

  public async cycleDisplayMode() {
    const modes: ('card' | 'flow' | 'chatbox')[] = ['card', 'flow', 'chatbox'];
    const currentIdx = modes.indexOf(this.settings.displayMode as any);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    this.settings.displayMode = nextMode;
    this.settings.flowMode = nextMode === 'flow';
    await saveSettings({ displayMode: nextMode, flowMode: this.settings.flowMode });
    this.applySettingsToContainer();
    if (this.onModeCycleCallback) {
      this.onModeCycleCallback();
    }
    console.log('[TimeBubble] Switched display mode to:', nextMode);
  }
}
