import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.resolve(rootDir, 'public/icons');
const masterPath = path.resolve(iconsDir, 'logo-indigo-pop-master.png');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const psScript = `
Add-Type -AssemblyName System.Drawing

$masterPath = "${masterPath.replace(/\\/g, '/')}"
$iconsDir = "${iconsDir.replace(/\\/g, '/')}"

function New-SquirclePath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2.0
    $path.AddArc($x, $y, $d, $d, 180.0, 90.0)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270.0, 90.0)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0.0, 90.0)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90.0, 90.0)
    $path.CloseFigure()
    return $path
}

function New-SmoothBubblePath([float]$cx, [float]$cy, [float]$rx, [float]$ry) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $w = $rx * 2.0
    $h = $ry * 2.0
    $left = $cx - $rx
    $top = $cy - $ry
    $r = [Math]::Min($w, $h) * 0.46
    $d = $r * 2.0

    $path.AddArc($left, $top, $d, $d, 180.0, 90.0)
    $path.AddArc($left + $w - $d, $top, $d, $d, 270.0, 90.0)
    $path.AddArc($left + $w - $d, $top + $h - $d, $d, $d, 0.0, 90.0)

    $tailStart = New-Object System.Drawing.PointF (($cx - $rx * 0.12), ($top + $h))
    $tailTip = New-Object System.Drawing.PointF (($left + $rx * 0.04), ($top + $h + $ry * 0.25))
    $tailEnd = New-Object System.Drawing.PointF (($left + $rx * 0.05), ($top + $h - $ry * 0.42))

    $c1 = New-Object System.Drawing.PointF (($cx - $rx * 0.38), ($top + $h))
    $c2 = New-Object System.Drawing.PointF (($tailTip.X + $rx * 0.22), ($tailTip.Y + $ry * 0.02))
    $path.AddBezier($tailStart, $c1, $c2, $tailTip)

    $c3 = New-Object System.Drawing.PointF (($tailTip.X - $rx * 0.06), ($tailTip.Y - $ry * 0.12))
    $c4 = New-Object System.Drawing.PointF ($left, ($top + $h - $ry * 0.20))
    $path.AddBezier($tailTip, $c3, $c4, $tailEnd)

    $path.CloseFigure()
    return $path
}

function New-RoundedPlayPath([float]$cx, [float]$cy, [float]$size) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = $size * 0.20
    $d = $r * 2.0

    $x1 = $cx - $size * 0.38
    $y1 = $cy - $size * 0.50
    $x2 = $cx + $size * 0.56
    $y2 = $cy
    $x3 = $cx - $size * 0.38
    $y3 = $cy + $size * 0.50

    $path.AddArc($x1, $y1, $d, $d, 180.0, 120.0)
    $path.AddArc($x2 - $d, $y2 - $r, $d, $d, 300.0, 120.0)
    $path.AddArc($x3, $y3 - $d, $d, $d, 60.0, 120.0)
    $path.CloseFigure()
    return $path
}

# 1. Generate 1024x1024 Master Icon (Option A: Indigo Pop, Full-Bleed Squircle)
$mSize = 1024
$master = New-Object System.Drawing.Bitmap $mSize, $mSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$mg = [System.Drawing.Graphics]::FromImage($master)
$mg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$mg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$mg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$mg.Clear([System.Drawing.Color]::Transparent)

# Full-bleed squircle (0..1024, radius 240) so 16px/32px icons use 100% of available pixels
$bgPath = New-SquirclePath 0 0 1024 1024 240
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    (New-Object System.Drawing.PointF 0, 0),
    (New-Object System.Drawing.PointF 1024, 1024),
    [System.Drawing.Color]::FromArgb(255, 59, 130, 246),
    [System.Drawing.Color]::FromArgb(255, 147, 51, 234)
)
$cb = New-Object System.Drawing.Drawing2D.ColorBlend 3
$cb.Colors = @(
    [System.Drawing.Color]::FromArgb(255, 56, 189, 248),  # Sky 400 (#38BDF8)
    [System.Drawing.Color]::FromArgb(255, 99, 102, 241),  # Indigo 500 (#6366F1)
    [System.Drawing.Color]::FromArgb(255, 168, 85, 247)   # Purple 500 (#A855F7)
)
$cb.Positions = @(0.0, 0.5, 1.0)
$bgBrush.InterpolationColors = $cb
$mg.FillPath($bgBrush, $bgPath)

# Subtle inner highlight border
$borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(85, 255, 255, 255), 14)
$mg.DrawPath($borderPen, (New-SquirclePath 7 7 1010 1010 233))

# Drop shadow under speech bubble
$shadowPath = New-SmoothBubblePath 512 508 370 322
$mg.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(55, 15, 23, 42))), $shadowPath)

# Main Pure White Speech Bubble
$bubblePath = New-SmoothBubblePath 512 480 370 322
$mg.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), $bubblePath)

# Bold Time Ring Arc inside bubble (Indigo 500)
$arcPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 99, 102, 241), 50)
$arcPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$arcPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$mg.DrawArc($arcPen, 292, 260, 440, 440, -90, 240)

# Live Coral Accent Dot at 12 o'clock (#F43F5E)
$mg.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 244, 63, 94))), 479, 227, 66, 66)

# Center Bold Rounded Play Symbol (Indigo -> Purple gradient)
$playPath = New-RoundedPlayPath 523 480 220
$playBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    (New-Object System.Drawing.PointF 390, 350),
    (New-Object System.Drawing.PointF 650, 610),
    [System.Drawing.Color]::FromArgb(255, 79, 70, 229),
    [System.Drawing.Color]::FromArgb(255, 147, 51, 234)
)
$mg.FillPath($playBrush, $playPath)

if (Test-Path $masterPath) { Remove-Item $masterPath -Force }
$master.Save($masterPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Generated Master: $masterPath (1024 x 1024)"

# 2. Downsample to all required extension icon sizes
$sizes = @(16, 32, 48, 128, 256, 512)
foreach ($s in $sizes) {
    $dest = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $destRect = New-Object System.Drawing.Rectangle 0, 0, $s, $s
    $srcRect = New-Object System.Drawing.Rectangle 0, 0, $mSize, $mSize
    $g.DrawImage($master, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $g.Dispose()
    $outPath = "$iconsDir/icon-$s.png"
    if (Test-Path $outPath) { Remove-Item $outPath -Force }
    $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Host "Generated: $outPath ($s x $s)"
}

$mg.Dispose()
$master.Dispose()
`;

const tempPs1 = path.resolve(__dirname, 'temp_gen_icons.ps1');
try {
  fs.writeFileSync(tempPs1, psScript, 'utf8');
  execSync(`powershell -ExecutionPolicy Bypass -File "${tempPs1}"`, { stdio: 'inherit' });
  console.log('✅ Option A (Indigo Pop) icons generated successfully!');
} finally {
  if (fs.existsSync(tempPs1)) {
    fs.unlinkSync(tempPs1);
  }
}
