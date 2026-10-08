import { CommentData } from '../../types';

export class LiveChatForwarder {
  private static observer: MutationObserver | null = null;
  private static isRunning = false;

  public static isLiveChatFrame(): boolean {
    return window !== window.top && (
      window.location.pathname.includes('/live_chat') ||
      window.location.pathname.includes('/live_chat_replay')
    );
  }

  public static start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[TimeBubble:LiveChatForwarder] Initializing inside live chat iframe');

    const observeChat = () => {
      const container = document.querySelector<HTMLElement>(
        '#item-list #items, yt-live-chat-item-list-renderer #items'
      );
      if (!container || this.observer) return;

      this.observer = new MutationObserver((mutations) => {
        const comments: CommentData[] = [];

        for (const mut of mutations) {
          mut.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              const parsed = this.parseChatMessageElement(node);
              if (parsed) {
                comments.push(parsed);
              }
            }
          });
        }

        if (comments.length > 0) {
          try {
            window.parent.postMessage(
              {
                type: 'TIMEBUBBLE_LIVE_CHAT_MESSAGE',
                comments,
              },
              '*'
            );
          } catch (err) {
            console.warn('[TimeBubble:LiveChatForwarder] postMessage failed:', err);
          }
        }
      });

      this.observer.observe(container, { childList: true });
      console.log('[TimeBubble:LiveChatForwarder] Observer attached to live chat items container');
    };

    observeChat();
    const timer = setInterval(() => {
      if (!this.observer) observeChat();
      else clearInterval(timer);
    }, 1000);
  }

  private static parseChatMessageElement(el: HTMLElement): CommentData | null {
    try {
      const tagName = el.tagName.toLowerCase();

      // 1. 通常チャット (yt-live-chat-text-message-renderer)
      // 2. スパチャ (yt-live-chat-paid-message-renderer)
      // 3. メンシ加入 (yt-live-chat-membership-item-renderer)
      // 4. スパーツイカー (yt-live-chat-paid-sticker-renderer)
      const isTextMessage = tagName === 'yt-live-chat-text-message-renderer';
      const isPaidMessage = tagName === 'yt-live-chat-paid-message-renderer';
      const isMembership = tagName === 'yt-live-chat-membership-item-renderer';

      if (!isTextMessage && !isPaidMessage && !isMembership) return null;

      const authorEl = el.querySelector('#author-name');
      const authorName = authorEl?.textContent?.trim() || 'ユーザー';

      const imgEl = el.querySelector<HTMLImageElement>('#author-photo img');
      const authorAvatarUrl = imgEl?.src || imgEl?.getAttribute('src') || '';

      const msgEl = el.querySelector('#message');
      let rawText = msgEl?.textContent?.trim() || '';

      let isSuperChat = false;
      let superChatAmount: string | undefined;
      let superChatColor: string | undefined;

      if (isPaidMessage) {
        isSuperChat = true;
        const amountEl = el.querySelector('#purchase-amount');
        superChatAmount = amountEl?.textContent?.trim() || 'Super Chat';
        const headerEl = el.querySelector<HTMLElement>('#header');
        superChatColor = headerEl ? window.getComputedStyle(headerEl).backgroundColor : '#ff8f00';
      } else if (isMembership) {
        isSuperChat = true;
        superChatAmount = 'メンバーシップ';
        superChatColor = '#0f9d58';
        if (!rawText) {
          const headerSub = el.querySelector('#header-subtext');
          rawText = headerSub?.textContent?.trim() || 'メンバーへようこそ！';
        }
      }

      if (!rawText && !isSuperChat) return null;

      const id = el.getAttribute('id') || `yt_live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // バッジとユーザーカラーの抽出
      const badges: string[] = [];
      const badgeElements = el.querySelectorAll('yt-live-chat-author-badge-renderer, #chat-badges [type]');
      badgeElements.forEach((badge) => {
        const type = (badge.getAttribute('type') || '').toLowerCase();
        const ariaLabel = badge.getAttribute('aria-label') || '';
        const img = badge.querySelector('img');
        if (img?.src && img.src.startsWith('http')) {
          badges.push(img.src);
        } else if (type === 'moderator' || ariaLabel.includes('モデレーター') || ariaLabel.includes('Moderator')) {
          badges.push('moderator');
        } else if (type === 'owner' || ariaLabel.includes('オーナー') || ariaLabel.includes('Owner')) {
          badges.push('broadcaster');
        } else if (type === 'member' || ariaLabel.includes('メンバー') || ariaLabel.includes('Member')) {
          badges.push('subscriber');
        } else if (type === 'verified' || ariaLabel.includes('確認済み') || ariaLabel.includes('Verified')) {
          badges.push('verified');
        }
      });

      const authorType = el.getAttribute('author-type') || '';
      if (!badges.includes('moderator') && authorType === 'moderator') badges.push('moderator');
      if (!badges.includes('broadcaster') && authorType === 'owner') badges.push('broadcaster');
      if (!badges.includes('subscriber') && authorType === 'member') badges.push('subscriber');

      let userColor = '';
      if (authorEl) {
        const computed = window.getComputedStyle(authorEl).color;
        if (computed && computed !== 'rgb(255, 255, 255)' && computed !== 'rgba(255, 255, 255, 1)') {
          userColor = computed;
        }
      }

      const comment: CommentData = {
        id,
        authorName,
        authorAvatarUrl,
        contentHtml: rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        rawText,
        likeCount: isSuperChat ? 100 : 0,
        formattedLikeCount: isSuperChat ? (superChatAmount || '') : '',
        publishedTimeText: '今',
        timestamps: [],
        platform: 'youtube',
        sourcePlatform: 'youtube',
        source: 'live_chat',
        userColor,
        badges,
        isSuperChat,
        superChatAmount,
        superChatColor,
        receivedAt: Date.now(),
      };

      return comment;
    } catch {
      return null;
    }
  }
}
