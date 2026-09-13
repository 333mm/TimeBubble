import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const promoDir = path.resolve(rootDir, 'release/promo');
const iconsDir = path.resolve(rootDir, 'public/icons');

if (!fs.existsSync(promoDir)) {
  fs.mkdirSync(promoDir, { recursive: true });
}

const psScript = `
Add-Type -AssemblyName System.Drawing

$promoDir = "${promoDir.replace(/\\/g, '/')}"
$iconsDir = "${iconsDir.replace(/\\/g, '/')}"
$icon512Path = "$iconsDir/icon-512.png"
$iconImg = [System.Drawing.Bitmap]::FromFile($icon512Path)

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

# -------------------------------------------------------------
# 1. 小さいプロモーション タイル (440 x 280)
# -------------------------------------------------------------
Write-Host "Creating small promo tile (440 x 280)..."
$bmpSmall = New-Object System.Drawing.Bitmap 440, 280, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmpSmall)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bgRect = New-Object System.Drawing.Rectangle 0, 0, 440, 280
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRect, ([System.Drawing.Color]::FromArgb(255, 11, 15, 25)), ([System.Drawing.Color]::FromArgb(255, 26, 16, 48)), 45.0
$g.FillRectangle($bgBrush, $bgRect)
$bgBrush.Dispose()

$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(140, 36, 160, 160)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $glowPath
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(60, 168, 85, 247)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 168, 85, 247))
$g.FillPath($glowBrush, $glowPath)
$glowBrush.Dispose()
$glowPath.Dispose()

$iconDest = New-Object System.Drawing.Rectangle 178, 36, 84, 84
$g.DrawImage($iconImg, $iconDest)

$fontTitle = New-Object System.Drawing.Font "Segoe UI", 24, ([System.Drawing.FontStyle]::Bold)
$strFormat = New-Object System.Drawing.StringFormat
$strFormat.Alignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("TimeBubble", $fontTitle, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 220, 132, $strFormat)

$fontSub = New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Bold)
$g.DrawString("YouTube Timestamp Comments", $fontSub, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), 220, 178, $strFormat)

$fontTag = New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Regular)
$g.DrawString("Live Floating Reactions in Sync", $fontTag, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), 220, 210, $strFormat)

$g.Dispose()
$bmpSmall.Save("$promoDir/small-tile-440x280.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmpSmall.Dispose()
Write-Host "✅ Saved: $promoDir/small-tile-440x280.png"

# -------------------------------------------------------------
# 2. 大きなプロモーション タイル (1400 x 560)
# -------------------------------------------------------------
Write-Host "Creating large promo tile (1400 x 560)..."
$bmpLarge = New-Object System.Drawing.Bitmap 1400, 560, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmpLarge)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bgRectL = New-Object System.Drawing.Rectangle 0, 0, 1400, 560
$bgBrushL = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRectL, ([System.Drawing.Color]::FromArgb(255, 10, 12, 22)), ([System.Drawing.Color]::FromArgb(255, 24, 18, 46)), 30.0
$g.FillRectangle($bgBrushL, $bgRectL)
$bgBrushL.Dispose()

$g.DrawImage($iconImg, 120, 80, 110, 110)

$fontLTitle = New-Object System.Drawing.Font "Segoe UI", 42, ([System.Drawing.FontStyle]::Bold)
$g.DrawString("TimeBubble", $fontLTitle, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 120, 205)

$fontLSub = New-Object System.Drawing.Font "Segoe UI", 18, ([System.Drawing.FontStyle]::Bold)
$g.DrawString("YouTube Timestamp Comments", $fontLSub, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), 122, 280)

$fontLDesc = New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Regular)
$descBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 160, 174, 192))
$g.DrawString("Watch YouTube with synchronized floating comments." + [Environment]::NewLine + "Click any bubble to jump, like, and reply instantly.", $fontLDesc, $descBrush, 122, 330)

$badgeTexts = @("Glassmorphic UI", "Zero Latency", "100% Private", "Customizable")
$badgeX = 122
foreach ($bt in $badgeTexts) {
    $bPath = Get-SquirclePath $badgeX 420 120 32 8
    $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 255, 255, 255))), $bPath)
    $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80, 168, 85, 247), 1)), $bPath)
    
    $fBadge = New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Bold)
    $sfBadge = New-Object System.Drawing.StringFormat
    $sfBadge.Alignment = [System.Drawing.StringAlignment]::Center
    $sfBadge.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString($bt, $fBadge, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), ($badgeX + 60), 436, $sfBadge)
    
    $badgeX += 132
}

# 右側: 動画モックアップ
$mockX = 720; $mockY = 70; $mockW = 580; $mockH = 420
$mockPath = Get-SquirclePath $mockX $mockY $mockW $mockH 16
$mockBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle $mockX, $mockY, $mockW, $mockH), ([System.Drawing.Color]::FromArgb(255, 18, 24, 38)), ([System.Drawing.Color]::FromArgb(255, 30, 27, 75)), 45.0
$g.FillPath($mockBg, $mockPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(100, 99, 102, 241), 1.5)), $mockPath)

# プレイヤーのコントロールバー
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(200, 0, 0, 0))), $mockX, ($mockY + $mockH - 45), $mockW, 45)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 239, 68, 68))), ($mockX + 30), ($mockY + $mockH - 45), 240, 4)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 255, 255, 255))), ($mockX + 270), ($mockY + $mockH - 45), 280, 4)

# 吹き出し 1
$card1X = $mockX + 60; $card1Y = $mockY + 70; $card1W = 460; $card1H = 96
$card1Path = Get-SquirclePath $card1X $card1Y $card1W $card1H 14
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 24, 20, 42))), $card1Path)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 245, 158, 11), 1.5)), $card1Path)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($card1X + 16), ($card1Y + 16), 36, 36)
$g.DrawString("A", (New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card1X + 28), ($card1Y + 22))

$g.DrawString("Alex Music", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card1X + 62), ($card1Y + 16))

$tsPath1 = Get-SquirclePath ($card1X + 150) ($card1Y + 16) 54 18 5
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), $tsPath1)
$sfTs = New-Object System.Drawing.StringFormat; $sfTs.Alignment = [System.Drawing.StringAlignment]::Center; $sfTs.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("03:15", (New-Object System.Drawing.Font "Segoe UI", 8, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))), ($card1X + 177), ($card1Y + 25), $sfTs)

$g.DrawString("This guitar solo is absolute perfection! Goosebumps every time", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), ($card1X + 62), ($card1Y + 44))
$g.DrawString("LIKES: 420", (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), ($card1X + 62), ($card1Y + 70))

# 吹き出し 2
$card2X = $mockX + 90; $card2Y = $mockY + 190; $card2W = 430; $card2H = 90
$card2Path = Get-SquirclePath $card2X $card2Y $card2W $card2H 14
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 20, 24, 38))), $card2Path)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 168, 85, 247), 1.5)), $card2Path)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 236, 72, 153))), ($card2X + 16), ($card2Y + 16), 36, 36)
$g.DrawString("S", (New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card2X + 28), ($card2Y + 22))

$g.DrawString("Sarah K.", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card2X + 62), ($card2Y + 16))

$tsPath2 = Get-SquirclePath ($card2X + 130) ($card2Y + 16) 54 18 5
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 168, 85, 247))), $tsPath2)
$g.DrawString("03:16", (New-Object System.Drawing.Font "Segoe UI", 8, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card2X + 157), ($card2Y + 25), $sfTs)

$g.DrawString("Best moment of the entire concert!", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), ($card2X + 62), ($card2Y + 44))
$g.DrawString("LIKES: 85", (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), ($card2X + 62), ($card2Y + 68))

$g.Dispose()
$bmpLarge.Save("$promoDir/large-tile-1400x560.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmpLarge.Dispose()
Write-Host "✅ Saved: $promoDir/large-tile-1400x560.png"

# -------------------------------------------------------------
# 3. スクリーンショット 1 (1280 x 800) - 動画再生オーバーレイ
# -------------------------------------------------------------
Write-Host "Creating screenshot 1 (1280 x 800)..."
$bmpScreen1 = New-Object System.Drawing.Bitmap 1280, 800, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmpScreen1)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$g.Clear([System.Drawing.Color]::FromArgb(255, 15, 15, 15))

# 上部ナビバー
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 15, 15))), 0, 0, 1280, 56)
$g.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 39, 39, 39), 1)), 0, 56, 1280, 56)

# YouTubeロゴ
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 0, 0))), 24, 18, 28, 20)
$g.DrawString("YouTube", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 58, 16)

$sbPath = Get-SquirclePath 420 10 440 36 18
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 18, 18, 18))), $sbPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 48, 48, 48), 1)), $sbPath)
$g.DrawString("Search", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 136, 136, 136))), 440, 18)

# メイン動画プレイヤー
$vpX = 24; $vpY = 76; $vpW = 880; $vpH = 495
$vpRect = New-Object System.Drawing.Rectangle $vpX, $vpY, $vpW, $vpH
$vpBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $vpRect, ([System.Drawing.Color]::FromArgb(255, 10, 15, 30)), ([System.Drawing.Color]::FromArgb(255, 35, 20, 65)), 45.0
$g.FillRectangle($vpBrush, $vpRect)
$vpBrush.Dispose()

# プレイヤー内のシネマティックビジュアル (ステージ照明・光彩)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 99, 102, 241))), ($vpX + 100), ($vpY + 80), 300, 260)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 236, 72, 153))), ($vpX + 280), ($vpY + 120), 260, 240)

# コントロールバー
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 0, 0, 0))), $vpX, ($vpY + $vpH - 46), $vpW, 46)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 239, 68, 68))), $vpX, ($vpY + $vpH - 48), 340, 3)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 255, 255, 255))), ($vpX + 340), ($vpY + $vpH - 48), ($vpW - 340), 3)

$g.DrawString("04:12 / 12:45", (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($vpX + 50), ($vpY + $vpH - 32))

# プレイヤー上の TimeBubble クイックトグル
$tbToggleRect = New-Object System.Drawing.Rectangle ($vpX + $vpW - 130), ($vpY + $vpH - 38), 28, 28
$g.DrawImage($iconImg, $tbToggleRect)

# 吹き出し 1 (右上)
$b1X = $vpX + $vpW - 440; $b1Y = $vpY + 20; $b1W = 420; $b1H = 88
$b1Path = Get-SquirclePath $b1X $b1Y $b1W $b1H 14
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 15, 12, 30))), $b1Path)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 245, 158, 11), 1.5)), $b1Path)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($b1X + 14), ($b1Y + 14), 34, 34)
$g.DrawString("K", (New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b1X + 24), ($b1Y + 20))

$g.DrawString("Kenji_Live", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b1X + 56), ($b1Y + 14))

$tsB1Path = Get-SquirclePath ($b1X + 140) ($b1Y + 13) 50 17 5
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), $tsB1Path)
$g.DrawString("04:12", (New-Object System.Drawing.Font "Segoe UI", 8, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))), ($b1X + 165), ($b1Y + 21), $sfTs)

$g.DrawString("このソロパートの入り方が最高！！何度聴いても鳥肌立つ", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 241, 245, 249))), ($b1X + 56), ($b1Y + 38))
$g.DrawString("LIKES: 342", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), ($b1X + 56), ($b1Y + 62))

# 吹き出し 2
$b2X = $vpX + $vpW - 440; $b2Y = $vpY + 118; $b2W = 420; $b2H = 80
$b2Path = Get-SquirclePath $b2X $b2Y $b2W $b2H 14
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(215, 18, 16, 32))), $b2Path)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 168, 85, 247), 1.5)), $b2Path)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 236, 72, 153))), ($b2X + 14), ($b2Y + 14), 34, 34)
$g.DrawString("M", (New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b2X + 24), ($b2Y + 20))

$g.DrawString("Mika_O", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b2X + 56), ($b2Y + 14))

$tsB2Path = Get-SquirclePath ($b2X + 120) ($b2Y + 13) 50 17 5
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 168, 85, 247))), $tsB2Path)
$g.DrawString("04:12", (New-Object System.Drawing.Font "Segoe UI", 8, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b2X + 145), ($b2Y + 21), $sfTs)

$g.DrawString("生演奏の迫力すごい！ギターの音色きれい", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), ($b2X + 56), ($b2Y + 38))
$g.DrawString("LIKES: 68", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), ($b2X + 56), ($b2Y + 58))

$g.DrawString("Awesome Band - Live Tour Special Session", (New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), $vpX, ($vpY + $vpH + 16))

for ($i = 0; $i -lt 4; $i++) {
    $itemY = 76 + ($i * 110)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 30, 30))), 930, $itemY, 150, 90)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 20, 20, 20))), 1095, ($itemY + 10), 160, 14)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 20, 20, 20))), 1095, ($itemY + 34), 100, 10)
}

$g.Dispose()
$bmpScreen1.Save("$promoDir/screenshot-1-1280x800.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmpScreen1.Dispose()
Write-Host "✅ Saved: $promoDir/screenshot-1-1280x800.png"

# -------------------------------------------------------------
# 4. スクリーンショット 2 (1280 x 800) - 設定ポップアップUI
# -------------------------------------------------------------
Write-Host "Creating screenshot 2 (1280 x 800)..."
$bmpScreen2 = New-Object System.Drawing.Bitmap 1280, 800, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmpScreen2)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bgRectS2 = New-Object System.Drawing.Rectangle 0, 0, 1280, 800
$bgBrushS2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRectS2, ([System.Drawing.Color]::FromArgb(255, 12, 14, 24)), ([System.Drawing.Color]::FromArgb(255, 24, 20, 48)), 45.0
$g.FillRectangle($bgBrushS2, $bgRectS2)
$bgBrushS2.Dispose()

$g.DrawImage($iconImg, 120, 160, 90, 90)
$g.DrawString("Customize Your Experience", (New-Object System.Drawing.Font "Segoe UI", 32, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 120, 270)
$g.DrawString("Full control over bubble position, size, opacity, and duration.", (New-Object System.Drawing.Font "Segoe UI", 14, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), 122, 330)

$featureList = @(
    "✓ 4-Corner Placement: Top-Right, Bottom-Right, Top-Left, Bottom-Left",
    "✓ Scale Adjustment: Small, Medium, and Large sizing",
    "✓ Opacity Control: 0% to 100% fine-tuning",
    "✓ Instant Live Preview: Test bubbles directly on your video"
)
$fY = 390
foreach ($fl in $featureList) {
    $g.DrawString($fl, (New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), 122, $fY)
    $fY += 40
}

$pX = 760; $pY = 110; $pW = 380; $pH = 580
$pPath = Get-SquirclePath $pX $pY $pW $pH 18
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 15, 18, 30))), $pPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 124, 58, 237), 1.5)), $pPath)

$g.DrawImage($iconImg, ($pX + 24), ($pY + 22), 36, 36)
$g.DrawString("TimeBubble", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + 70), ($pY + 20))
$g.DrawString("YouTube Timestamp Comments", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), ($pX + 70), ($pY + 40))

$togPath = Get-SquirclePath ($pX + $pW - 64) ($pY + 28) 40 22 11
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), $togPath)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + $pW - 44), ($pY + 30), 18, 18)

$g.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 30, 41, 59), 1)), ($pX + 24), ($pY + 70), ($pX + $pW - 24), ($pY + 70))

$g.DrawString("表示位置 / Position", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($pX + 24), ($pY + 86))

$posOpts = @("左上", "右上 (推奨)", "左下", "右下")
for ($idx = 0; $idx -lt 4; $idx++) {
    $btnCol = $idx % 2
    $btnRow = [Math]::Floor($idx / 2)
    $bX = ($pX + 24) + ($btnCol * 170)
    $bY = ($pY + 114) + ($btnRow * 40)
    $bPath = Get-SquirclePath $bX $bY 160 34 8
    if ($idx -eq 1) {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), $bPath)
        $g.DrawString($posOpts[$idx], (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($bX + 80), ($bY + 17), $sfTs)
    } else {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 41, 59))), $bPath)
        $g.DrawString($posOpts[$idx], (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), ($bX + 80), ($bY + 17), $sfTs)
    }
}

$g.DrawString("サイズ / Scale", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($pX + 24), ($pY + 210))
$sizesOpts = @("小 (Small)", "中 (Medium)", "大 (Large)")
for ($idx = 0; $idx -lt 3; $idx++) {
    $sX = ($pX + 24) + ($idx * 114)
    $sPath = Get-SquirclePath $sX ($pY + 236) 106 34 8
    if ($idx -eq 1) {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), $sPath)
        $g.DrawString($sizesOpts[$idx], (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($sX + 53), ($pY + 253), $sfTs)
    } else {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 41, 59))), $sPath)
        $g.DrawString($sizesOpts[$idx], (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), ($sX + 53), ($pY + 253), $sfTs)
    }
}

$g.DrawString("不透明度 / Opacity: 85%", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($pX + 24), ($pY + 296))
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($pX + 24), ($pY + 328), 280, 6)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 51, 65, 85))), ($pX + 304), ($pY + 328), 48, 6)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + 296), ($pY + 322), 18, 18)

$g.DrawString("表示時間 / Duration: 4 秒", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($pX + 24), ($pY + 360))
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($pX + 24), ($pY + 392), 220, 6)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 51, 65, 85))), ($pX + 244), ($pY + 392), 108, 6)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + 236), ($pY + 386), 18, 18)

$btnTestPath = Get-SquirclePath ($pX + 24) ($pY + 430) 332 46 10
$btnTestBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle ($pX + 24), ($pY + 430), 332, 46), ([System.Drawing.Color]::FromArgb(255, 124, 58, 237)), ([System.Drawing.Color]::FromArgb(255, 236, 72, 153)), 0.0
$g.FillPath($btnTestBrush, $btnTestPath)
$g.DrawString("テスト吹き出しを表示 / Show Test Bubble", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + 190), ($pY + 453), $sfTs)

$g.Dispose()
$bmpScreen2.Save("$promoDir/screenshot-2-1280x800.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmpScreen2.Dispose()
Write-Host "✅ Saved: $promoDir/screenshot-2-1280x800.png"

# -------------------------------------------------------------
# 5. スクリーンショット 3 (1280 x 800) - コメント欄自動スクロール＆ジャンプ
# -------------------------------------------------------------
Write-Host "Creating screenshot 3 (1280 x 800)..."
$bmpScreen3 = New-Object System.Drawing.Bitmap 1280, 800, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmpScreen3)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$g.Clear([System.Drawing.Color]::FromArgb(255, 15, 15, 15))

# 上部ナビバー
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 15, 15))), 0, 0, 1280, 56)
$g.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 39, 39, 39), 1)), 0, 56, 1280, 56)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 0, 0))), 24, 18, 28, 20)
$g.DrawString("YouTube", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 58, 16)

# 左側: フィーチャー紹介バナー
$g.DrawImage($iconImg, 80, 140, 80, 80)
$g.DrawString("One-Click Jump to Comments", (New-Object System.Drawing.Font "Segoe UI", 26, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 80, 235)
$g.DrawString("Click any overlay bubble to automatically expand and smoothly" + [Environment]::NewLine + "scroll directly to that comment with radiant pulse highlight.", (New-Object System.Drawing.Font "Segoe UI", 12.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), 82, 280)

# 右側: YouTube コメントセクションのモックアップ
$cY = 90; $cX = 580; $cW = 620; $cH = 670
$cPath = Get-SquirclePath $cX $cY $cW $cH 16
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 20, 20, 22))), $cPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 45, 45, 50), 1.5)), $cPath)

$g.DrawString("Comments (1,248)", (New-Object System.Drawing.Font "Segoe UI", 14, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($cX + 24), ($cY + 20))

# 通常コメント 1
$com1Y = $cY + 65
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 75, 85, 99))), ($cX + 24), $com1Y, 36, 36)
$g.DrawString("@user-classic", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($cX + 70), $com1Y)
$g.DrawString("Great video as always! Thanks for sharing this performance.", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 156, 163, 175))), ($cX + 70), ($com1Y + 22))

# ハイライト対象コメント (パルスハイライト枠線 + ネオングロー)
$highY = $cY + 155
$highPath = Get-SquirclePath ($cX + 16) $highY ($cW - 32) 135 12
$highBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle ($cX + 16), $highY, ($cW - 32), 135), ([System.Drawing.Color]::FromArgb(70, 124, 58, 237)), ([System.Drawing.Color]::FromArgb(40, 245, 158, 11)), 45.0
$g.FillPath($highBg, $highPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 245, 158, 11), 2)), $highPath)

# 該当コメントバッジ "★ JUMPED COMMENT"
$tagPathH = Get-SquirclePath ($cX + $cW - 190) ($highY + 12) 160 22 6
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), $tagPathH)
$g.DrawString("TARGET COMMENT", (New-Object System.Drawing.Font "Segoe UI", 8, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))), ($cX + $cW - 110), ($highY + 23), $sfTs)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($cX + 32), ($highY + 16), 40, 40)
$g.DrawString("K", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($cX + 44), ($highY + 23))

$g.DrawString("Kenji_Live", (New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($cX + 84), ($highY + 16))

$tsHighPath = Get-SquirclePath ($cX + 180) ($highY + 15) 56 20 6
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), $tsHighPath)
$g.DrawString("04:12", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))), ($cX + 208), ($highY + 25), $sfTs)

$g.DrawString("このソロパートの入り方が最高！！何度聴いても鳥肌立つ", (New-Object System.Drawing.Font "Segoe UI", 10.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($cX + 84), ($highY + 44))
$g.DrawString("LIKES: 342   |   REPLY", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), ($cX + 84), ($highY + 76))

# 通常コメント 3
$com3Y = $cY + 320
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 75, 85, 99))), ($cX + 24), $com3Y, 36, 36)
$g.DrawString("@soundlover", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($cX + 70), $com3Y)
$g.DrawString("Sound mixing is so clean in this upload.", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 156, 163, 175))), ($cX + 70), ($com3Y + 22))

$g.Dispose()
$bmpScreen3.Save("$promoDir/screenshot-3-1280x800.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmpScreen3.Dispose()
Write-Host "✅ Saved: $promoDir/screenshot-3-1280x800.png"

$iconImg.Dispose()
`;

const tempPs1 = path.resolve(__dirname, 'temp_gen_promo.ps1');
try {
  fs.writeFileSync(tempPs1, '\uFEFF' + psScript, 'utf8');
  execSync(`powershell -ExecutionPolicy Bypass -File "${tempPs1}"`, { stdio: 'inherit' });
  console.log('\n🎉 All store assets generated successfully in release/promo!');
} finally {
  if (fs.existsSync(tempPs1)) {
    fs.unlinkSync(tempPs1);
  }
}
