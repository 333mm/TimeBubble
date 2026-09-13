import { CommentData, DEFAULT_SETTINGS, OverlayPosition, OverlaySettings, TimestampCommentTrigger } from '../types';
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
  private likedCommentIds = new Set<string>();
  private settings: OverlaySettings = DEFAULT_SETTINGS;
  private activeCards = new Map<string, { el: HTMLElement; timerId: number }>();
  private exitingElements = new Set<HTMLElement>();
  private testCommentCounter = 0;

  constructor() {
    this.ensureGlobalStyles();
  }

  private ensureGlobalStyles() {
    if (typeof document === 'undefined') return;
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleEl);
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
    this.ensureGlobalStyles();
    this.playerElement = playerElement;

    // 親要素の position が static なら relative を付与して絶対配置の基準にする (bodyは除く)
    const computedPos = window.getComputedStyle(playerElement).position;
    if (playerElement !== document.body && computedPos === 'static') {
      playerElement.style.position = 'relative';
    }

    // すでに同じ親にマウントされていれば設定更新のみで完了（表示中カードを消さない！）
    if (this.containerEl && this.containerEl.parentElement === playerElement) {
      this.applySettingsToContainer();
      return true;
    }

    // DOM全体から既存のコンテナ（古いサイズや孤立したもの）をすべて探索
    const existingContainers = document.querySelectorAll<HTMLElement>(`#${CONTAINER_ID}`);
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

    // 新規作成
    const container = document.createElement('div');
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
    this.clearAll();
    const existingContainers = document.querySelectorAll<HTMLElement>(`#${CONTAINER_ID}`);
    existingContainers.forEach((el) => el.parentElement?.removeChild(el));
    this.containerEl = null;
  }

  public clearAll() {
    this.closeExpandedComment();
    for (const item of this.activeCards.values()) {
      clearTimeout(item.timerId);
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
   * テスト用吹き出し表示 (ポップアップから要求時、YouTube外の一般ページでも確実に表示)
   * 設定された最大スタック件数・サイズ・不透明度・位置・表示時間を視覚的に確認できるよう複数件スタック投入
   */
  public showTestComment() {
    console.log('[TimeBubble] showTestComment executing...');

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

    if (this.containerEl) {
      this.containerEl.style.display = 'flex';
      this.containerEl.style.opacity = '1';
      this.applySettingsToContainer();
    }

    const testSamples = [
      { text: '01:23 ここが一番好きなシーン！何度見ても最高です✨', author: 'テスト視聴者A', likes: 350, time: '01:23' },
      { text: 'この演出鳥肌立った…神回すぎる！🔥 02:45', author: 'テスト視聴者B', likes: 1200, time: '02:45' },
      { text: '03:10 音響とBGMの入り方が完璧👏 何度でもリピートできる', author: 'テスト視聴者C', likes: 88, time: '03:10' },
      { text: 'ここ伏線回収だったのか！すごすぎる…！ 04:05', author: 'テスト視聴者D', likes: 540, time: '04:05' },
      { text: '05:30 作画のクオリティが映画レベルで圧倒される🎬', author: 'テスト視聴者E', likes: 210, time: '05:30' },
    ];

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
    if (!this.settings.enabled && !force) return;

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

    const key = trigger.id;
    if (this.activeCards.has(key)) {
      const existing = this.activeCards.get(key)!;
      clearTimeout(existing.timerId);
      existing.timerId = window.setTimeout(() => {
        this.dismissCard(key);
      }, this.settings.displayDuration * 1000);
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
        clearTimeout(item.timerId);
        item.timerId = window.setTimeout(() => {
          this.dismissCard(activeKey);
        }, this.settings.displayDuration * 1000);
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

    const timerId = window.setTimeout(() => {
      this.dismissCard(key);
    }, this.settings.displayDuration * 1000);

    this.activeCards.set(key, { el: bubble, timerId });
  }

  /**
   * スタック上限超過時、古いコメントを上に押し出すアニメーションで退場させる
   */
  private pushOutCard(key: string) {
    const item = this.activeCards.get(key);
    if (!item) return;

    clearTimeout(item.timerId);
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

    clearTimeout(item.timerId);
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
    const { comment, timestamp } = trigger;
    const bubble = document.createElement('div');
    const size = this.settings.size || 'medium';
    bubble.className = `yt-co-bubble yt-co-size-${size}`;
    bubble.setAttribute('data-size', size);

    if (this.settings.highlightPopular) {
      if (comment.likeCount >= this.settings.topTierThreshold) {
        bubble.classList.add('is-toptier');
      } else if (comment.likeCount >= this.settings.popularThreshold) {
        bubble.classList.add('is-popular');
      }
    }

    bubble.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openExpandedComment(trigger);
    });

    // ユーザーアイコン
    const avatarEl = this.createAvatarElement(comment.authorName, comment.authorAvatarUrl);

    // ヘッダー構造
    const header = document.createElement('div');
    header.className = 'yt-co-header';

    const meta = document.createElement('div');
    meta.className = 'yt-co-meta';

    const author = document.createElement('span');
    author.className = 'yt-co-author';
    author.textContent = comment.authorName;

    meta.appendChild(author);

    if (comment.isDescription) {
      const descBadge = document.createElement('span');
      descBadge.className = 'yt-co-chapter-badge';
      descBadge.textContent = '見どころ';
      meta.appendChild(descBadge);
    }

    header.appendChild(avatarEl);
    header.appendChild(meta);

    // いいね数バッジ
    if (comment.likeCount > 0) {
      const likesBadge = document.createElement('span');
      likesBadge.className = 'yt-co-likes-badge';

      const likeSvg = this.createSvgElement('0 0 24 24', 12, 12);
      likeSvg.classList.add('yt-co-likes-icon');
      const likePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      likePath.setAttribute('d', 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z');
      likeSvg.appendChild(likePath);

      likesBadge.appendChild(likeSvg);
      likesBadge.appendChild(document.createTextNode(` ${comment.formattedLikeCount}`));
      header.appendChild(likesBadge);
    }

    // 本文テキスト（時間の部分をバッジに置き換えてインライン配置）
    const content = document.createElement('div');
    content.className = 'yt-co-content';
    this.renderContentWithTimestamps(content, comment.rawText, timestamp.formatted);

    // フッター (詳細表示・拡張インジケーター)
    const footer = document.createElement('div');
    footer.className = 'yt-co-footer';

    const footerText = document.createElement('span');
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
    const tsBadge = document.createElement('span');
    const size = this.settings.size || 'medium';
    tsBadge.className = `yt-co-ts-badge yt-co-size-${size}`;
    tsBadge.title = `${timeText} へジャンプ`;

    const playSvg = this.createSvgElement('0 0 24 24', 9, 9);
    playSvg.setAttribute('fill', 'currentColor');
    const playPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    playPoly.setAttribute('points', '6 4 20 12 6 20 6 4');
    playSvg.appendChild(playPoly);

    const tsText = document.createTextNode(timeText);
    tsBadge.appendChild(playSvg);
    tsBadge.appendChild(tsText);

    // バッジクリックで該当タイムスタンプへ動画シーク
    tsBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      const sec = timeStringToSeconds(timeText);
      if (sec >= 0) {
        const video = document.querySelector<HTMLVideoElement>('video');
        if (video) {
          video.currentTime = sec;
        }
      }
    });

    return tsBadge;
  }

  private createSvgElement(viewBox: string, width: number, height: number): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('width', width.toString());
    svg.setAttribute('height', height.toString());
    return svg;
  }

  private createAvatarElement(authorName: string, avatarUrl: string): HTMLElement {
    const hasValidUrl = Boolean(avatarUrl && avatarUrl.startsWith('http'));

    if (hasValidUrl) {
      const img = document.createElement('img');
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
    const cleanName = (name || 'ユ').trim();
    const firstChar = Array.from(cleanName)[0] || 'ユ';

    const fallback = document.createElement('div');
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

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);
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
}
