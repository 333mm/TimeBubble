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

const targets = [
  { name: 'chrome', dist: 'dist/chrome' },
  { name: 'firefox', dist: 'dist/firefox' },
  { name: 'edge', dist: 'dist/chrome' },
];
for (const target of targets) {
  const distDir = path.resolve(rootDir, target.dist);
  const zipPath = path.resolve(releaseDir, `yt-comment-overlay-${target.name}-v${versionStr}.zip`);

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  console.log(`🗜️ Packaging ${target.name} -> ${zipPath}`);

  // Windows PowerShell Compress-Archive を使用
  const cmd = `powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`✅ Packaged: ${zipPath}`);
}

// AMO審査用ソースコードパッケージの作成
const sourceZipPath = path.resolve(releaseDir, `source-code-v${versionStr}.zip`);
if (fs.existsSync(sourceZipPath)) {
  fs.unlinkSync(sourceZipPath);
}
console.log(`🗜️ Packaging Source Code -> ${sourceZipPath}`);
const sourceItems = ['src', 'public', 'scripts', 'package.json', 'package-lock.json', 'tsconfig.json', 'manifest.base.json', 'README.md', '.gitignore']
  .map(item => `'${path.resolve(rootDir, item)}'`)
  .join(', ');
const sourceCmd = `powershell -Command "Compress-Archive -Path ${sourceItems} -DestinationPath '${sourceZipPath}' -Force"`;
execSync(sourceCmd, { stdio: 'inherit' });
console.log(`✅ Packaged Source Code: ${sourceZipPath}`);

console.log('\n🎉 All store packages and source code package created in release/ directory!');
