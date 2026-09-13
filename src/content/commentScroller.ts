import { CommentData } from '../types';

export class CommentScroller {
  /**
   * 指定したコメントまでスマートにスクロールし、ハイライト表示する
   */
  public static async scrollToComment(comment: CommentData): Promise<boolean> {
    // 0. フルスクリーン（全画面）表示中の場合は解除してスクロール可能にする
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }

    // 1. 概要欄由来のタイムスタンプの場合
    if (comment.isDescription) {
      const desc = document.querySelector<HTMLElement>('#description, ytd-text-inline-expander, #description-inline-expander');
      if (desc) {
        // 「もっと見る」ボタンがあれば展開
        const expandBtn = desc.querySelector<HTMLElement>('#expand, tp-yt-paper-button#expand');
        if (expandBtn && typeof expandBtn.click === 'function') {
          expandBtn.click();
        }
        this.scrollToElement(desc, 'center');
        this.highlightElement(desc);
        return true;
      }
    }

    // 2. コメント欄が折りたたまれている・サイドパネルの場合は展開する
    this.ensureCommentsExpanded();

    // 3. DOM内を検索 (すでにレンダリングされているか確認)
    let targetEl = this.findCommentElement(comment);

    // 4. まだDOMにない場合、即座にコメントエリアへ画面をスクロールして遅延読み込みを発火
    if (!targetEl) {
      const initialScrollY = this.getCommentsAreaScrollY();
      this.performScrollTo(initialScrollY);

      // YouTube 本体の遅延読み込みを即座にキック
      this.kickYouTubeCommentsLazyLoad();

      // 最大4秒間、DOM出現をポーリング
      targetEl = await this.pollForCommentElement(comment, 4000);
    }

    // 5. 要素が見つかったらその位置へスムーズスクロール＆パルスアニメーション
    if (targetEl) {
      this.scrollToElement(targetEl, 'center');
      this.highlightElement(targetEl);
      return true;
    } else {
      // 見つからなくてもコメント欄の先頭位置を維持
      const fallbackY = this.getCommentsAreaScrollY();
      this.performScrollTo(fallbackY);

      // 深層コメント対策: YouTube公式の Linked Comment (lc) パラメータで最上部に召喚
      if (
        comment.id &&
        !comment.id.startsWith('cep_') &&
        !comment.id.startsWith('cvm_') &&
        !comment.id.startsWith('comment_')
      ) {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.get('lc') !== comment.id) {
            url.searchParams.set('lc', comment.id);
            window.history.replaceState(null, '', url.toString());
            window.dispatchEvent(new CustomEvent('yt-action', {
              detail: { actionName: 'yt-reload-continuation-items-command' }
            }));
          }
        } catch {
          // ignore
        }
      }

      return false;
    }
  }

  /**
   * 要素の絶対Y座標を計算し、画面内の狙った位置（center または start）にスクロール
   */
  private static scrollToElement(el: HTMLElement, block: 'center' | 'start') {
    try {
      el.scrollIntoView({ behavior: 'smooth', block });
    } catch {
      // ignore
    }

    // scrollIntoView が固定ヘッダー等で不完全な場合のための確実な window.scrollTo フォールバック
    const rect = el.getBoundingClientRect();
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    let targetY: number;

    if (block === 'center') {
      targetY = rect.top + currentScrollY - (window.innerHeight / 2) + (rect.height / 2);
    } else {
      targetY = rect.top + currentScrollY - 70; // YouTube 固定ヘッダーの高さ(56px)を考慮
    }

    this.performScrollTo(targetY);
  }

  /**
   * コメント欄エリアの絶対スクロール位置（Y座標）を算出
   */
  private static getCommentsAreaScrollY(): number {
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    // 1. コメント要素の直接検出
    const commentsSelectors = [
      'ytd-comments#comments',
      '#comments',
      'ytd-comments',
      '#below',
      'ytd-item-section-renderer[section-identifier="comment-item-section"]',
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"]',
    ];

    for (const sel of commentsSelectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        if (rect.top !== 0 || rect.bottom !== 0) {
          return Math.max(0, rect.top + currentScrollY - 70);
        }
      }
    }

    // 2. 動画プレーヤー要素の下端から計算（コメント要素がまだ見つからない場合）
    const player = document.querySelector<HTMLElement>('#movie_player, .html5-video-player, video');
    if (player) {
      const rect = player.getBoundingClientRect();
      return Math.max(0, rect.bottom + currentScrollY - 20);
    }

    // 3. 画面高さを基準にしたフォールバック
    return Math.max(0, currentScrollY + window.innerHeight * 0.7);
  }

  /**
   * 絶対座標を指定して画面をスクロール（あらゆる環境で確実に発火）
   */
  private static performScrollTo(targetTop: number) {
    const safeTop = Math.max(0, Math.round(targetTop));

    try {
      window.scrollTo({
        top: safeTop,
        behavior: 'smooth',
      });
    } catch {
      window.scrollTo(0, safeTop);
    }

    // 即座にフォールバックもセット（ブラウザやCSSのscroll-behavior干渉を防ぐ）
    if (document.documentElement && document.documentElement.scrollTop !== safeTop) {
      setTimeout(() => {
        if (document.documentElement) document.documentElement.scrollTop = safeTop;
        if (document.body) document.body.scrollTop = safeTop;
      }, 100);
    }
  }

  /**
   * YouTube 本体の IntersectionObserver 遅延読み込みを強制キック
   */
  private static kickYouTubeCommentsLazyLoad() {
    try {
      const commentsSection = document.querySelector<HTMLElement>('ytd-comments#comments, #comments, ytd-comments');
      if (commentsSection) {
        const fakeEntry = [{ isIntersecting: true, intersectionRatio: 1.0 }];
        const cont = commentsSection.querySelector<any>('ytd-continuation-item-renderer');
        if (cont) {
          const rawCont = cont.wrappedJSObject || cont;
          if (typeof rawCont.onIntersection === 'function') rawCont.onIntersection(fakeEntry);
          if (typeof rawCont.handleIntersection_ === 'function') rawCont.handleIntersection_(fakeEntry);
          if (typeof rawCont.fetchContinuation === 'function') rawCont.fetchContinuation();
        }
      }
    } catch {
      // ignore
    }
  }

  private static findCommentElement(comment: CommentData): HTMLElement | null {
    // 1. IDマッチ
    if (comment.id) {
      const byAttr = document.querySelector(`[data-yt-overlay-comment-id="${comment.id}"]`);
      if (byAttr instanceof HTMLElement) return byAttr;

      const byLc = document.querySelector(`a[href*="lc=${comment.id}"]`);
      if (byLc) {
        const parent = byLc.closest('ytd-comment-thread-renderer, ytd-comment-view-model');
        if (parent instanceof HTMLElement) return parent;
      }
    }

    // 2. 本文テキストマッチ (タイムスタンプ表記を除去した特徴的なフレーズで検索)
    const cleanSnippet = comment.rawText
      .replace(/(?:(?:\d{1,2}:)?[0-5]?\d:[0-5]\d)/g, '')
      .trim()
      .slice(0, 30);

    const allComments = document.querySelectorAll(
      'ytd-comment-thread-renderer, ytd-comment-view-model'
    );

    for (const el of Array.from(allComments)) {
      const text = el.textContent || '';
      if (cleanSnippet && cleanSnippet.length >= 4 && text.includes(cleanSnippet)) {
        if (el instanceof HTMLElement) return el;
      }
      const rawSnippet = comment.rawText.slice(0, 25).trim();
      if (rawSnippet && text.includes(rawSnippet)) {
        if (el instanceof HTMLElement) return el;
      }
    }

    return null;
  }

  private static pollForCommentElement(
    comment: CommentData,
    timeoutMs: number
  ): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const el = this.findCommentElement(comment);
        if (el) {
          clearInterval(interval);
          resolve(el);
          return;
        }
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, 200);
    });
  }

  private static ensureCommentsExpanded() {
    // エンゲージメントパネル（サイドパネル形式）の展開
    const panel = document.querySelector<HTMLElement>(
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"]'
    );
    if (panel) {
      const isHidden = panel.getAttribute('visibility') === 'ENGAGEMENT_PANEL_SECTION_LIST_RENDERER_VISIBILITY_HIDDEN';
      if (isHidden) {
        // パネルを開くボタンを探してクリック
        const panelBtn = document.querySelector<HTMLElement>(
          '#comments-button, ytd-comments-header-renderer, #teaser-carousel ytd-button-renderer'
        );
        if (panelBtn && typeof panelBtn.click === 'function') {
          panelBtn.click();
        }
      }
    }

    // コメント折りたたみ解除ボタン
    const expandButton = document.querySelector(
      '#comments #more-replies, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"] #header'
    ) as HTMLElement | null;

    if (expandButton && expandButton.offsetParent !== null) {
      if (typeof expandButton.click === 'function') {
        expandButton.click();
      }
    }
  }

  private static highlightElement(el: HTMLElement) {
    const originalTransition = el.style.transition;
    const originalBoxShadow = el.style.boxShadow;
    const originalBorderRadius = el.style.borderRadius;

    el.style.transition = 'all 0.4s ease-out';
    el.style.borderRadius = '12px';
    el.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.8), 0 8px 24px rgba(99, 102, 241, 0.35)';

    setTimeout(() => {
      el.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.4)';
      setTimeout(() => {
        el.style.transition = originalTransition;
        el.style.boxShadow = originalBoxShadow;
        el.style.borderRadius = originalBorderRadius;
      }, 1500);
    }, 1500);
  }
}
