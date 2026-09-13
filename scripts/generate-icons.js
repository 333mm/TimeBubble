import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.resolve(rootDir, 'public/icons');
const masterPath = path.resolve(iconsDir, 'logo-master.jpg');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

if (!fs.existsSync(masterPath)) {
  console.error('Master logo not found at:', masterPath);
  process.exit(1);
}

const psScript = `
Add-Type -AssemblyName System.Drawing

$masterPath = "${masterPath.replace(/\\/g, '/')}"
$iconsDir = "${iconsDir.replace(/\\/g, '/')}"
$src = [System.Drawing.Bitmap]::FromFile($masterPath)

# バブル中心 (X: 512, Y: 472), 直径 760
$cropSize = 760
$cropX = [int](512 - ($cropSize / 2))
$cropY = [int](472 - ($cropSize / 2))

$sizes = @(16, 32, 48, 128, 256, 512)

foreach ($s in $sizes) {
    $dest = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # 円形クリッピングマスク
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $s, $s)
    $g.SetClip($path)

    $srcRect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropSize, $cropSize
    $destRect = New-Object System.Drawing.Rectangle 0, 0, $s, $s
    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $g.Dispose()
    $path.Dispose()

    $outPath = "$iconsDir/icon-$s.png"
    if (Test-Path $outPath) { Remove-Item $outPath -Force }
    $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Host "Generated: $outPath ($s x $s)"
}

$src.Dispose()
`;

const tempPs1 = path.resolve(__dirname, 'temp_gen_icons.ps1');
try {
  fs.writeFileSync(tempPs1, psScript, 'utf8');
  execSync(`powershell -ExecutionPolicy Bypass -File "${tempPs1}"`, { stdio: 'inherit' });
  console.log('✅ High-quality icons generated successfully!');
} finally {
  if (fs.existsSync(tempPs1)) {
    fs.unlinkSync(tempPs1);
  }
}
