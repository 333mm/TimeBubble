import { DEFAULT_SETTINGS, DisplayMode, FlowSpeed, OverlayPosition, OverlaySettings, OverlaySize } from '../types';
import { getSettings, saveSettings } from '../utils/storage';

type SupportedLang = 'ja' | 'en' | 'es' | 'zh';

interface I18nStrings {
  title: string;
  subtitle: string;
  modeCard: string;
  modeFlow: string;
  position: string;
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  size: string;
  sizeSmall: string;
  sizeMedium: string;
  sizeLarge: string;
  duration: string;
  durationUnit: string;
  stack: string;
  stackUnit: string;
  opacity: string;
  flowSize: string;
  flowSpeed: string;
  flowOpacity: string;
  speedSlow: string;
  speedNormal: string;
  speedFast: string;
  highlightTitle: string;
  highlightDesc: string;
  testBtnCard: string;
  testBtnFlow: string;
  savedText: string;
  savingText: string;
  testSending: string;
  testSuccess: string;
  testFallback: string;
  testCommentText: string;
  testAuthor: string;
  supportDev: string;
}

const I18N_DATA: Record<SupportedLang, I18nStrings> = {
  ja: {
    title: 'TimeBubble',
    subtitle: 'YouTube タイムスタンプコメント',
    modeCard: 'カード表示',
    modeFlow: '流れるコメント',
    position: '表示位置',
    topLeft: '左上',
    topRight: '右上',
    bottomLeft: '左下',
    bottomRight: '右下',
    size: '表示サイズ',
    sizeSmall: '小',
    sizeMedium: '中',
    sizeLarge: '大',
    duration: '表示時間',
    durationUnit: '秒',
    stack: '最大スタック件数',
    stackUnit: '件',
    opacity: '不透明度',
    flowSize: '文字サイズ',
    flowSpeed: '流れる速度',
    flowOpacity: '背景の不透明度',
    speedSlow: '遅い',
    speedNormal: '普通',
    speedFast: '速い',
    highlightTitle: '高評価コメントをハイライト',
    highlightDesc: 'いいね数に応じてグラデーションと光彩を適用',
    testBtnCard: '現在の画面にテスト吹き出しを表示',
    testBtnFlow: '現在の画面にテスト流れるコメントを表示',
    savedText: '設定は自動保存されます',
    savingText: '設定を保存しました',
    testSending: '送信中...',
    testSuccess: '現在の画面にテスト表示しました',
    testFallback: 'プレビューを表示しました',
    testCommentText: '01:23 ここが一番好きなシーン！何度見ても最高です✨',
    testAuthor: 'テスト視聴者',
    supportDev: '開発者をサポート',
  },
  en: {
    title: 'TimeBubble',
    subtitle: 'YouTube Timestamp Comments',
    modeCard: 'Card Overlay',
    modeFlow: 'Flowing Comments',
    position: 'Position',
    topLeft: 'Top Left',
    topRight: 'Top Right',
    bottomLeft: 'Bottom Left',
    bottomRight: 'Bottom Right',
    size: 'Size',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    duration: 'Display Duration',
    durationUnit: 's',
    stack: 'Max Stack Count',
    stackUnit: '',
    opacity: 'Opacity',
    flowSize: 'Font Size',
    flowSpeed: 'Scroll Speed',
    flowOpacity: 'Background Opacity',
    speedSlow: 'Slow',
    speedNormal: 'Normal',
    speedFast: 'Fast',
    highlightTitle: 'Highlight Top Comments',
    highlightDesc: 'Apply gradient and glow based on likes',
    testBtnCard: 'Show Test Comment on Screen',
    testBtnFlow: 'Show Test Flowing Comment on Screen',
    savedText: 'Settings are saved automatically',
    savingText: 'Settings saved',
    testSending: 'Sending...',
    testSuccess: 'Test comment displayed on screen',
    testFallback: 'Preview displayed',
    testCommentText: '01:23 Best scene ever! Absolutely love this part ✨',
    testAuthor: 'Viewer',
    supportDev: 'Support Developer',
  },
  es: {
    title: 'TimeBubble',
    subtitle: 'Comentarios con Marca de Tiempo',
    modeCard: 'Modo Tarjeta',
    modeFlow: 'Comentarios en Flujo',
    position: 'Posición',
    topLeft: 'Arriba Izq.',
    topRight: 'Arriba Der.',
    bottomLeft: 'Abajo Izq.',
    bottomRight: 'Abajo Der.',
    size: 'Tamaño',
    sizeSmall: 'Pequeño',
    sizeMedium: 'Medio',
    sizeLarge: 'Grande',
    duration: 'Duración en Pantalla',
    durationUnit: 's',
    stack: 'Pila Máxima',
    stackUnit: '',
    opacity: 'Opacidad',
    flowSize: 'Tamaño de Letra',
    flowSpeed: 'Velocidad',
    flowOpacity: 'Opacidad del Fondo',
    speedSlow: 'Lento',
    speedNormal: 'Normal',
    speedFast: 'Rápido',
    highlightTitle: 'Destacar Comentarios Populares',
    highlightDesc: 'Aplica brillo y degradado según los likes',
    testBtnCard: 'Mostrar Comentario de Prueba',
    testBtnFlow: 'Mostrar Comentario Flotante de Prueba',
    savedText: 'Los ajustes se guardan automáticamente',
    savingText: 'Ajustes guardados',
    testSending: 'Enviando...',
    testSuccess: 'Comentario de prueba mostrado',
    testFallback: 'Vista previa mostrada',
    testCommentText: '01:23 ¡La mejor escena de todas! Me encanta ✨',
    testAuthor: 'Espectador',
    supportDev: 'Apoyar al desarrollador',
  },
  zh: {
    title: 'TimeBubble',
    subtitle: 'YouTube 时间戳评论',
    modeCard: '卡片模式',
    modeFlow: '弹幕模式',
    position: '显示位置',
    topLeft: '左上',
    topRight: '右上',
    bottomLeft: '左下',
    bottomRight: '右下',
    size: '显示尺寸',
    sizeSmall: '小',
    sizeMedium: '中',
    sizeLarge: '大',
    duration: '显示时长',
    durationUnit: '秒',
    stack: '最大叠加数量',
    stackUnit: '条',
    opacity: '不透明度',
    flowSize: '字体大小',
    flowSpeed: '滚动速度',
    flowOpacity: '背景不透明度',
    speedSlow: '慢速',
    speedNormal: '标准',
    speedFast: '快速',
    highlightTitle: '高赞评论高亮',
    highlightDesc: '根据点赞数应用渐变与光晕效果',
    testBtnCard: '在当前屏幕显示测试气泡',
    testBtnFlow: '在当前屏幕显示测试弹幕',
    savedText: '设置已自动保存',
    savingText: '设置已保存',
    testSending: '发送中...',
    testSuccess: '已在屏幕显示测试气泡',
    testFallback: '已显示预览',
    testCommentText: '01:23 这是最精彩的片段！百看不厌✨',
    testAuthor: '测试观众',
    supportDev: '支持开发者',
  },
};



document.addEventListener('DOMContentLoaded', async () => {
  const langSelect = document.getElementById('lang-select') as HTMLSelectElement | null;
  const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement | null;
  
  // モード切り替えタブ
  const modeCardBtn = document.getElementById('mode-card-btn') as HTMLButtonElement | null;
  const modeFlowBtn = document.getElementById('mode-flow-btn') as HTMLButtonElement | null;
  const cardModeOptions = document.getElementById('card-mode-options') as HTMLElement | null;
  const flowModeOptions = document.getElementById('flow-mode-options') as HTMLElement | null;

  // カード表示用コントロール
  const posButtons = document.querySelectorAll<HTMLButtonElement>('.pos-btn');
  const sizeButtons = document.querySelectorAll<HTMLButtonElement>('#card-mode-options .size-btn');
  const sizeVal = document.getElementById('size-val') as HTMLElement | null;
  const durationSlider = document.getElementById('duration-slider') as HTMLInputElement | null;
  const durationVal = document.getElementById('duration-val') as HTMLElement | null;
  const stackSlider = document.getElementById('stack-slider') as HTMLInputElement | null;
  const stackVal = document.getElementById('stack-val') as HTMLElement | null;
  const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement | null;
  const opacityVal = document.getElementById('opacity-val') as HTMLElement | null;

  // 流れるコメント用コントロール
  const flowSizeButtons = document.querySelectorAll<HTMLButtonElement>('.flow-size-btn');
  const flowSizeVal = document.getElementById('flow-size-val') as HTMLElement | null;
  const flowSpeedButtons = document.querySelectorAll<HTMLButtonElement>('.speed-btn');
  const flowSpeedVal = document.getElementById('flow-speed-val') as HTMLElement | null;
  const flowOpacitySlider = document.getElementById('flow-opacity-slider') as HTMLInputElement | null;
  const flowOpacityVal = document.getElementById('flow-opacity-val') as HTMLElement | null;

  // 共通コントロール
  const highlightToggle = document.getElementById('highlight-toggle') as HTMLInputElement | null;
  const testCommentBtn = document.getElementById('test-comment-btn') as HTMLButtonElement | null;
  const saveStatus = document.getElementById('save-status') as HTMLElement | null;

  // ロゴアイコンを chrome.runtime.getURL で正しく解決
  const logoImg = document.querySelector<HTMLImageElement>('.header-logo-img');
  if (logoImg && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    logoImg.src = chrome.runtime.getURL('icons/icon-48.png');
  }

  let currentSettings: OverlaySettings = { ...DEFAULT_SETTINGS };
  let currentLang: SupportedLang = 'ja';

  // 言語検出と適用
  function detectInitialLanguage(savedLang?: string): SupportedLang {
    if (savedLang && ['ja', 'en', 'es', 'zh'].includes(savedLang)) {
      return savedLang as SupportedLang;
    }
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('zh')) return 'zh';
    if (navLang.startsWith('es')) return 'es';
    if (navLang.startsWith('en')) return 'en';
    return 'ja';
  }

  function applyLanguage(lang: SupportedLang) {
    currentLang = lang;
    const t = I18N_DATA[lang] || I18N_DATA.ja;

    if (langSelect) langSelect.value = lang;

    const elSubtitle = document.getElementById('i18n-subtitle');
    if (elSubtitle) elSubtitle.textContent = t.subtitle;

    // モード切り替えタブ
    const elModeCard = document.getElementById('i18n-mode-card');
    if (elModeCard) elModeCard.textContent = t.modeCard;
    const elModeFlow = document.getElementById('i18n-mode-flow');
    if (elModeFlow) elModeFlow.textContent = t.modeFlow;

    // カードオプション言語
    const elPos = document.getElementById('i18n-position');
    if (elPos) elPos.textContent = t.position;

    const elTopLeft = document.getElementById('i18n-top-left');
    if (elTopLeft) elTopLeft.textContent = t.topLeft;
    const elTopRight = document.getElementById('i18n-top-right');
    if (elTopRight) elTopRight.textContent = t.topRight;
    const elBottomLeft = document.getElementById('i18n-bottom-left');
    if (elBottomLeft) elBottomLeft.textContent = t.bottomLeft;
    const elBottomRight = document.getElementById('i18n-bottom-right');
    if (elBottomRight) elBottomRight.textContent = t.bottomRight;

    const elSize = document.getElementById('i18n-size');
    if (elSize) elSize.textContent = t.size;
    const elSizeSmall = document.getElementById('i18n-size-small');
    if (elSizeSmall) elSizeSmall.textContent = t.sizeSmall;
    const elSizeMed = document.getElementById('i18n-size-medium');
    if (elSizeMed) elSizeMed.textContent = t.sizeMedium;
    const elSizeLarge = document.getElementById('i18n-size-large');
    if (elSizeLarge) elSizeLarge.textContent = t.sizeLarge;

    const elDuration = document.getElementById('i18n-duration');
    if (elDuration) elDuration.textContent = t.duration;
    const elStack = document.getElementById('i18n-stack');
    if (elStack) elStack.textContent = t.stack;
    const elOpacity = document.getElementById('i18n-opacity');
    if (elOpacity) elOpacity.textContent = t.opacity;

    // フローオプション言語
    const elFlowSize = document.getElementById('i18n-flow-size');
    if (elFlowSize) elFlowSize.textContent = t.flowSize;
    const elFlowSizeSmall = document.getElementById('i18n-flow-size-small');
    if (elFlowSizeSmall) elFlowSizeSmall.textContent = t.sizeSmall;
    const elFlowSizeMed = document.getElementById('i18n-flow-size-medium');
    if (elFlowSizeMed) elFlowSizeMed.textContent = t.sizeMedium;
    const elFlowSizeLarge = document.getElementById('i18n-flow-size-large');
    if (elFlowSizeLarge) elFlowSizeLarge.textContent = t.sizeLarge;

    const elFlowSpeed = document.getElementById('i18n-flow-speed');
    if (elFlowSpeed) elFlowSpeed.textContent = t.flowSpeed;
    const elSpeedSlow = document.getElementById('i18n-speed-slow');
    if (elSpeedSlow) elSpeedSlow.textContent = t.speedSlow;
    const elSpeedNormal = document.getElementById('i18n-speed-normal');
    if (elSpeedNormal) elSpeedNormal.textContent = t.speedNormal;
    const elSpeedFast = document.getElementById('i18n-speed-fast');
    if (elSpeedFast) elSpeedFast.textContent = t.speedFast;

    const elFlowOpacity = document.getElementById('i18n-flow-opacity');
    if (elFlowOpacity) elFlowOpacity.textContent = t.flowOpacity;

    // 共通オプション言語
    const elHighlightTitle = document.getElementById('i18n-highlight-title');
    if (elHighlightTitle) elHighlightTitle.textContent = t.highlightTitle;
    const elHighlightDesc = document.getElementById('i18n-highlight-desc');
    if (elHighlightDesc) elHighlightDesc.textContent = t.highlightDesc;

    const elSupportDev = document.getElementById('i18n-support-dev');
    if (elSupportDev) elSupportDev.textContent = t.supportDev;
    const elSupportLink = document.getElementById('support-link');
    if (elSupportLink) elSupportLink.title = `${t.supportDev} (Ko-fi)`;

    if (saveStatus) saveStatus.textContent = t.savedText;

    updateDynamicLabels();
  }

  function updateDynamicLabels() {
    const t = I18N_DATA[currentLang] || I18N_DATA.ja;
    const s = currentSettings.size || 'medium';
    if (sizeVal) {
      sizeVal.textContent = s === 'small' ? t.sizeSmall : s === 'large' ? t.sizeLarge : t.sizeMedium;
    }
    if (durationVal) {
      durationVal.textContent = `${currentSettings.displayDuration}${t.durationUnit}`;
    }
    if (stackVal) {
      stackVal.textContent = `${currentSettings.maxStackCount}${t.stackUnit}`;
    }

    const fs = currentSettings.flowSize || 'medium';
    if (flowSizeVal) {
      flowSizeVal.textContent = fs === 'small' ? t.sizeSmall : fs === 'large' ? t.sizeLarge : t.sizeMedium;
    }

    const spd = currentSettings.flowSpeed || 'normal';
    if (flowSpeedVal) {
      flowSpeedVal.textContent = spd === 'slow' ? t.speedSlow : spd === 'fast' ? t.speedFast : t.speedNormal;
    }

    const elTestBtn = document.getElementById('i18n-test-btn');
    if (elTestBtn) {
      elTestBtn.textContent = currentSettings.displayMode === 'flow' ? t.testBtnFlow : t.testBtnCard;
    }
  }

  function flashSaveStatus(text?: string, duration = 2500) {
    if (!saveStatus) return;
    const t = I18N_DATA[currentLang] || I18N_DATA.ja;
    saveStatus.textContent = text || t.savingText;
    setTimeout(() => {
      saveStatus.textContent = t.savedText;
    }, duration);
  }

  // 1. 設定ロード
  try {
    currentSettings = await getSettings();
    if (!currentSettings.displayMode) {
      currentSettings.displayMode = currentSettings.flowMode ? 'flow' : 'card';
    }
    currentLang = detectInitialLanguage(currentSettings.language);
    applyLanguage(currentLang);
    applySettingsToUi(currentSettings);
  } catch (err) {
    console.error('Failed to load settings', err);
  }

  function applySettingsToUi(settings: OverlaySettings) {
    if (enabledToggle) enabledToggle.checked = settings.enabled;

    const mode: DisplayMode = settings.displayMode || (settings.flowMode ? 'flow' : 'card');
    currentSettings.displayMode = mode;

    // モードタブの切り替え
    if (modeCardBtn) modeCardBtn.classList.toggle('active', mode === 'card');
    if (modeFlowBtn) modeFlowBtn.classList.toggle('active', mode === 'flow');
    if (cardModeOptions) cardModeOptions.style.display = mode === 'card' ? 'flex' : 'none';
    if (flowModeOptions) flowModeOptions.style.display = mode === 'flow' ? 'flex' : 'none';

    // カード: 位置
    posButtons.forEach((btn) => {
      const pos = btn.getAttribute('data-pos');
      if (pos === settings.position) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // カード: サイズ
    const currentSize = settings.size || 'medium';
    sizeButtons.forEach((btn) => {
      const s = btn.getAttribute('data-size');
      if (s === currentSize) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // カード: スライダー群
    if (durationSlider) durationSlider.value = settings.displayDuration.toString();
    if (stackSlider) stackSlider.value = settings.maxStackCount.toString();
    if (opacitySlider) opacitySlider.value = settings.opacity.toString();
    if (opacityVal) opacityVal.textContent = `${settings.opacity}%`;

    // フロー: サイズ
    const currentFlowSize = settings.flowSize || 'medium';
    flowSizeButtons.forEach((btn) => {
      const s = btn.getAttribute('data-size');
      if (s === currentFlowSize) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // フロー: 速度
    const currentFlowSpeed = settings.flowSpeed || 'normal';
    flowSpeedButtons.forEach((btn) => {
      const spd = btn.getAttribute('data-speed');
      if (spd === currentFlowSpeed) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // フロー: 不透明度
    const currentFlowOpacity = settings.flowOpacity ?? 65;
    if (flowOpacitySlider) flowOpacitySlider.value = currentFlowOpacity.toString();
    if (flowOpacityVal) flowOpacityVal.textContent = `${currentFlowOpacity}%`;

    // 共通: ハイライト
    if (highlightToggle) {
      highlightToggle.checked = settings.highlightPopular;
    }

    updateDynamicLabels();
  }



  /**
   * 現在アクティブなタブを取得
   */
  async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;

    const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (t1) => {
        if (t1 && t1.length > 0) {
          resolve(t1);
        } else {
          chrome.tabs.query({ active: true, lastFocusedWindow: true }, (t2) => {
            resolve(t2 || []);
          });
        }
      });
    });

    return tabs && tabs.length > 0 ? tabs[0] : null;
  }

  /**
   * 現在のアクティブタブ（実際のブラウザ画面上）にテスト吹き出しを確実に表示する
   */
  async function sendTestCommentToActiveTab(): Promise<boolean> {
    const tab = await getActiveTab();
    if (!tab || !tab.id) return false;

    const url = tab.url || '';
    // 特殊URL（chrome://, edge://, about: 等）はスクリプト注入不可
    const isInjectable = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://');
    if (!isInjectable) {
      return false;
    }

    const tabId = tab.id;

    // 1. まず既存の Content Script にメッセージ送信を試行（YouTube動画ページなど稼働中なら最優先）
    const msgSuccess = await new Promise<boolean>((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'SHOW_TEST_COMMENT', settings: currentSettings }, (response) => {
        const lastErr = chrome.runtime.lastError;
        if (!lastErr && response?.success) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

    if (msgSuccess) {
      return true;
    }

    // 2. メッセージ未応答（YouTube以外のページ、またはContent Script未起動のタブ）：
    // chrome.scripting.executeScript を使って、そのWebページのブラウザ画面上に直接テスト吹き出しを生成・表示
    if (chrome.scripting && chrome.scripting.executeScript) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: injectBrowserTestOverlay,
          args: [currentSettings, currentLang],
        });
        return true;
      } catch (err) {
        console.warn('[Popup] Direct browser test injection failed:', err);
      }
    }

    return false;
  }

  /**
   * ブラウザのWebページ側で直接実行される自律型テスト吹き出し注入関数
   */
  function injectBrowserTestOverlay(settings: any, lang: string) {
    const CONTAINER_ID = 'timebubble-browser-test-container';
    const STYLE_ID = 'timebubble-browser-test-style';

    // 1. スタイルの注入
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        #${CONTAINER_ID} {
          position: fixed !important;
          z-index: 2147483647 !important;
          display: flex !important;
          flex-direction: column !important;
          pointer-events: none !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 320px !important;
          max-width: 90vw !important;
        }
        #${CONTAINER_ID}.pos-top-right {
          top: 20px !important;
          right: 20px !important;
          bottom: auto !important;
          left: auto !important;
        }
        #${CONTAINER_ID}.pos-top-left {
          top: 20px !important;
          left: 20px !important;
          bottom: auto !important;
          right: auto !important;
        }
        #${CONTAINER_ID}.pos-bottom-right {
          bottom: 20px !important;
          right: 20px !important;
          top: auto !important;
          left: auto !important;
        }
        #${CONTAINER_ID}.pos-bottom-left {
          bottom: 20px !important;
          left: 20px !important;
          top: auto !important;
          right: auto !important;
        }
        #${CONTAINER_ID}.size-small { width: 260px !important; }
        #${CONTAINER_ID}.size-medium { width: 320px !important; }
        #${CONTAINER_ID}.size-large { width: 380px !important; }

        .tb-test-card {
          display: flex !important;
          flex-direction: column !important;
          gap: 6px !important;
          padding: 10px 14px !important;
          margin-bottom: 10px !important;
          border-radius: 12px !important;
          background: rgba(18, 24, 38, var(--tb-bg-op, 0.8)) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(255, 255, 255, var(--tb-border-op, 0.18)) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45) !important;
          color: #f8fafc !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 13px !important;
          line-height: 1.4 !important;
          pointer-events: auto !important;
          box-sizing: border-box !important;
          animation: tbCardEnter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
          transition: transform 0.25s ease, opacity 0.35s ease !important;
        }
        .tb-test-card.is-popular {
          border-color: rgba(168, 85, 247, calc(var(--tb-border-op, 0.18) * 2.5)) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 0 16px rgba(168, 85, 247, 0.3) !important;
        }
        .tb-test-card.is-toptier {
          border-color: rgba(245, 158, 11, calc(var(--tb-border-op, 0.18) * 3)) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 0 20px rgba(245, 158, 11, 0.35) !important;
        }
        .tb-test-card.size-small {
          padding: 8px 10px !important;
          font-size: 11.5px !important;
          border-radius: 9px !important;
          margin-bottom: 7px !important;
        }
        .tb-test-card.size-large {
          padding: 12px 16px !important;
          font-size: 14.5px !important;
          border-radius: 14px !important;
          margin-bottom: 12px !important;
        }
        .tb-test-card.is-exiting {
          opacity: 0 !important;
          transform: scale(0.92) translateY(-10px) !important;
        }
        @keyframes tbCardEnter {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .tb-test-hdr {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        .tb-test-avatar {
          width: 24px !important;
          height: 24px !important;
          border-radius: 50% !important;
          background: linear-gradient(135deg, #6366f1, #a855f7) !important;
          color: #ffffff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          flex-shrink: 0 !important;
        }
        .tb-test-name {
          font-weight: 600 !important;
          font-size: 12px !important;
          color: #e2e8f0 !important;
        }
        .tb-test-likes {
          margin-left: auto !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #f43f5e !important;
          background: rgba(244, 63, 94, 0.12) !important;
          padding: 1px 6px !important;
          border-radius: 10px !important;
        }
        .tb-test-body {
          color: #f8fafc !important;
          word-break: break-word !important;
        }
        .tb-test-badge {
          display: inline-flex !important;
          align-items: center !important;
          gap: 3px !important;
          color: #818cf8 !important;
          background: rgba(99, 102, 241, 0.18) !important;
          border: 1px solid rgba(99, 102, 241, 0.3) !important;
          padding: 1px 6px !important;
          border-radius: 5px !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          margin-right: 5px !important;
        }
      `;
      (document.head || document.documentElement).appendChild(styleEl);
    }

    // 2. コンテナの取得または作成
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      document.body.appendChild(container);
    }

    const pos = settings.position || 'top-right';
    const size = settings.size || 'medium';
    container.className = `pos-${pos} size-${size}`;

    const op = typeof settings.opacity === 'number' ? settings.opacity : 80;
    const bgOp = Math.max(0, Math.min(1, op / 100));
    container.style.setProperty('--tb-bg-op', bgOp.toString());
    container.style.setProperty('--tb-border-op', (bgOp * 0.22).toString());

    // 3. テストサンプルの準備
    const samplesByLang: Record<string, { text: string; time: string; author: string }[]> = {
      ja: [
        { text: '01:23 ここが一番好きなシーン！何度見ても最高です✨', time: '01:23', author: '視聴者A' },
        { text: 'この演出鳥肌立った…神回すぎる！🔥 02:45', time: '02:45', author: '視聴者B' },
        { text: '03:10 音響とBGMの入り方が完璧👏 何度でもリピートできる', time: '03:10', author: '視聴者C' },
      ],
      en: [
        { text: '01:23 Best scene ever! Absolutely love this part ✨', time: '01:23', author: 'Viewer A' },
        { text: 'Chills all over… this episode is legendary! 🔥 02:45', time: '02:45', author: 'Viewer B' },
        { text: '03:10 The soundtrack here is absolute perfection 👏', time: '03:10', author: 'Viewer C' },
      ],
      es: [
        { text: '01:23 ¡La mejor escena de todas! Me encanta ✨', time: '01:23', author: 'Espectador A' },
        { text: 'Piel de gallina con esta escena… ¡Increíble! 🔥 02:45', time: '02:45', author: 'Espectador B' },
        { text: '03:10 La música en este momento es perfecta 👏', time: '03:10', author: 'Espectador C' },
      ],
      zh: [
        { text: '01:23 这是最精彩的片段！百看不厌✨', time: '01:23', author: '观众A' },
        { text: '起鸡皮疙瘩了…这集真的封神！🔥 02:45', time: '02:45', author: '观众B' },
        { text: '03:10 这里的配乐和音效太完美了👏', time: '03:10', author: '观众C' },
      ],
    };

    const sampleList = samplesByLang[lang] || samplesByLang.ja;
    const count = Math.max(1, Math.min(settings.maxStackCount || 3, sampleList.length));
    const duration = Math.max(3, Math.min(15, settings.displayDuration || 6));
    const likesList = [420, 1500, 85];

    // 既存カードを適宜クリーンアップ
    while (container.children.length >= count) {
      container.removeChild(container.children[0]);
    }

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const item = sampleList[i % sampleList.length];
        const likes = likesList[i % likesList.length];
        const card = document.createElement('div');
        card.className = `tb-test-card size-${size}`;

        if (settings.highlightPopular) {
          if (likes >= 1000) card.classList.add('is-toptier');
          else if (likes >= 300) card.classList.add('is-popular');
        }

        // ヘッダー
        const hdr = document.createElement('div');
        hdr.className = 'tb-test-hdr';
        const avatar = document.createElement('div');
        avatar.className = 'tb-test-avatar';
        avatar.textContent = item.author.charAt(0);
        const name = document.createElement('span');
        name.className = 'tb-test-name';
        name.textContent = `${item.author} (#${i + 1}/${count})`;

        hdr.appendChild(avatar);
        hdr.appendChild(name);

        if (likes > 0) {
          const likesBadge = document.createElement('span');
          likesBadge.className = 'tb-test-likes';
          likesBadge.textContent = `♥ ${likes}`;
          hdr.appendChild(likesBadge);
        }

        // 本文
        const body = document.createElement('div');
        body.className = 'tb-test-body';
        const badge = document.createElement('span');
        badge.className = 'tb-test-badge';
        badge.textContent = `▶ ${item.time}`;
        body.appendChild(badge);
        body.appendChild(document.createTextNode(item.text.replace(item.time, '').trim()));

        card.appendChild(hdr);
        card.appendChild(body);
        container?.appendChild(card);

        // 自動退場タイマー
        setTimeout(() => {
          card.classList.add('is-exiting');
          setTimeout(() => {
            card.remove();
            if (container && container.children.length === 0) {
              container.remove();
            }
          }, 360);
        }, duration * 1000);
      }, i * 220);
    }
  }

  async function updateSetting<K extends keyof OverlaySettings>(key: K, value: OverlaySettings[K]) {
    currentSettings[key] = value;
    const updated = await saveSettings({ [key]: value });

    // 開かれている全タブに設定変更を通知（storage.onChangedでも自動同期される）
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({}, (tabs) => {
        tabs?.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_SETTINGS', settings: updated }, () => {
              // 握りつぶす
              if (chrome.runtime.lastError) { /* ignore */ }
            });
          }
        });
      });
    }

    flashSaveStatus();
  }

  // モード切り替えタブ
  function setMode(mode: DisplayMode) {
    currentSettings.displayMode = mode;
    currentSettings.flowMode = mode === 'flow';
    applySettingsToUi(currentSettings);
    updateSetting('displayMode', mode);
    updateSetting('flowMode', mode === 'flow');
  }

  modeCardBtn?.addEventListener('click', () => setMode('card'));
  modeFlowBtn?.addEventListener('click', () => setMode('flow'));

  // 言語選択セレクター
  langSelect?.addEventListener('change', () => {
    const selected = langSelect.value as SupportedLang;
    applyLanguage(selected);
    updateSetting('language', selected);
  });

  // 有効/無効トグル
  enabledToggle?.addEventListener('change', () => {
    updateSetting('enabled', enabledToggle.checked);
  });

  // 位置ボタン
  posButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pos = btn.getAttribute('data-pos') as OverlayPosition | null;
      if (!pos) return;

      posButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updateSetting('position', pos);
    });
  });

  // カードサイズボタン
  sizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = btn.getAttribute('data-size') as OverlaySize | null;
      if (!s) return;

      sizeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.size = s;
      updateDynamicLabels();
      updateSetting('size', s);
    });
  });

  // カードスライダー群
  durationSlider?.addEventListener('input', () => {
    const val = parseInt(durationSlider.value, 10);
    currentSettings.displayDuration = val;
    updateDynamicLabels();
  });
  durationSlider?.addEventListener('change', () => {
    const val = parseInt(durationSlider.value, 10);
    updateSetting('displayDuration', val);
  });

  stackSlider?.addEventListener('input', () => {
    const val = parseInt(stackSlider.value, 10);
    currentSettings.maxStackCount = val;
    updateDynamicLabels();
  });
  stackSlider?.addEventListener('change', () => {
    const val = parseInt(stackSlider.value, 10);
    updateSetting('maxStackCount', val);
  });

  opacitySlider?.addEventListener('input', () => {
    const val = parseInt(opacitySlider.value, 10);
    currentSettings.opacity = val;
    if (opacityVal) opacityVal.textContent = `${val}%`;
  });
  opacitySlider?.addEventListener('change', () => {
    const val = parseInt(opacitySlider.value, 10);
    updateSetting('opacity', val);
  });

  // フローサイズボタン
  flowSizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = btn.getAttribute('data-size') as OverlaySize | null;
      if (!s) return;
      flowSizeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.flowSize = s;
      updateDynamicLabels();
      updateSetting('flowSize', s);
    });
  });

  // フロー速度ボタン
  flowSpeedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const spd = btn.getAttribute('data-speed') as FlowSpeed | null;
      if (!spd) return;
      flowSpeedButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.flowSpeed = spd;
      updateDynamicLabels();
      updateSetting('flowSpeed', spd);
    });
  });

  // フロー不透明度スライダー
  flowOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(flowOpacitySlider.value, 10);
    currentSettings.flowOpacity = val;
    if (flowOpacityVal) flowOpacityVal.textContent = `${val}%`;
  });
  flowOpacitySlider?.addEventListener('change', () => {
    const val = parseInt(flowOpacitySlider.value, 10);
    updateSetting('flowOpacity', val);
  });

  highlightToggle?.addEventListener('change', () => {
    updateSetting('highlightPopular', highlightToggle.checked);
  });


  // テスト吹き出し表示ボタン
  testCommentBtn?.addEventListener('click', async () => {
    const t = I18N_DATA[currentLang] || I18N_DATA.ja;
    flashSaveStatus(t.testSending, 1500);

    // 実際のブラウザ（開いているWebページやYouTube画面上）にテスト吹き出しを表示
    const ok = await sendTestCommentToActiveTab();
    if (ok) {
      flashSaveStatus(t.testSuccess, 3000);
    } else {
      flashSaveStatus(t.testSuccess, 3000);
    }
  });
});
