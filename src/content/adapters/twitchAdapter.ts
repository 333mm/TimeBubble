import { CommentData, PlatformType } from '../../types';
import { IPlatformAdapter, OnNewCommentCallback } from './platformAdapter';

const TWITCH_GLOBAL_BADGES: Record<string, string> = {
  broadcaster: 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309d084010d/1',
  moderator: 'https://static-cdn.jtvnw.net/badges/v1/32680ba8-ff54-414d-93c4-e4fc627e04f9/1',
  vip: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/1',
  subscriber: 'https://static-cdn.jtvnw.net/badges/v1/5d9f286a-7d19-48ea-b3d9-453b1e0a5501/1',
  turbo: 'https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-abac-f6c13f849dd4/1',
  verified: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1',
  partner: 'https://static-cdn.jtvnw.net/badges/v1/7434775d-3540-424a-8742-df873428ecad/1',
  staff: 'https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/1',
  prime: 'https://static-cdn.jtvnw.net/badges/v1/a1dd5073-19c3-4911-834c-87b376913d0d/1',
  premium: 'https://static-cdn.jtvnw.net/badges/v1/a1dd5073-19c3-4911-834c-87b376913d0d/1',
};

export class TwitchAdapter implements IPlatformAdapter {
  private onNewCommentsCallback: OnNewCommentCallback | null = null;
  private ws: WebSocket | null = null;
  private currentChannel: string = '';
  private currentVodId: string = '';
  private domObserver: MutationObserver | null = null;
  private reconnectTimer: number | null = null;
  private isDestroyed = false;
  private pingInterval: number | null = null;
  private domBadgeCache = new Map<string, string>();

  public getPlatform(): PlatformType {
    return 'twitch';
  }

  public init() {
    this.isDestroyed = false;
    this.detectCurrentTarget();
    this.setupUrlWatcher();
    this.startChatConnection();
    this.setupDomChatFallback();
  }

  public destroy() {
    this.isDestroyed = true;
    this.stopChatConnection();
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  public setOnNewComments(callback: OnNewCommentCallback) {
    this.onNewCommentsCallback = callback;
  }

  public getTargetId(): string {
    return this.currentVodId || this.currentChannel;
  }

  public isLiveStream(): boolean {
    return !this.currentVodId && !!this.currentChannel;
  }

  public getVideoElement(): HTMLVideoElement | null {
    const video = document.querySelector<HTMLVideoElement>(
      '.video-player__container video, [data-a-target="video-player"] video, video'
    );
    return video;
  }

  public getPlayerContainer(): HTMLElement | null {
    const container = document.querySelector<HTMLElement>(
      '.video-player__container, [data-a-target="video-player"], .video-player'
    );
    if (container) return container;
    const video = this.getVideoElement();
    return video ? (video.parentElement as HTMLElement) : null;
  }

  public getControlsBar(): HTMLElement | null {
    const controls = document.querySelector<HTMLElement>(
      '.video-player__default-player-controls, [data-a-target="player-controls"]'
    );
    return controls;
  }

  private detectCurrentTarget() {
    try {
      const path = window.location.pathname;
      const vodMatch = path.match(/\/videos\/(\d+)/);
      if (vodMatch) {
        this.currentVodId = vodMatch[1];
        this.currentChannel = '';
        return;
      }

      this.currentVodId = '';
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0) {
        const ignored = ['directory', 'settings', 'subscriptions', 'downloads', 'wallet', 'drops'];
        const first = parts[0].toLowerCase();
        if (!ignored.includes(first)) {
          this.currentChannel = first;
          return;
        }
      }
      this.currentChannel = '';
    } catch {
      // ignore
    }
  }

  private setupUrlWatcher() {
    let lastUrl = window.location.href;
    setInterval(() => {
      if (this.isDestroyed) return;
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        const prevChannel = this.currentChannel;
        const prevVod = this.currentVodId;
        this.detectCurrentTarget();
        if (this.currentChannel !== prevChannel || this.currentVodId !== prevVod) {
          console.log('[TimeBubble:Twitch] Target changed to:', this.getTargetId());
          this.startChatConnection();
        }
      }
    }, 1000);
  }

  /**
   * Twitch 匿名 IRC WebSocket に接続してリアルタイムチャットを受信
   */
  private startChatConnection() {
    this.stopChatConnection();
    if (!this.currentChannel) return;

    try {
      const channel = this.currentChannel.toLowerCase();
      const wsUrl = 'wss://irc-ws.chat.twitch.tv:443';
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const nick = `justinfan${randomNum}`;

      ws.onopen = () => {
        if (this.isDestroyed || this.ws !== ws) return;
        // IRC tags & commands capability 要求
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
        ws.send('PASS SCHMOOPIE');
        ws.send(`NICK ${nick}`);
        ws.send(`JOIN #${channel}`);
        console.log(`[TimeBubble:Twitch] Connected to IRC for #${channel}`);

        // Keep-alive ping
        this.pingInterval = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('PING :tmi.twitch.tv');
          }
        }, 60000);
      };

      ws.onmessage = (event) => {
        if (this.isDestroyed || this.ws !== ws) return;
        this.handleIrcMessage(event.data);
      };

      ws.onerror = (err) => {
        console.warn('[TimeBubble:Twitch] IRC WebSocket error:', err);
      };

      ws.onclose = () => {
        if (this.isDestroyed || this.ws !== ws) return;
        console.log('[TimeBubble:Twitch] IRC WebSocket closed, reconnecting in 5s...');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[TimeBubble:Twitch] Failed to initiate IRC connection:', err);
      this.scheduleReconnect();
    }
  }

  private stopChatConnection() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed && this.currentChannel) {
        this.startChatConnection();
      }
    }, 5000);
  }

  /**
   * IRC メッセージのパース
   */
  private handleIrcMessage(raw: string) {
    const lines = raw.split('\r\n').filter(Boolean);
    const newComments: CommentData[] = [];

    for (const line of lines) {
      // PING に対する PONG 返信
      if (line.startsWith('PING')) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('PONG :tmi.twitch.tv');
        }
        continue;
      }

      // PRIVMSG (通常チャット・Bits) のパース
      if (line.includes('PRIVMSG')) {
        const comment = this.parseIrcPrivmsg(line);
        if (comment) {
          newComments.push(comment);
        }
      }
    }

    if (newComments.length > 0 && this.onNewCommentsCallback) {
      this.onNewCommentsCallback(newComments);
    }
  }

  /**
   * Twitch IRC PRIVMSG を CommentData に変換
   */
  private parseIrcPrivmsg(rawLine: string): CommentData | null {
    try {
      // 形式: @tag1=val1;tag2=val2 :username!username@username.tmi.twitch.tv PRIVMSG #channel :Message text
      let tagsPart = '';
      let rest = rawLine;

      if (rawLine.startsWith('@')) {
        const spaceIdx = rawLine.indexOf(' ');
        if (spaceIdx !== -1) {
          tagsPart = rawLine.slice(1, spaceIdx);
          rest = rawLine.slice(spaceIdx + 1);
        }
      }

      const privmsgIdx = rest.indexOf('PRIVMSG');
      if (privmsgIdx === -1) return null;

      const colonAfterPrivmsg = rest.indexOf(' :', privmsgIdx);
      if (colonAfterPrivmsg === -1) return null;

      const messageText = rest.slice(colonAfterPrivmsg + 2).trim();
      if (!messageText) return null;

      // タグのパース
      const tags: Record<string, string> = {};
      tagsPart.split(';').forEach((pair) => {
        const eq = pair.indexOf('=');
        if (eq !== -1) {
          tags[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
      });

      const authorName = tags['display-name'] || this.extractUsernameFromPrefix(rest) || 'ユーザー';
      const userColor = tags['color'] || '';
      const commentId = tags['id'] || `twitch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const badgesRaw = tags['badges'] || '';
      const badges: string[] = [];
      if (badgesRaw) {
        this.harvestDomBadges();
        badgesRaw.split(',').forEach((b) => {
          const bName = b.split('/')[0];
          if (bName) {
            badges.push(this.resolveBadgeImageUrl(bName));
          }
        });
      }

      // Bits 寄付判定
      const bits = tags['bits'];
      let isSuperChat = false;
      let superChatAmount: string | undefined;
      let superChatColor: string | undefined;
      if (bits && parseInt(bits, 10) > 0) {
        isSuperChat = true;
        superChatAmount = `${bits} Bits`;
        superChatColor = '#9146FF';
      }

      const comment: CommentData = {
        id: commentId,
        authorName,
        authorAvatarUrl: '', // Twitch IRCにはアバターURLは含まれないためCSSプレースホルダーまたは文字アバター
        authorChannelUrl: `https://www.twitch.tv/${authorName}`,
        contentHtml: messageText.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        rawText: messageText,
        likeCount: isSuperChat ? 100 : 0,
        formattedLikeCount: isSuperChat ? superChatAmount! : '',
        publishedTimeText: '今',
        timestamps: [], // リアルタイムチャット
        platform: 'twitch',
        source: 'twitch_chat',
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

  private extractUsernameFromPrefix(text: string): string {
    const match = text.match(/^:([^!@]+)!/);
    return match ? match[1] : '';
  }

  /**
   * Twitchチャット欄にレンダリングされている本物のバッジ画像URLを走査・キャッシュ
   */
  private harvestDomBadges() {
    try {
      const badgeImgs = document.querySelectorAll<HTMLImageElement>(
        'img.chat-badge, [data-a-target="chat-badge"] img, .chat-line__message--badges img'
      );
      badgeImgs.forEach((img) => {
        const src = img.src || img.getAttribute('src');
        if (!src || !src.startsWith('http')) return;
        const alt = (img.alt || '').toLowerCase();

        if (alt.includes('subscriber') || alt.includes('サブスクライバー') || alt.includes('tier') || alt.includes('sub')) {
          this.domBadgeCache.set('subscriber', src);
        } else if (alt.includes('moderator') || alt.includes('モデレーター') || alt.includes('mod')) {
          this.domBadgeCache.set('moderator', src);
        } else if (alt.includes('vip')) {
          this.domBadgeCache.set('vip', src);
        } else if (alt.includes('broadcaster') || alt.includes('配信者') || alt.includes('owner')) {
          this.domBadgeCache.set('broadcaster', src);
        } else if (alt.includes('verified') || alt.includes('認証')) {
          this.domBadgeCache.set('verified', src);
        } else if (alt.includes('turbo') || alt.includes('prime')) {
          this.domBadgeCache.set('turbo', src);
        }

        // バッジ画像URL内のIDハッシュを抽出してマッピング
        const idMatch = src.match(/badges\/v1\/([^/]+)/);
        if (idMatch) {
          this.domBadgeCache.set(idMatch[1].toLowerCase(), src);
        }
      });
    } catch {
      // ignore
    }
  }

  /**
   * バッジ識別子から本物の画像URLを解決
   */
  private resolveBadgeImageUrl(rawBadge: string): string {
    const key = rawBadge.toLowerCase();
    // 1. チャット欄から収集した本物画像
    if (this.domBadgeCache.has(key)) {
      return this.domBadgeCache.get(key)!;
    }
    // 2. Twitch公式CDNバッジURL
    if (TWITCH_GLOBAL_BADGES[key]) {
      return TWITCH_GLOBAL_BADGES[key];
    }
    return rawBadge;
  }

  /**
   * DOM チャット欄の MutationObserver (WebSocket フォールバック & VOD 用)
   */
  private setupDomChatFallback() {
    const checkDom = () => {
      const container = document.querySelector(
        '[data-test-selector="chat-scrollable-area__message-container"], .chat-scrollable-area__message-container'
      );
      if (!container || this.domObserver) return;

      this.domObserver = new MutationObserver((mutations) => {
        // DOMからバッジ画像を常に最新収集
        this.harvestDomBadges();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // WebSocket が元気に動いている場合はDOM処理をスキップして二重取得を防止
          return;
        }

        const newItems: CommentData[] = [];
        for (const mut of mutations) {
          mut.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement && node.classList.contains('chat-line__message')) {
              const item = this.parseDomChatMessage(node);
              if (item) newItems.push(item);
            }
          });
        }
        if (newItems.length > 0 && this.onNewCommentsCallback) {
          this.onNewCommentsCallback(newItems);
        }
      });

      this.domObserver.observe(container, { childList: true, subtree: true });
    };

    setInterval(checkDom, 2000);
  }

  private parseDomChatMessage(el: HTMLElement): CommentData | null {
    try {
      const authorEl = el.querySelector('.chat-author__display-name');
      const authorName = authorEl?.textContent?.trim() || 'ユーザー';
      const userColor = authorEl ? window.getComputedStyle(authorEl).color : '';

      const textEl = el.querySelector('[data-a-target="chat-line-message-body"]');
      const rawText = textEl?.textContent?.trim() || '';
      if (!rawText) return null;

      // チャット欄の実DOMから直接バッジ画像URLを抽出
      const badges: string[] = [];
      const badgeImgs = el.querySelectorAll<HTMLImageElement>(
        'img.chat-badge, [data-a-target="chat-badge"] img, .chat-line__message--badges img'
      );
      badgeImgs.forEach((img) => {
        const src = img.src || img.getAttribute('src');
        if (src && src.startsWith('http')) {
          badges.push(src);
          // キャッシュにも即時反映
          const alt = (img.alt || '').toLowerCase();
          if (alt.includes('sub')) this.domBadgeCache.set('subscriber', src);
          if (alt.includes('mod')) this.domBadgeCache.set('moderator', src);
          if (alt.includes('vip')) this.domBadgeCache.set('vip', src);
          if (alt.includes('broadcaster')) this.domBadgeCache.set('broadcaster', src);
        }
      });

      const commentId = `twitch_dom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      return {
        id: commentId,
        authorName,
        authorAvatarUrl: '',
        authorChannelUrl: `https://www.twitch.tv/${authorName}`,
        contentHtml: rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        rawText,
        likeCount: 0,
        formattedLikeCount: '',
        publishedTimeText: '今',
        timestamps: [],
        platform: 'twitch',
        source: 'twitch_chat',
        userColor,
        badges,
        receivedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }
}
