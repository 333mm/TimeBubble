import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.resolve(rootDir, 'public/icons');
const masterPath = path.resolve(iconsDir, 'logo-minimal-master.jpg');

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

# ネオングラデーションのシンボル領域 (580x580, 中心 X: 511, Y: 468)
$cropSize = 580
$cropX = [int](511 - ($cropSize / 2))
$cropY = [int](468 - ($cropSize / 2))

$sizes = @(16, 32, 48, 128, 256, 512)

function Get-SquirclePath([float]$x, [float]$y, [float]$w, [float]$h, [float]$radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2.0
    $path.AddArc($x, $y, $d, $d, 180.0, 90.0)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270.0, 90.0)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0.0, 90.0)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90.0, 90.0)
    $path.CloseFigure()
    return $path
}

foreach ($s in $sizes) {
    $dest = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # 角丸半径 (約22% = $s * 0.22)
    $r = [Math]::Max(2.0, [float]($s * 0.22))
    $path = Get-SquirclePath 0.0 0.0 ([float]$s) ([float]$s) $r
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
  console.log('✅ Modern neon minimalist icons generated successfully!');
} finally {
  if (fs.existsSync(tempPs1)) {
    fs.unlinkSync(tempPs1);
  }
}
