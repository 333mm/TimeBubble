import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.resolve(rootDir, 'release');

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// まず両ブラウザ向けにビルド
console.log('📦 Building for Chrome and Firefox...');
execSync('node scripts/build.js all', { cwd: rootDir, stdio: 'inherit' });

const baseManifest = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'manifest.base.json'), 'utf8'));
const versionStr = baseManifest.version_name || baseManifest.version;

const targets = ['chrome', 'firefox'];
for (const target of targets) {
  const distDir = path.resolve(rootDir, `dist/${target}`);
  const zipPath = path.resolve(releaseDir, `yt-comment-overlay-${target}-v${versionStr}.zip`);

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  console.log(`🗜️ Packaging ${target} -> ${zipPath}`);

  // Windows PowerShell Compress-Archive を使用
  const cmd = `powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`✅ Packaged: ${zipPath}`);
}

console.log('\n🎉 All store packages created in release/ directory!');
