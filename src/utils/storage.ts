import { DEFAULT_SETTINGS, OverlaySettings } from '../types';

const STORAGE_KEY = 'yt_comment_overlay_settings';

export async function getSettings(): Promise<OverlaySettings> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('[YT-Comment-Overlay] Failed to load settings from sync storage, falling back to local/default:', chrome.runtime.lastError);
          resolve(loadFromLocalOrDefault());
          return;
        }
        if (result && result[STORAGE_KEY]) {
          resolve({ ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] });
        } else {
          resolve(loadFromLocalOrDefault());
        }
      });
    } else {
      resolve(loadFromLocalOrDefault());
    }
  });
}

function loadFromLocalOrDefault(): Promise<OverlaySettings> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result && result[STORAGE_KEY]) {
          resolve({ ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] });
        } else {
          resolve({ ...DEFAULT_SETTINGS });
        }
      });
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          resolve({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
          return;
        }
      } catch {
        // ignore
      }
      resolve({ ...DEFAULT_SETTINGS });
    }
  });
}

export async function saveSettings(settings: Partial<OverlaySettings>): Promise<OverlaySettings> {
  const current = await getSettings();
  const updated: OverlaySettings = { ...current, ...settings };

  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ [STORAGE_KEY]: updated }, () => {
        if (chrome.runtime.lastError) {
          // Fallback to local
          if (chrome.storage.local) {
            chrome.storage.local.set({ [STORAGE_KEY]: updated }, () => resolve(updated));
            return;
          }
        }
        resolve(updated);
      });
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: updated }, () => resolve(updated));
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      resolve(updated);
    }
  });
}

export function onSettingsChange(callback: (newSettings: OverlaySettings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'sync' || areaName === 'local') {
      if (changes[STORAGE_KEY] && changes[STORAGE_KEY].newValue) {
        callback({ ...DEFAULT_SETTINGS, ...changes[STORAGE_KEY].newValue });
      }
    }
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  return () => {};
}
