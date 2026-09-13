# TimeBubble: YouTube Timestamp Comments (タイムスタンプ吹き出し表示)

YouTubeのコメント欄にタイムスタンプ（例: `01:23`, `1:05:00`）がある場合、その秒数の場面が再生された瞬間に、動画プレイヤー上に洗練されたグラスモーフィズムUIの吹き出しを自動表示するブラウザ拡張機能です。

Chrome、Microsoft Edge、Firefoxの各拡張機能ストア（Manifest V3）に対応しています。

---

## ✨ 主な機能

1. **タイムスタンプ連動吹き出し表示**
   - 動画再生時間（`currentTime`）とコメント内のタイムスタンプをミリ秒レベルで検知・同期。
   - 場面に到達した瞬間に、画面端からスムーズにスライドイン。

2. **洗練されたグラスモーフィズム＆人気度ハイライト**
   - 半透明アクリル＋背景ブラー（`backdrop-filter: blur(16px)`）と繊細なグラデーションボーダー。
   - **高評価コメントハイライト**: いいね数に応じてネオンパープル（Popular: 50+）やゴールデンアンバー（Top-Tier: 300+）の光彩グラデーションを適用。

3. **複数コメントのスタック表示**
   - 同一秒数や近いタイミングに複数のタイムスタンプコメントがある場合、上下に積み重ねてスタック表示（心地よいスタッガーアニメーション付き）。

4. **ユーザーアイコン・メタ情報**
   - コメント投稿者のアバター画像、ユーザー名、再生タイムスタンプバッジ、いいね数をすっきりレイアウト。

5. **スマートスクロール**
   - 吹き出しをクリックすると、YouTubeのコメント欄を展開し、該当コメントの位置までスムーズに自動スクロール＆パルス発光ハイライト。

6. **4隅の配置セレクター＆大中小サイズ調整**
   - 動画画面の4隅（右上・右下・左上・左下）から吹き出しの出現位置を選択可能。
   - **大・中・小の3段階サイズ調整**: 視聴環境や好みに応じて文字や吹き出しのサイズを切り替え可能。
   - **テスト吹き出し表示**: ポップアップからワンクリックで現在の動画上にテスト吹き出しを表示し、位置やサイズを即座にプレビュー可能。
   - 表示時間（秒）、最大スタック件数、透明度（不透明度%）もカスタマイズ可能。
   - 設定変更はYouTubeタブへ即座に反映されます。

7. **Shadow DOMによる完全カプセル化**
   - YouTube本体のCSSやスクリプトと一切干渉しないShadow DOM設計。フルスクリーン再生時にも自動追従。

8. **マルチブラウザ対応 (Chrome / Edge / Firefox)**
   - Manifest V3仕様。Chrome、Edge、Firefox 109+ にネイティブ対応。

---

## 🚀 インストールと利用方法

### 開発版の読み込み（デベロッパーモード）

#### Google Chrome / Microsoft Edge
1. `npm run build:chrome` を実行します（`dist/chrome/` に出力されます）。
2. ブラウザで拡張機能の管理画面を開きます。
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. 右上の「**デベロッパー モード**」を有効にします。
4. 「**パッケージ化されていない拡張機能を読み込む**」をクリックし、`d:/Dev/yt-comment-overlay/dist/chrome` フォルダを選択します。

#### Mozilla Firefox
1. `npm run build:firefox` を実行します（`dist/firefox/` に出力されます）。
2. Firefoxで `about:debugging#/runtime/this-firefox` を開きます。
3. 「**一時的なアドオンを読み込む...**」をクリックし、`d:/Dev/yt-comment-overlay/dist/firefox/manifest.json` を選択します。

---

## 🛠️ コマンド一覧

```bash
# 依存関係のインストール
npm install

# 型チェック (エラー/警告ゼロの検証)
npm run typecheck

# Chrome / Edge向けビルド
npm run build:chrome

# Firefox向けビルド
npm run build:firefox

# 両ブラウザ向けビルド
npm run build

# ストア提出用ZIPパッケージの生成 (release/ に出力)
npm run package
```

---

## 📁 プロジェクト構成

```
yt-comment-overlay/
├── dist/                     # ビルド成果物 (chrome / firefox)
├── release/                  # ストア提出用ZIPアーカイブ
├── public/
│   └── icons/                # 拡張機能アイコン (16, 32, 48, 128px)
├── src/
│   ├── types/
│   │   └── index.ts          # 型定義 (コメント、設定、トリガー等)
│   ├── utils/
│   │   └── storage.ts        # chrome.storage ラッパー
│   ├── content/
│   │   ├── index.ts          # Content Script エントリーポイント
│   │   ├── commentFetcher.ts # コメント収集 (YouTubei API / DOM Mutation)
│   │   ├── timestampParser.ts# タイムスタンプ解析・秒数変換
│   │   ├── playerSync.ts     # 動画再生時間同期・トリガーエンジン
│   │   ├── overlayUi.ts      # Shadow DOMによる吹き出し生成・スタック管理
│   │   ├── commentScroller.ts# 該当コメントへのスムーズスクロール＆ハイライト
│   │   └── overlay.css       # グラスモーフィズム・アニメーションスタイル
│   └── popup/
│       ├── index.html        # 設定ポップアップUI (4隅セレクター)
│       ├── popup.ts          # 設定読み書きロジック
│       └── popup.css         # ポップアップ用スタイル
├── scripts/
│   ├── generate-icons.js     # アイコンPNG自動生成
│   ├── build.js              # マルチブラウザ自動ビルド
│   └── package.js            # ストア提出用ZIP作成
├── manifest.base.json        # 共通マニフェスト (MV3)
├── package.json
└── tsconfig.json
```
