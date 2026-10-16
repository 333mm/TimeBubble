import { CommentData, EmoteItem, MessageToken } from '../../types';

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
            const msgPayload = {
              type: 'TIMEBUBBLE_LIVE_CHAT_MESSAGE',
              comments,
            };
            window.parent.postMessage(msgPayload, '*');
            if (window.top && window.top !== window.parent) {
              window.top.postMessage(msgPayload, '*');
            }
          } catch (err) {
            console.warn('[TimeBubble:LiveChatForwarder] postMessage failed:', err);
          }
        }
      });

      this.observer.observe(container, { childList: true });
      console.log('[TimeBubble:LiveChatForwarder] Observer attached to live chat items container');

      // 既知要素IDのキャッシュ（二重送信防止用）
      const seenElementIds = new Set<string>();

      // 初回接続時に既に読み込まれている直近コメントも即座に転送
      const checkAndForwardNodes = (nodes: NodeListOf<HTMLElement> | HTMLElement[]) => {
        const batch: CommentData[] = [];
        nodes.forEach((node) => {
          const elId = node.id || node.getAttribute('id') || '';
          if (elId && seenElementIds.has(elId)) return;
          const parsed = this.parseChatMessageElement(node);
          if (parsed) {
            if (elId) seenElementIds.add(elId);
            batch.push(parsed);
          }
        });

        if (batch.length > 0) {
          try {
            const msgPayload = {
              type: 'TIMEBUBBLE_LIVE_CHAT_MESSAGE',
              comments: batch,
            };
            window.parent.postMessage(msgPayload, '*');
            if (window.top && window.top !== window.parent) {
              window.top.postMessage(msgPayload, '*');
            }
          } catch {
            // ignore
          }
        }
      };

      try {
        const initialNodes = container.querySelectorAll<HTMLElement>(
          'yt-live-chat-text-message-renderer, yt-live-chat-paid-message-renderer, yt-live-chat-membership-item-renderer, yt-live-chat-paid-sticker-renderer'
        );
        if (initialNodes.length > 0) {
          const startIdx = Math.max(0, initialNodes.length - 10);
          const sliceNodes = Array.from(initialNodes).slice(startIdx);
          checkAndForwardNodes(sliceNodes);
        }
      } catch {
        // ignore
      }

      // バックグラウンド時に MutationObserver が抑制される現象を防ぐためのポーリングバックアップ & オートスクロール維持
      setInterval(() => {
        try {
          const recentNodes = container.querySelectorAll<HTMLElement>(
            'yt-live-chat-text-message-renderer, yt-live-chat-paid-message-renderer, yt-live-chat-membership-item-renderer, yt-live-chat-paid-sticker-renderer'
          );
          if (recentNodes.length > 0) {
            const startIdx = Math.max(0, recentNodes.length - 8);
            const sliceNodes = Array.from(recentNodes).slice(startIdx);
            checkAndForwardNodes(sliceNodes);
          }

          // チャットの仮想スクロールリストを最下部に維持し、DOM更新の停止を防止
          const scroller = document.querySelector<HTMLElement>('#item-scroller, #item-list');
          if (scroller) {
            scroller.scrollTop = scroller.scrollHeight;
          }
        } catch {
          // ignore
        }
      }, 1200);
    };

    observeChat();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (!this.observer && attempts < 150) {
        observeChat();
      } else {
        clearInterval(timer);
      }
    }, 350);
  }

  private static parseChatMessageElement(el: HTMLElement): CommentData | null {
    try {
      const tagName = el.tagName.toLowerCase();

      // 1. 通常チャット (yt-live-chat-text-message-renderer)
      // 2. スパチャ (yt-live-chat-paid-message-renderer)
      // 3. メンシ加入 (yt-live-chat-membership-item-renderer)
      // 4. スーパーステッカー (yt-live-chat-paid-sticker-renderer)
      const isTextMessage = tagName === 'yt-live-chat-text-message-renderer';
      const isPaidMessage = tagName === 'yt-live-chat-paid-message-renderer';
      const isMembership = tagName === 'yt-live-chat-membership-item-renderer';
      const isPaidSticker = tagName === 'yt-live-chat-paid-sticker-renderer';

      if (!isTextMessage && !isPaidMessage && !isMembership && !isPaidSticker) return null;

      const authorEl = el.querySelector('#author-name');
      const authorName = authorEl?.textContent?.trim() || 'ユーザー';

      const imgEl = el.querySelector<HTMLImageElement>('#author-photo img');
      const authorAvatarUrl = imgEl?.src || imgEl?.getAttribute('src') || '';

      const msgEl = el.querySelector('#message');
      const tokens: MessageToken[] = [];
      const emotes: EmoteItem[] = [];
      let rawText = '';

      if (msgEl) {
        const parseNode = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const txt = node.textContent || '';
            if (txt) {
              rawText += txt;
              tokens.push({ type: 'text', text: txt });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const elem = node as HTMLElement;
            const tag = elem.tagName.toLowerCase();
            if (tag === 'img') {
              const img = elem as HTMLImageElement;
              const url = img.src || img.getAttribute('src') || '';
              const alt = img.alt || img.getAttribute('shared-tooltip-text') || img.getAttribute('aria-label') || ':emoji:';
              if (url) {
                const start = rawText.length;
                rawText += alt;
                const end = rawText.length - 1;
                emotes.push({ name: alt, url, startIndex: start, endIndex: end });
                tokens.push({ type: 'emote', url, alt, text: alt });
              } else {
                rawText += alt;
                tokens.push({ type: 'text', text: alt });
              }
            } else {
              // 子要素を再帰パース
              elem.childNodes.forEach(parseNode);
            }
          }
        };
        msgEl.childNodes.forEach(parseNode);
      }

      if (!rawText && msgEl) {
        rawText = msgEl.textContent?.trim() || '';
        if (rawText) {
          tokens.push({ type: 'text', text: rawText });
        }
      }

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
          tokens.push({ type: 'text', text: rawText });
        }
      } else if (isPaidSticker) {
        isSuperChat = true;
        const amountEl = el.querySelector('#purchase-amount-chip');
        superChatAmount = amountEl?.textContent?.trim() || 'Super Sticker';
        const stickerImg = el.querySelector<HTMLImageElement>('#sticker img');
        const stickerUrl = stickerImg?.src || stickerImg?.getAttribute('src') || '';
        const stickerAlt = stickerImg?.getAttribute('aria-label') || 'Super Sticker';
        rawText = stickerAlt;
        if (stickerUrl) {
          emotes.push({ name: stickerAlt, url: stickerUrl, startIndex: 0, endIndex: stickerAlt.length - 1 });
          tokens.push({ type: 'emote', url: stickerUrl, alt: stickerAlt, text: stickerAlt });
        } else {
          tokens.push({ type: 'text', text: stickerAlt });
        }
        const cardEl = el.querySelector<HTMLElement>('#card');
        superChatColor = cardEl ? window.getComputedStyle(cardEl).backgroundColor : '#ff8f00';
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
        emotes: emotes.length > 0 ? emotes : undefined,
        tokens: tokens.length > 0 ? tokens : undefined,
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
