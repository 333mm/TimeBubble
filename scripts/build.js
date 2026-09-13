import { build } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const targetBrowser = process.argv[2] || 'chrome'; // 'chrome' | 'firefox' | 'all'
const isFirefox = targetBrowser === 'firefox';

async function buildExtension(browserType) {
  const outDirName = browserType === 'firefox' ? 'dist/firefox' : 'dist/chrome';
  const outDir = path.resolve(rootDir, outDirName);

  console.log(`\n🚀 Building extension for [${browserType.toUpperCase()}] -> ${outDirName}`);

  // クリーンアップ
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Popup UI のビルド
  console.log('📦 Building popup UI...');
  await build({
    root: path.resolve(rootDir, 'src/popup'),
    base: '',
    build: {
      outDir: path.resolve(outDir, 'popup'),
      emptyOutDir: false,
      rollupOptions: {
        input: path.resolve(rootDir, 'src/popup/index.html'),
      },
    },
    logLevel: 'warn',
  });

  // 2. Content Script のビルド (IIFE単一バンドル)
  console.log('📦 Building content script...');
  await build({
    root: rootDir,
    build: {
      outDir: path.resolve(outDir, 'content'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'src/content/index.ts'),
        name: 'YtCommentOverlay',
        formats: ['iife'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    logLevel: 'warn',
  });

  // 3. Main World Bridge のビルド (IIFE単一バンドル)
  console.log('📦 Building main world bridge...');
  await build({
    root: rootDir,
    build: {
      outDir: path.resolve(outDir, 'content'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'src/content/mainWorldBridge.ts'),
        name: 'YtCommentOverlayBridge',
        formats: ['iife'],
        fileName: () => 'mainWorldBridge.js',
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    logLevel: 'warn',
  });

  // 4. アイコンのコピー
  console.log('🎨 Copying icons...');
  const iconsSrcDir = path.resolve(rootDir, 'public/icons');
  const iconsDestDir = path.resolve(outDir, 'icons');
  if (fs.existsSync(iconsSrcDir)) {
    fs.mkdirSync(iconsDestDir, { recursive: true });
    for (const file of fs.readdirSync(iconsSrcDir)) {
      fs.copyFileSync(path.join(iconsSrcDir, file), path.join(iconsDestDir, file));
    }
  }

  // 5. manifest.json の生成
  console.log('📝 Generating manifest.json...');
  const baseManifestPath = path.resolve(rootDir, 'manifest.base.json');
  const manifest = JSON.parse(fs.readFileSync(baseManifestPath, 'utf8'));

  if (browserType === 'firefox') {
    manifest.browser_specific_settings = {
      gecko: {
        id: "yt-comment-overlay@extension",
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: ["none"]
        }
      },
      gecko_android: {
        strict_min_version: "142.0"
      }
    };
    // Firefox互換性: content_scriptsからworld: MAINを削除（動的インジェクションで対応）
    manifest.content_scripts = manifest.content_scripts.filter(cs => cs.world !== 'MAIN');
  } else {
    // Chrome / Edge 向け: Firefox固有設定を除去
    delete manifest.browser_specific_settings;
  }

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log(`✅ Build completed successfully for [${browserType.toUpperCase()}]!`);
}

async function run() {
  if (targetBrowser === 'all') {
    await buildExtension('chrome');
    await buildExtension('firefox');
  } else {
    await buildExtension(targetBrowser);
  }
}

run().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
