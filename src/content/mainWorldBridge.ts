/**
 * YouTube Main World (Page Context) Bridge
 * ページのメモリ上の window.ytcfg や Polymer コンポーネントに直接アクセスし、
 * Content Script (Isolated World) に DOM 要素経由でデータを渡すスクリプト。
 *
 * Chrome MV3 では CustomEvent.detail が MAIN → ISOLATED world 間で null になるため、
 * hidden DOM 要素の textContent に JSON 文字列を書き込み、Content Script 側で
 * MutationObserver / polling で読み取る方式を採用。
 */

(function () {
  const DATA_EL_ID = 'yt-co-bridge-data';
  const API_EL_ID = 'yt-co-bridge-api';

  let currentFetchAbortController: AbortController | null = null;
  let isFetchingInMainWorld = false;
  let lastSuccessfulVideoId = '';

  function getOrCreateEl(id: string): HTMLElement {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.display = 'none';
      (document.documentElement || document.body).appendChild(el);
    }
    return el;
  }

  /** DOM 要素に JSON を書き込んで Content Script に通知 */
  function writeToEl(id: string, data: unknown) {
    try {
      const el = getOrCreateEl(id);
      el.textContent = JSON.stringify(data);
      el.setAttribute('data-seq', String(Date.now()));
    } catch {
      // ignore serialization errors
    }
  }

  function getVideoIdFromUrl(): string {
    try {
      const url = new URL(window.location.href);
      const v = url.searchParams.get('v');
      if (v) return v;
      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/);
      if (embedMatch) return embedMatch[1];
    } catch {
      // ignore
    }
    return '';
  }

  function extractVideoId(data: any): string | null {
    if (!data || typeof data !== 'object') return null;
    if (typeof data.currentVideoEndpoint?.watchEndpoint?.videoId === 'string') {
      return data.currentVideoEndpoint.watchEndpoint.videoId;
    }
    if (typeof data.endpoint?.watchEndpoint?.videoId === 'string') {
      return data.endpoint.watchEndpoint.videoId;
    }
    if (typeof data.playerOverlays?.playerOverlayRenderer?.videoId === 'string') {
      return data.playerOverlays.playerOverlayRenderer.videoId;
    }
    if (typeof data.videoDetails?.videoId === 'string') {
      return data.videoDetails.videoId;
    }
    return null;
  }

  function getInnertubeConfig() {
    try {
      const win = window as any;
      const ytcfg = win.ytcfg;

      let apiKey = '';
      let clientVersion = '';
      let clientName = 'WEB';
      let visitorData = '';

      if (ytcfg && typeof ytcfg.get === 'function') {
        apiKey = ytcfg.get('INNERTUBE_API_KEY') || '';
        clientVersion = ytcfg.get('INNERTUBE_CLIENT_VERSION') || '';
        const context = ytcfg.get('INNERTUBE_CONTEXT');
        if (context?.client?.clientName) {
          clientName = context.client.clientName;
        }
        if (context?.client?.visitorData) {
          visitorData = context.client.visitorData;
        } else {
          visitorData = ytcfg.get('VISITOR_DATA') || '';
        }
      }

      const currentVideoId = getVideoIdFromUrl();
      let initialData: any = null;

      // 1. ytd-watch-flexy
      const watchFlexy = document.querySelector('ytd-watch-flexy') as any;
      if (watchFlexy) {
        const flexyVid = watchFlexy.videoId || watchFlexy.getAttribute?.('video-id');
        if (!flexyVid || !currentVideoId || flexyVid === currentVideoId) {
          initialData = watchFlexy.response || watchFlexy.__data?.response || watchFlexy.data;
        }
      }

      // 2. ytd-watch-grid
      if (!initialData) {
        const watchGrid = document.querySelector('ytd-watch-grid') as any;
        if (watchGrid) {
          const gridVid = watchGrid.videoId || watchGrid.getAttribute?.('video-id');
          if (!gridVid || !currentVideoId || gridVid === currentVideoId) {
            initialData = watchGrid.response || watchGrid.__data?.response || watchGrid.data;
          }
        }
      }

      // 3. ytd-app
      if (!initialData) {
        const ytdApp = document.querySelector('ytd-app') as any;
        if (ytdApp) {
          const appResponse = ytdApp.data?.response || ytdApp.__data?.response || ytdApp.response;
          if (appResponse) {
            const dataVid = extractVideoId(appResponse);
            if (!dataVid || !currentVideoId || dataVid === currentVideoId) {
              initialData = appResponse;
            }
          }
        }
      }

      // 4. window.ytInitialData
      if (!initialData && win.ytInitialData) {
        const dataVid = extractVideoId(win.ytInitialData);
        if (!dataVid || !currentVideoId || dataVid === currentVideoId) {
          initialData = win.ytInitialData;
        }
      }

      return { apiKey, clientVersion, clientName, visitorData, initialData, videoId: currentVideoId };
    } catch {
      return null;
    }
  }

  // ─── Continuation Token 探索 ─────────────────────────

  function findCommentContinuationToken(data: any): string | null {
    if (!data || typeof data !== 'object') return null;
    let foundToken: string | null = null;

    // 1. engagementPanels
    if (Array.isArray(data.engagementPanels)) {
      for (const panel of data.engagementPanels) {
        const r = panel?.engagementPanelSectionListRenderer;
        const id = r?.panelIdentifier || r?.targetId || '';
        if (typeof id === 'string' && id.includes('comment')) {
          const t = extractTokenFromSectionList(r?.content?.sectionListRenderer);
          if (t) return t;
        }
      }
    }

    // 2. twoColumnWatchNextResults
    const contents = data.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    if (Array.isArray(contents)) {
      for (const section of contents) {
        const is = section?.itemSectionRenderer;
        const sid = is?.sectionIdentifier || is?.targetId || '';
        if (typeof sid === 'string' && sid.includes('comment')) {
          const t = extractTokenFromItemSection(is);
          if (t) return t;
        }
      }
    }

    // 3. 再帰探索
    const walk = (node: any, inComment: boolean, depth: number) => {
      if (!node || typeof node !== 'object' || foundToken || depth > 20) return;
      const isCtx =
        inComment ||
        node.sectionIdentifier === 'comment-item-section' ||
        node.targetId === 'comments-section' ||
        node.targetId === 'engagement-panel-comments-section' ||
        node.panelIdentifier === 'engagement-panel-comments-section' ||
        'commentsHeaderRenderer' in node ||
        'commentThreadRenderer' in node ||
        'comments-header-renderer' in node;

      const cmd = node.continuationEndpoint?.continuationCommand || node.continuationCommand;
      if (cmd?.token && typeof cmd.token === 'string' && isCtx) {
        foundToken = cmd.token;
        return;
      }
      const nextCont = node.nextContinuationData?.continuation || node.reloadContinuationData?.continuation;
      if (typeof nextCont === 'string' && isCtx) {
        foundToken = nextCont;
        return;
      }

      for (const key of Object.keys(node)) {
        if (key === 'secondaryResults' || key === 'relatedVideos' || key === 'watchNextEndScreenRenderer') continue;
        walk(node[key], isCtx, depth + 1);
      }
    };
    walk(data, false, 0);
    return foundToken;
  }

  function extractTokenFromSectionList(sl: any): string | null {
    if (!sl || !Array.isArray(sl.contents)) return null;
    for (const s of sl.contents) {
      const t = extractTokenFromItemSection(s?.itemSectionRenderer);
      if (t) return t;
    }
    return null;
  }

  function extractTokenFromItemSection(is: any): string | null {
    if (!is || typeof is !== 'object') return null;

    // 1. continuations 配下 (YouTube初期状態の最頻出パターン)
    if (Array.isArray(is.continuations)) {
      for (const cont of is.continuations) {
        const token =
          cont?.nextContinuationData?.continuation ||
          cont?.reloadContinuationData?.continuation ||
          cont?.continuationEndpoint?.continuationCommand?.token ||
          cont?.continuationCommand?.token;
        if (typeof token === 'string' && token.length > 20) return token;
      }
    }

    // 2. contents 配下の continuationItemRenderer
    if (Array.isArray(is.contents)) {
      for (const item of is.contents) {
        const ci = item?.continuationItemRenderer;
        const token =
          ci?.continuationEndpoint?.continuationCommand?.token ||
          ci?.continuationCommand?.token ||
          ci?.nextContinuationData?.continuation ||
          ci?.button?.buttonRenderer?.command?.continuationCommand?.token;
        if (typeof token === 'string' && token.length > 20) return token;
      }
    }
    return null;
  }

  // ─── InnerTube API フェッチ ─────────────────────────

  async function fetchCommentsInMainWorld(
    apiKey: string,
    clientVersion: string,
    clientName: string,
    visitorData: string,
    initialToken: string | null,
    targetVideoId: string
  ) {
    if (isFetchingInMainWorld || lastSuccessfulVideoId === targetVideoId) return;

    if (currentFetchAbortController) {
      currentFetchAbortController.abort();
    }
    currentFetchAbortController = new AbortController();
    const signal = currentFetchAbortController.signal;
    isFetchingInMainWorld = true;

    let token: string | null = initialToken;
    let page = 0;
    const MAX_PAGES = 15;

    const url = `/youtubei/v1/next?key=${encodeURIComponent(apiKey)}&prettyPrint=false`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': clientVersion || '2.20240101.00.00',
    };
    if (visitorData) {
      headers['X-Goog-Visitor-Id'] = visitorData;
    }

    try {
      // トークンがまだない場合、videoId を使って初期 watchNext を叩きトークンを取得する
      if (!token && targetVideoId) {
        try {
          const initPayload = {
            context: {
              client: {
                hl: navigator.language || 'ja',
                gl: 'JP',
                clientName: clientName || 'WEB',
                clientVersion: clientVersion || '2.20240101.00.00',
                visitorData: visitorData || undefined,
              },
            },
            videoId: targetVideoId,
          };
          const initRes = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(initPayload),
            credentials: 'same-origin',
            signal,
          });
          if (initRes.ok && !signal.aborted && getVideoIdFromUrl() === targetVideoId) {
            const initJson = await initRes.json();
            writeToEl(API_EL_ID, { data: initJson, videoId: targetVideoId, page: 0 });
            token = findCommentContinuationToken(initJson);
          }
        } catch {
          // ignore
        }
      }

      while (token && page < MAX_PAGES && !signal.aborted) {
        if (getVideoIdFromUrl() !== targetVideoId) break;
        page++;

        try {
          const payload = {
            context: {
              client: {
                hl: navigator.language || 'ja',
                gl: 'JP',
                clientName: clientName || 'WEB',
                clientVersion: clientVersion || '2.20240101.00.00',
                visitorData: visitorData || undefined,
              },
            },
            continuation: token,
          };

          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            credentials: 'same-origin',
            signal,
          });

          if (!res.ok || signal.aborted || getVideoIdFromUrl() !== targetVideoId) break;

          const json = await res.json();
          if (signal.aborted || getVideoIdFromUrl() !== targetVideoId) break;

          // DOM 要素に API レスポンスを書き込み — Content Script が読み取る
          writeToEl(API_EL_ID, { data: json, videoId: targetVideoId, page });
          lastSuccessfulVideoId = targetVideoId;

          token = findNextContinuationToken(json);
          if (token && page < MAX_PAGES && !signal.aborted) {
            await new Promise((r) => setTimeout(r, 150));
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') break;
          break;
        }
      }
    } finally {
      isFetchingInMainWorld = false;
    }
  }

  function findNextContinuationToken(json: any): string | null {
    if (!json || typeof json !== 'object') return null;

    // 1. 最優先: appendContinuationItemsAction / reloadContinuationItemsCommand の末尾要素
    const endpoints = json.onResponseReceivedEndpoints || json.onResponseReceivedActions;
    if (Array.isArray(endpoints)) {
      for (const ep of endpoints) {
        const action = ep.appendContinuationItemsAction || ep.reloadContinuationItemsCommand;
        const items = action?.continuationItems;
        if (Array.isArray(items) && items.length > 0) {
          for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            const ci = item?.continuationItemRenderer;
            if (ci) {
              const cmd = ci.continuationEndpoint?.continuationCommand || ci.continuationCommand;
              if (cmd?.token && typeof cmd.token === 'string') return cmd.token;
              const nc = ci.nextContinuationData?.continuation || ci.reloadContinuationData?.continuation;
              if (typeof nc === 'string') return nc;
            }
          }
        }
      }
    }

    // 2. 汎用再帰（replies や commentRepliesRenderer は除外して親コメントのみ探索）
    const search = (node: any): string | null => {
      if (!node || typeof node !== 'object') return null;

      // 返信（replies）ブロックは絶対に探索しない
      if ('commentRepliesRenderer' in node || 'replies' in node) {
        return null;
      }

      if (Array.isArray(node.continuationItems)) {
        for (let i = node.continuationItems.length - 1; i >= 0; i--) {
          const ci = node.continuationItems[i]?.continuationItemRenderer;
          if (ci) {
            const cmd = ci.continuationEndpoint?.continuationCommand || ci.continuationCommand;
            if (cmd?.token && typeof cmd.token === 'string') return cmd.token;
          }
        }
      }

      for (const key of Object.keys(node)) {
        if (key === 'replies' || key === 'commentRepliesRenderer' || key === 'secondaryResults') continue;
        const found = search(node[key]);
        if (found) return found;
      }
      return null;
    };

    return search(json);
  }

  // ─── DOM コメントトリガー ─────────────────────────

  function triggerDomCommentsLoad() {
    try {
      const targets = document.querySelectorAll(
        'ytd-comments ytd-continuation-item-renderer, ytd-continuation-item-renderer, ytd-comments#comments'
      );
      const fakeEntry = [{ isIntersecting: true, intersectionRatio: 1.0 }];

      targets.forEach((el: any) => {
        if (typeof el.onIntersection === 'function') el.onIntersection(fakeEntry);
        if (typeof el.handleIntersection_ === 'function') el.handleIntersection_(fakeEntry);
        if (typeof el.fetchContinuation === 'function') el.fetchContinuation();
        if (typeof el.fire === 'function') el.fire('yt-load-continuation');
      });

      // ボタン要素があればクリック
      const btn = document.querySelector<HTMLElement>(
        'ytd-comments ytd-continuation-item-renderer button, #comments ytd-continuation-item-renderer button'
      );
      if (btn && typeof btn.click === 'function') {
        btn.click();
      }
    } catch {
      // ignore
    }
  }

  // ─── broadcastData: メインエントリポイント ─────────────────────────

  function broadcastData(forceData?: unknown) {
    const config = getInnertubeConfig();
    if (!config) return;

    if (forceData) {
      const currentVideoId = config.videoId;
      const dataVid = extractVideoId(forceData);
      if (!dataVid || !currentVideoId || dataVid === currentVideoId) {
        config.initialData = forceData;
      }
    }

    // 1. Content Script へ基本設定（APIキー等）を DOM 要素に書き込み
    writeToEl(DATA_EL_ID, {
      apiKey: config.apiKey,
      clientVersion: config.clientVersion,
      clientName: config.clientName,
      visitorData: config.visitorData,
      videoId: config.videoId,
    });

    // 2. DOM コンポーネントへの安全なトリガー
    triggerDomCommentsLoad();

    // 3. Main World 自前で InnerTube API フェッチ開始 (トークンがあれば直接、無ければ videoId から解決)
    if (config.apiKey && config.videoId) {
      const token = findCommentContinuationToken(config.initialData);
      fetchCommentsInMainWorld(
        config.apiKey,
        config.clientVersion,
        config.clientName,
        config.visitorData,
        token,
        config.videoId
      );
    }
  }

  // ─── イベントリスナー ─────────────────────────

  // Content Script からのリクエスト
  window.addEventListener('YT_COMMENT_OVERLAY_REQUEST_MAIN_DATA', () => {
    broadcastData();
  });

  // YouTube SPA 遷移完了
  window.addEventListener('yt-navigate-finish', (e: any) => {
    lastSuccessfulVideoId = '';
    isFetchingInMainWorld = false;
    const navResponse = e?.detail?.response;
    if (navResponse) {
      broadcastData(navResponse);
    } else {
      setTimeout(broadcastData, 100);
      setTimeout(broadcastData, 600);
      setTimeout(broadcastData, 1500);
    }
  });

  // YouTube 初期データ更新完了
  window.addEventListener('yt-page-data-updated', () => {
    setTimeout(broadcastData, 200);
  });

  // 初期実行
  broadcastData();
  setTimeout(broadcastData, 400);
  setTimeout(broadcastData, 1200);
  setTimeout(broadcastData, 2500);
  setTimeout(broadcastData, 5000);
})();
