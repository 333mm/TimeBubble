import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const releasePromoDir = path.resolve(rootDir, 'release/promo');
const publicPromoDir = path.resolve(rootDir, 'public/promo');
const iconsDir = path.resolve(rootDir, 'public/icons');

[releasePromoDir, publicPromoDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const psScript = `
Add-Type -AssemblyName System.Drawing

$releasePromoDir = "${releasePromoDir.replace(/\\/g, '/')}"
$publicPromoDir = "${publicPromoDir.replace(/\\/g, '/')}"
$iconsDir = "${iconsDir.replace(/\\/g, '/')}"
$icon512Path = "$iconsDir/icon-512.png"
$iconImg = [System.Drawing.Bitmap]::FromFile($icon512Path)

function Save-ImageToBothDirs([System.Drawing.Bitmap]$bmp, [string]$filename) {
    $bmp.Save("$releasePromoDir/$filename", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save("$publicPromoDir/$filename", [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "✅ Saved: $filename (release & public)"
}

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
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRect, ([System.Drawing.Color]::FromArgb(255, 10, 14, 26)), ([System.Drawing.Color]::FromArgb(255, 24, 18, 48)), 45.0
$g.FillRectangle($bgBrush, $bgRect)
$bgBrush.Dispose()

# 背景の微細なグロー
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(130, 26, 180, 180)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $glowPath
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(70, 99, 102, 241)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 99, 102, 241))
$g.FillPath($glowBrush, $glowPath)
$glowBrush.Dispose()
$glowPath.Dispose()

# 新アイコン描画 (案A: Indigo Pop)
$iconDest = New-Object System.Drawing.Rectangle 175, 30, 90, 90
$g.DrawImage($iconImg, $iconDest)

$fontTitle = New-Object System.Drawing.Font "Segoe UI", 25, ([System.Drawing.FontStyle]::Bold)
$sfCenter = New-Object System.Drawing.StringFormat
$sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("TimeBubble", $fontTitle, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 220, 130, $sfCenter)

$fontSub = New-Object System.Drawing.Font "Segoe UI", 11.5, ([System.Drawing.FontStyle]::Bold)
$g.DrawString("YouTube & Twitch Comments", $fontSub, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), 220, 178, $sfCenter)

$fontTag = New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Regular)
$g.DrawString("Live Floating Reactions in Sync", $fontTag, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), 220, 210, $sfCenter)

$g.Dispose()
Save-ImageToBothDirs $bmpSmall "small-tile-440x280.png"
$bmpSmall.Dispose()

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
$bgBrushL = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRectL, ([System.Drawing.Color]::FromArgb(255, 10, 12, 24)), ([System.Drawing.Color]::FromArgb(255, 22, 16, 44)), 30.0
$g.FillRectangle($bgBrushL, $bgRectL)
$bgBrushL.Dispose()

# 左側: アイコン & 紹介
$g.DrawImage($iconImg, 110, 75, 115, 115)

$fontLTitle = New-Object System.Drawing.Font "Segoe UI", 42, ([System.Drawing.FontStyle]::Bold)
$g.DrawString("TimeBubble", $fontLTitle, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 110, 202)

$fontLSub = New-Object System.Drawing.Font "Segoe UI", 18, ([System.Drawing.FontStyle]::Bold)
$g.DrawString("YouTube & Twitch Timestamp Comments", $fontLSub, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), 112, 276)

$fontLDesc = New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Regular)
$descBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 160, 174, 192))
$g.DrawString("Watch videos with synchronized floating reactions." + [Environment]::NewLine + "Card and Flow modes, 1-click comment jump, and full PiP support.", $fontLDesc, $descBrush, 112, 326)

$badgeTexts = @("Glassmorphic UI", "Zero Latency", "100% Private", "YouTube & Twitch")
$badgeX = 112
foreach ($bt in $badgeTexts) {
    $bPath = Get-SquirclePath $badgeX 420 125 34 8
    $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 255, 255, 255))), $bPath)
    $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 168, 85, 247), 1)), $bPath)
    
    $fBadge = New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Bold)
    $sfB = New-Object System.Drawing.StringFormat
    $sfB.Alignment = [System.Drawing.StringAlignment]::Center
    $sfB.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString($bt, $fBadge, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), ($badgeX + 62), 437, $sfB)
    
    $badgeX += 137
}

# 右側: 動画モックアップ
$mockX = 720; $mockY = 65; $mockW = 590; $mockH = 430
$mockPath = Get-SquirclePath $mockX $mockY $mockW $mockH 16
$mockBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle $mockX, $mockY, $mockW, $mockH), ([System.Drawing.Color]::FromArgb(255, 16, 20, 34)), ([System.Drawing.Color]::FromArgb(255, 28, 24, 68)), 45.0
$g.FillPath($mockBg, $mockPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(100, 99, 102, 241), 1.5)), $mockPath)

# プレイヤー内の光彩エフェクト
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 99, 102, 241))), ($mockX + 80), ($mockY + 60), 260, 240)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 236, 72, 153))), ($mockX + 240), ($mockY + 100), 240, 220)

# コントロールバー
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 0, 0, 0))), $mockX, ($mockY + $mockH - 45), $mockW, 45)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 239, 68, 68))), ($mockX + 25), ($mockY + $mockH - 45), 260, 4)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(50, 255, 255, 255))), ($mockX + 285), ($mockY + $mockH - 45), 280, 4)
$g.DrawImage($iconImg, ($mockX + $mockW - 50), ($mockY + $mockH - 38), 30, 30)

# 吹き出し 1
$card1X = $mockX + 50; $card1Y = $mockY + 65; $card1W = 480; $card1H = 98
$card1Path = Get-SquirclePath $card1X $card1Y $card1W $card1H 14
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225, 20, 16, 38))), $card1Path)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 245, 158, 11), 1.5)), $card1Path)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($card1X + 16), ($card1Y + 16), 38, 38)
$g.DrawString("A", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card1X + 28), ($card1Y + 22))

$g.DrawString("Alex Music", (New-Object System.Drawing.Font "Segoe UI", 10.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card1X + 64), ($card1Y + 16))

$tsPath1 = Get-SquirclePath ($card1X + 155) ($card1Y + 15) 56 20 6
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), $tsPath1)
$sfTs = New-Object System.Drawing.StringFormat; $sfTs.Alignment = [System.Drawing.StringAlignment]::Center; $sfTs.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("03:15", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))), ($card1X + 183), ($card1Y + 25), $sfTs)

$g.DrawString("This guitar solo is absolute perfection! Goosebumps every time", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), ($card1X + 64), ($card1Y + 44))
$g.DrawString("LIKES: 420", (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), ($card1X + 64), ($card1Y + 70))

# 吹き出し 2
$card2X = $mockX + 80; $card2Y = $mockY + 190; $card2W = 450; $card2H = 92
$card2Path = Get-SquirclePath $card2X $card2Y $card2W $card2H 14
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 18, 20, 36))), $card2Path)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(190, 168, 85, 247), 1.5)), $card2Path)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 236, 72, 153))), ($card2X + 16), ($card2Y + 16), 38, 38)
$g.DrawString("S", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card2X + 28), ($card2Y + 22))

$g.DrawString("Sarah K.", (New-Object System.Drawing.Font "Segoe UI", 10.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card2X + 64), ($card2Y + 16))

$tsPath2 = Get-SquirclePath ($card2X + 135) ($card2Y + 15) 56 20 6
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 168, 85, 247))), $tsPath2)
$g.DrawString("03:16", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($card2X + 163), ($card2Y + 25), $sfTs)

$g.DrawString("Best moment of the entire concert!", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), ($card2X + 64), ($card2Y + 44))
$g.DrawString("LIKES: 85", (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), ($card2X + 64), ($card2Y + 68))

$g.Dispose()
Save-ImageToBothDirs $bmpLarge "large-tile-1400x560.png"
$bmpLarge.Dispose()

# -------------------------------------------------------------
# 3. スクリーンショット 1 (1280 x 800) - タイムスタンプ同期オーバーレイ
# -------------------------------------------------------------
Write-Host "Creating screenshot 1 (1280 x 800)..."
$bmpScreen1 = New-Object System.Drawing.Bitmap 1280, 800, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmpScreen1)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$g.Clear([System.Drawing.Color]::FromArgb(255, 13, 14, 20))

# 上部ナビバー
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 17, 24))), 0, 0, 1280, 56)
$g.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 38, 42, 54), 1)), 0, 56, 1280, 56)

# YouTube ロゴ
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 0, 0))), 28, 18, 28, 20)
$g.DrawString("YouTube", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 62, 16)

$sbPath = Get-SquirclePath 420 10 440 36 18
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 22, 25, 36))), $sbPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 50, 56, 74), 1)), $sbPath)
$g.DrawString("Search", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 140, 150, 170))), 440, 18)

# メイン動画プレイヤー
$vpX = 28; $vpY = 74; $vpW = 860; $vpH = 484
$vpRect = New-Object System.Drawing.Rectangle $vpX, $vpY, $vpW, $vpH
$vpBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $vpRect, ([System.Drawing.Color]::FromArgb(255, 12, 16, 32)), ([System.Drawing.Color]::FromArgb(255, 30, 22, 60)), 45.0
$g.FillRectangle($vpBrush, $vpRect)
$vpBrush.Dispose()

# シネマティック照明
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(45, 99, 102, 241))), ($vpX + 90), ($vpY + 70), 320, 270)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 236, 72, 153))), ($vpX + 270), ($vpY + 110), 280, 250)

# コントロールバー
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 0, 0, 0))), $vpX, ($vpY + $vpH - 46), $vpW, 46)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 239, 68, 68))), $vpX, ($vpY + $vpH - 48), 340, 3)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 255, 255, 255))), ($vpX + 340), ($vpY + $vpH - 48), ($vpW - 340), 3)

$g.DrawString("04:12 / 12:45", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($vpX + 50), ($vpY + $vpH - 33))

# コントロールバー右端の TimeBubble トグルボタン
$tbToggleRect = New-Object System.Drawing.Rectangle ($vpX + $vpW - 130), ($vpY + $vpH - 38), 28, 28
$g.DrawImage($iconImg, $tbToggleRect)

# 吹き出し 1 (右上)
$b1X = $vpX + $vpW - 440; $b1Y = $vpY + 22; $b1W = 420; $b1H = 88
$b1Path = Get-SquirclePath $b1X $b1Y $b1W $b1H 14
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(230, 16, 14, 32))), $b1Path)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(235, 245, 158, 11), 1.5)), $b1Path)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($b1X + 14), ($b1Y + 14), 34, 34)
$g.DrawString("K", (New-Object System.Drawing.Font "Segoe UI", 11.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b1X + 24), ($b1Y + 20))

$g.DrawString("Kenji_Live", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b1X + 56), ($b1Y + 14))

$tsB1Path = Get-SquirclePath ($b1X + 140) ($b1Y + 13) 50 18 5
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), $tsB1Path)
$g.DrawString("04:12", (New-Object System.Drawing.Font "Segoe UI", 8, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))), ($b1X + 165), ($b1Y + 22), $sfTs)

$g.DrawString("このソロパートの入り方が最高！！何度聴いても鳥肌立つ", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 241, 245, 249))), ($b1X + 56), ($b1Y + 38))
$g.DrawString("LIKES: 342", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), ($b1X + 56), ($b1Y + 62))

# 吹き出し 2
$b2X = $vpX + $vpW - 440; $b2Y = $vpY + 120; $b2W = 420; $b2H = 82
$b2Path = Get-SquirclePath $b2X $b2Y $b2W $b2H 14
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225, 20, 18, 36))), $b2Path)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(190, 168, 85, 247), 1.5)), $b2Path)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 236, 72, 153))), ($b2X + 14), ($b2Y + 14), 34, 34)
$g.DrawString("M", (New-Object System.Drawing.Font "Segoe UI", 11.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b2X + 24), ($b2Y + 20))

$g.DrawString("Mika_O", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b2X + 56), ($b2Y + 14))

$tsB2Path = Get-SquirclePath ($b2X + 120) ($b2Y + 13) 50 18 5
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 168, 85, 247))), $tsB2Path)
$g.DrawString("04:12", (New-Object System.Drawing.Font "Segoe UI", 8, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($b2X + 145), ($b2Y + 22), $sfTs)

$g.DrawString("生演奏の迫力すごい！ギターの音色きれい", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), ($b2X + 56), ($b2Y + 38))
$g.DrawString("LIKES: 68", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), ($b2X + 56), ($b2Y + 58))

# 動画タイトル & チャンネルメタ情報
$g.DrawString("Awesome Band - Live Tour Special Session (Official 4K)", (New-Object System.Drawing.Font "Segoe UI", 16, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), $vpX, ($vpY + $vpH + 14))

# チャンネルアバター & 名前
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), $vpX, ($vpY + $vpH + 50), 38, 38)
$g.DrawString("A", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($vpX + 12), ($vpY + $vpH + 56))
$g.DrawString("Awesome Band Official", (New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($vpX + 48), ($vpY + $vpH + 50))
$g.DrawString("1.42M subscribers", (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 150, 160, 180))), ($vpX + 48), ($vpY + $vpH + 68))

# 登録ボタン
$subBtnPath = Get-SquirclePath ($vpX + 220) ($vpY + $vpH + 52) 100 34 17
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), $subBtnPath)
$g.DrawString("Subscribe", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)), ($vpX + 270), ($vpY + $vpH + 69), $sfTs)

# 下部フィーチャーバナー (黒余白を魅力的に活用)
$featBannerPath = Get-SquirclePath $vpX ($vpY + $vpH + 104) 860 110 14
$featBannerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle $vpX, ($vpY + $vpH + 104), 860, 110), ([System.Drawing.Color]::FromArgb(220, 20, 24, 42)), ([System.Drawing.Color]::FromArgb(220, 36, 28, 64)), 0.0
$g.FillPath($featBannerBrush, $featBannerPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(100, 124, 58, 237), 1.5)), $featBannerPath)

$g.DrawImage($iconImg, ($vpX + 20), ($vpY + $vpH + 120), 76, 76)
$g.DrawString("Floating Timestamp Reactions in Real-Time", (New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($vpX + 110), ($vpY + $vpH + 122))
$g.DrawString("Comments appear automatically when the video hits their timestamps." + [Environment]::NewLine + "Click any bubble to jump directly to that comment in the thread.", (New-Object System.Drawing.Font "Segoe UI", 10.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($vpX + 110), ($vpY + $vpH + 152))

# 右側サイドバー (関連動画サムネイルモック)
for ($i = 0; $i -lt 5; $i++) {
    $itemY = 74 + ($i * 135)
    $thPath = Get-SquirclePath 915 $itemY 165 96 10
    $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 26, 30, 44))), $thPath)
    $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 45, 52, 72), 1)), $thPath)
    
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 38, 44, 64))), 1095, ($itemY + 12), 160, 15)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 36, 52))), 1095, ($itemY + 36), 110, 12)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 36, 52))), 1095, ($itemY + 54), 80, 10)
}

$g.Dispose()
Save-ImageToBothDirs $bmpScreen1 "screenshot-1-1280x800.png"
$bmpScreen1.Dispose()

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
$bgBrushS2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRectS2, ([System.Drawing.Color]::FromArgb(255, 10, 14, 26)), ([System.Drawing.Color]::FromArgb(255, 24, 18, 50)), 45.0
$g.FillRectangle($bgBrushS2, $bgRectS2)
$bgBrushS2.Dispose()

# 左側: タイトル & 特徴リスト
$g.DrawImage($iconImg, 100, 130, 95, 95)
$g.DrawString("Customize Your Experience", (New-Object System.Drawing.Font "Segoe UI", 32, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 100, 245)
$g.DrawString("Full control over bubble layout, animation, opacity, and duration.", (New-Object System.Drawing.Font "Segoe UI", 14, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), 102, 305)

$featureList = @(
    "✓ Dual Tabs: Timestamp Comments & Live Stream Mode",
    "✓ 3 Display Modes: Glass Cards, Flowing Comments & Chat Log",
    "✓ 4-Corner Placement: Top-Right, Top-Left, Bottom-Right, Bottom-Left",
    "✓ Fine Tuning: Opacity, Scale, and Duration sliders",
    "✓ Full Support for YouTube Replays & Twitch Streams"
)
$fY = 365
foreach ($fl in $featureList) {
    $g.DrawString($fl, (New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), 102, $fY)
    $fY += 44
}

# 右側: ポップアップ UI モックアップ (最新版 TimeBubble v1.6.x 仕様)
$pX = 740; $pY = 80; $pW = 420; $pH = 640
$pPath = Get-SquirclePath $pX $pY $pW $pH 20
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(250, 15, 18, 32))), $pPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 124, 58, 237), 1.5)), $pPath)

# ヘッダー
$g.DrawImage($iconImg, ($pX + 24), ($pY + 20), 40, 40)
$g.DrawString("TimeBubble", (New-Object System.Drawing.Font "Segoe UI", 14, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + 72), ($pY + 18))
$g.DrawString("YouTube & Twitch Comments", (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), ($pX + 72), ($pY + 40))

# 有効トグル
$togPath = Get-SquirclePath ($pX + $pW - 68) ($pY + 28) 44 24 12
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), $togPath)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + $pW - 46), ($pY + 30), 20, 20)

# ナビタブバー (タイムスタンプ / ライブ)
$tab1Path = Get-SquirclePath ($pX + 24) ($pY + 76) 180 34 8
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), $tab1Path)
$g.DrawString("タイムスタンプ (Video)", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + 114), ($pY + 93), $sfTs)

$tab2Path = Get-SquirclePath ($pX + 216) ($pY + 76) 180 34 8
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 41, 59))), $tab2Path)
$g.DrawString("ライブ (Live / Twitch)", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), ($pX + 306), ($pY + 93), $sfTs)

# モード選択 (カード / 流れる / ログ)
$g.DrawString("表示モード / Display Mode", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($pX + 24), ($pY + 128))
$modes = @("カード (Card)", "流れる (Flow)", "ログ (Chat)")
for ($mIdx = 0; $mIdx -lt 3; $mIdx++) {
    $mX = ($pX + 24) + ($mIdx * 124)
    $mPath = Get-SquirclePath $mX ($pY + 154) 116 32 8
    if ($mIdx -eq 0) {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 124, 58, 237))), $mPath)
        $g.DrawString($modes[$mIdx], (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($mX + 58), ($pY + 170), $sfTs)
    } else {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 41, 59))), $mPath)
        $g.DrawString($modes[$mIdx], (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), ($mX + 58), ($pY + 170), $sfTs)
    }
}

# 位置選択
$g.DrawString("表示位置 / Position", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($pX + 24), ($pY + 204))
$posOpts = @("左上", "右上 (推奨)", "左下", "右下")
for ($idx = 0; $idx -lt 4; $idx++) {
    $btnCol = $idx % 2
    $btnRow = [Math]::Floor($idx / 2)
    $bX = ($pX + 24) + ($btnCol * 190)
    $bY = ($pY + 230) + ($btnRow * 38)
    $bPath = Get-SquirclePath $bX $bY 180 32 8
    if ($idx -eq 1) {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), $bPath)
        $g.DrawString($posOpts[$idx], (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($bX + 90), ($bY + 16), $sfTs)
    } else {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 41, 59))), $bPath)
        $g.DrawString($posOpts[$idx], (New-Object System.Drawing.Font "Segoe UI", 9, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), ($bX + 90), ($bY + 16), $sfTs)
    }
}

# サイズ
$g.DrawString("サイズ / Scale", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($pX + 24), ($pY + 322))
$sizesOpts = @("小 (Small)", "中 (Medium)", "大 (Large)")
for ($idx = 0; $idx -lt 3; $idx++) {
    $sX = ($pX + 24) + ($idx * 124)
    $sPath = Get-SquirclePath $sX ($pY + 348) 116 32 8
    if ($idx -eq 1) {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), $sPath)
        $g.DrawString($sizesOpts[$idx], (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($sX + 58), ($pY + 364), $sfTs)
    } else {
        $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 41, 59))), $sPath)
        $g.DrawString($sizesOpts[$idx], (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), ($sX + 58), ($pY + 364), $sfTs)
    }
}

# 不透明度スライダー
$g.DrawString("不透明度 / Opacity: 85%", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($pX + 24), ($pY + 398))
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($pX + 24), ($pY + 428), 310, 6)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 51, 65, 85))), ($pX + 334), ($pY + 428), 58, 6)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + 326), ($pY + 422), 18, 18)

# 表示時間スライダー
$g.DrawString("表示時間 / Duration: 4 秒", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($pX + 24), ($pY + 458))
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($pX + 24), ($pY + 488), 250, 6)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 51, 65, 85))), ($pX + 274), ($pY + 488), 118, 6)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + 266), ($pY + 482), 18, 18)

# テストボタン
$btnTestPath = Get-SquirclePath ($pX + 24) ($pY + 530) 372 48 10
$btnTestBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle ($pX + 24), ($pY + 530), 372, 48), ([System.Drawing.Color]::FromArgb(255, 124, 58, 237)), ([System.Drawing.Color]::FromArgb(255, 236, 72, 153)), 0.0
$g.FillPath($btnTestBrush, $btnTestPath)
$g.DrawString("テスト吹き出しを表示 / Show Test Bubble", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($pX + 210), ($pY + 554), $sfTs)

$g.Dispose()
Save-ImageToBothDirs $bmpScreen2 "screenshot-2-1280x800.png"
$bmpScreen2.Dispose()

# -------------------------------------------------------------
# 5. スクリーンショット 3 (1280 x 800) - コメント欄自動スクロール＆ジャンプ
# -------------------------------------------------------------
Write-Host "Creating screenshot 3 (1280 x 800)..."
$bmpScreen3 = New-Object System.Drawing.Bitmap 1280, 800, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmpScreen3)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$g.Clear([System.Drawing.Color]::FromArgb(255, 13, 14, 20))

# 上部ナビバー
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 17, 24))), 0, 0, 1280, 56)
$g.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 38, 42, 54), 1)), 0, 56, 1280, 56)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 0, 0))), 28, 18, 28, 20)
$g.DrawString("YouTube", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 62, 16)

# 左側: フィーチャー紹介バナー
$g.DrawImage($iconImg, 75, 130, 85, 85)
$g.DrawString("One-Click Jump to Comments", (New-Object System.Drawing.Font "Segoe UI", 26, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 75, 230)
$g.DrawString("Click any overlay bubble to automatically expand and smoothly" + [Environment]::NewLine + "scroll directly to that comment with radiant pulse highlight.", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), 77, 276)

$jumpFeatures = @(
    "✓ Auto-expands collapsed YouTube comment thread",
    "✓ Smoothly scrolls target comment into center view",
    "✓ Radiant golden neon highlight pulse effect",
    "✓ Instant interaction: Like, Dislike & Reply directly"
)
$jfY = 360
foreach ($jf in $jumpFeatures) {
    $g.DrawString($jf, (New-Object System.Drawing.Font "Segoe UI", 11.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), 77, $jfY)
    $jfY += 40
}

# 右側: YouTube コメントセクションのモックアップ
$cY = 80; $cX = 570; $cW = 650; $cH = 680
$cPath = Get-SquirclePath $cX $cY $cW $cH 18
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 20, 22, 32))), $cPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 45, 52, 70), 1.5)), $cPath)

$g.DrawString("Comments (1,248)", (New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($cX + 28), ($cY + 22))

# 通常コメント 1
$com1Y = $cY + 72
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 75, 85, 99))), ($cX + 28), $com1Y, 38, 38)
$g.DrawString("@user-classic", (New-Object System.Drawing.Font "Segoe UI", 10.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($cX + 78), $com1Y)
$g.DrawString("Great video as always! Thanks for sharing this performance.", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 156, 163, 175))), ($cX + 78), ($com1Y + 24))

# ハイライト対象コメント (ゴールド枠線 + グロー背景)
$highY = $cY + 165
$highPath = Get-SquirclePath ($cX + 18) $highY ($cW - 36) 145 14
$highBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle ($cX + 18), $highY, ($cW - 36), 145), ([System.Drawing.Color]::FromArgb(70, 124, 58, 237)), ([System.Drawing.Color]::FromArgb(45, 245, 158, 11)), 45.0
$g.FillPath($highBg, $highPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 245, 158, 11), 2.5)), $highPath)

# 該当コメントバッジ "★ JUMPED COMMENT"
$tagPathH = Get-SquirclePath ($cX + $cW - 195) ($highY + 14) 160 24 6
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), $tagPathH)
$g.DrawString("TARGET COMMENT", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))), ($cX + $cW - 115), ($highY + 26), $sfTs)

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), ($cX + 36), ($highY + 18), 42, 42)
$g.DrawString("K", (New-Object System.Drawing.Font "Segoe UI", 14, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($cX + 49), ($highY + 26))

$g.DrawString("Kenji_Live", (New-Object System.Drawing.Font "Segoe UI", 11.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($cX + 90), ($highY + 18))

$tsHighPath = Get-SquirclePath ($cX + 190) ($highY + 17) 58 22 6
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), $tsHighPath)
$g.DrawString("04:12", (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))), ($cX + 219), ($highY + 28), $sfTs)

$g.DrawString("このソロパートの入り方が最高！！何度聴いても鳥肌立つ", (New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($cX + 90), ($highY + 48))
$g.DrawString("LIKES: 342   |   REPLY", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))), ($cX + 90), ($highY + 84))

# 通常コメント 2 & 3
$com2Y = $cY + 340
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 75, 85, 99))), ($cX + 28), $com2Y, 38, 38)
$g.DrawString("@soundlover", (New-Object System.Drawing.Font "Segoe UI", 10.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($cX + 78), $com2Y)
$g.DrawString("Sound mixing is so clean in this upload. Studio quality!", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 156, 163, 175))), ($cX + 78), ($com2Y + 24))

$com3Y = $cY + 440
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 75, 85, 99))), ($cX + 28), $com3Y, 38, 38)
$g.DrawString("@music_fan_99", (New-Object System.Drawing.Font "Segoe UI", 10.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($cX + 78), $com3Y)
$g.DrawString("Can we appreciate the drummer too? Keeping tight rhythm throughout.", (New-Object System.Drawing.Font "Segoe UI", 10, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 156, 163, 175))), ($cX + 78), ($com3Y + 24))

$g.Dispose()
Save-ImageToBothDirs $bmpScreen3 "screenshot-3-1280x800.png"
$bmpScreen3.Dispose()

# -------------------------------------------------------------
# 6. スクリーンショット 4 (1280 x 800) - 流れるコメントモード (Flow Mode) & ライブ配信
# -------------------------------------------------------------
Write-Host "Creating screenshot 4 (1280 x 800)..."
$bmpScreen4 = New-Object System.Drawing.Bitmap 1280, 800, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmpScreen4)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$g.Clear([System.Drawing.Color]::FromArgb(255, 13, 14, 20))

# 上部ナビバー
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 17, 24))), 0, 0, 1280, 56)
$g.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 38, 42, 54), 1)), 0, 56, 1280, 56)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 0, 0))), 28, 18, 28, 20)
$g.DrawString("YouTube Live", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 62, 16)

# メイン動画プレイヤー (Flow Mode 弾幕コメント画面)
$fvpX = 28; $fvpY = 74; $fvpW = 860; $fvpH = 484
$fvpRect = New-Object System.Drawing.Rectangle $fvpX, $fvpY, $fvpW, $fvpH
$fvpBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $fvpRect, ([System.Drawing.Color]::FromArgb(255, 12, 16, 32)), ([System.Drawing.Color]::FromArgb(255, 26, 20, 56)), 45.0
$g.FillRectangle($fvpBrush, $fvpRect)
$fvpBrush.Dispose()

# ステージ照明
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 147, 51, 234))), ($fvpX + 120), ($fvpY + 80), 300, 260)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 59, 130, 246))), ($fvpX + 320), ($fvpY + 100), 280, 240)

# 流れる弾幕コメント群 (Flow Mode)
$flowComments = @(
    @{ text = "きたああああああああ！"; x = $fvpX + 540; y = $fvpY + 40; size = 18; color = [System.Drawing.Color]::White },
    @{ text = "888888888888888888"; x = $fvpX + 220; y = $fvpY + 85; size = 16; color = [System.Drawing.Color]::FromArgb(255, 254, 240, 138) },
    @{ text = "This live stream is incredible!! ★"; x = $fvpX + 410; y = $fvpY + 130; size = 17; color = [System.Drawing.Color]::White },
    @{ text = "草草草"; x = $fvpX + 130; y = $fvpY + 175; size = 15; color = [System.Drawing.Color]::FromArgb(255, 134, 239, 172) },
    @{ text = "最高の演出すぎる..."; x = $fvpX + 360; y = $fvpY + 220; size = 19; color = [System.Drawing.Color]::FromArgb(255, 192, 132, 252) },
    @{ text = "Greetings from Brazil! (*^▽^*)"; x = $fvpX + 200; y = $fvpY + 270; size = 16; color = [System.Drawing.Color]::White },
    @{ text = "音響クオリティ高すぎ！"; x = $fvpX + 500; y = $fvpY + 315; size = 17; color = [System.Drawing.Color]::FromArgb(255, 254, 215, 170) },
    @{ text = "LETS GOOOOOOO"; x = $fvpX + 150; y = $fvpY + 360; size = 18; color = [System.Drawing.Color]::FromArgb(255, 239, 68, 68) },
    @{ text = "神回確定"; x = $fvpX + 460; y = $fvpY + 400; size = 16; color = [System.Drawing.Color]::White }
)

foreach ($fc in $flowComments) {
    # 縁取りシャドウ効果
    $fFont = New-Object System.Drawing.Font "Segoe UI", $fc.size, ([System.Drawing.FontStyle]::Bold)
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 0, 0, 0))
    $textBrush = New-Object System.Drawing.SolidBrush $fc.color
    
    $g.DrawString($fc.text, $fFont, $shadowBrush, ($fc.x + 2), ($fc.y + 2))
    $g.DrawString($fc.text, $fFont, $textBrush, $fc.x, $fc.y)
}

# プレイヤーコントロールバー (LIVE 表示)
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 0, 0, 0))), $fvpX, ($fvpY + $fvpH - 46), $fvpW, 46)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 239, 68, 68))), ($fvpX + 24), ($fvpY + $fvpH - 30), 12, 12)
$g.DrawString("LIVE", (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($fvpX + 42), ($fvpY + $fvpH - 32))

# コントロールバー右端の TimeBubble アイコン
$g.DrawImage($iconImg, ($fvpX + $fvpW - 130), ($fvpY + $fvpH - 38), 28, 28)

# 動画タイトル
$g.DrawString("World Championship Final 2026 - Live Arena Showcase", (New-Object System.Drawing.Font "Segoe UI", 16, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), $fvpX, ($fvpY + $fvpH + 14))

# 下部フィーチャーバナー
$flowBannerPath = Get-SquirclePath $fvpX ($fvpY + $fvpH + 54) 860 160 14
$flowBannerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle $fvpX, ($fvpY + $fvpH + 54), 860, 160), ([System.Drawing.Color]::FromArgb(230, 20, 24, 44)), ([System.Drawing.Color]::FromArgb(230, 38, 26, 68)), 0.0
$g.FillPath($flowBannerBrush, $flowBannerPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(100, 147, 51, 234), 1.5)), $flowBannerPath)

$g.DrawImage($iconImg, ($fvpX + 24), ($fvpY + $fvpH + 80), 80, 80)
$g.DrawString("Flow Mode & Live Chat Support (YouTube & Twitch)", (New-Object System.Drawing.Font "Segoe UI", 16, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($fvpX + 120), ($fvpY + $fvpH + 76))
$g.DrawString("Experience comments floating across your screen like bullet chat." + [Environment]::NewLine + "Works seamlessly on YouTube Live Chat Replays and Twitch Live Streams." + [Environment]::NewLine + "Enjoy zero-lag live interaction without looking away from the action.", (New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))), ($fvpX + 120), ($fvpY + $fvpH + 110))

# 右側: ライブチャット欄モック
$chatX = 915; $chatY = 74; $chatW = 335; $chatH = 680
$chatPath = Get-SquirclePath $chatX $chatY $chatW $chatH 16
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 20, 22, 32))), $chatPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 45, 52, 70), 1.5)), $chatPath)

$g.DrawString("Top Chat (Replay)", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), ($chatX + 20), ($chatY + 18))

# チャットメッセージアイテム群
$chatMockData = @(
    @{ user = "Alex_99"; time = "04:10"; msg = "LETS GOOOOOOO" },
    @{ user = "Taro_Live"; time = "04:11"; msg = "音響クオリティ高すぎ！" },
    @{ user = "Sakura_M"; time = "04:12"; msg = "神回確定" },
    @{ user = "Lucas_B"; time = "04:12"; msg = "Greetings from Brazil! (*^▽^*)" },
    @{ text = "888888888888888888"; user = "Kenta_01"; time = "04:13"; msg = "888888888888888888" },
    @{ user = "Sarah_K"; time = "04:14"; msg = "This live stream is incredible!! ★" },
    @{ user = "Hana_Tokyo"; time = "04:14"; msg = "最高の演出すぎる..." }
)

$cy = $chatY + 60
foreach ($cmd in $chatMockData) {
    $g.DrawString($cmd.time, (New-Object System.Drawing.Font "Segoe UI", 8.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 140, 150, 170))), ($chatX + 18), $cy)
    $g.DrawString($cmd.user, (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))), ($chatX + 60), $cy)
    $g.DrawString($cmd.msg, (New-Object System.Drawing.Font "Segoe UI", 9.5, ([System.Drawing.FontStyle]::Regular)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))), ($chatX + 18), ($cy + 20))
    $cy += 54
}

$g.Dispose()
Save-ImageToBothDirs $bmpScreen4 "screenshot-4-1280x800.png"
$bmpScreen4.Dispose()

$iconImg.Dispose()
`;

const tempPs1 = path.resolve(__dirname, 'temp_gen_promo.ps1');
try {
  fs.writeFileSync(tempPs1, '\uFEFF' + psScript, 'utf8');
  execSync(`powershell -ExecutionPolicy Bypass -File "${tempPs1}"`, { stdio: 'inherit' });
  console.log('\n🎉 All store assets and promotional screenshots generated successfully!');
} finally {
  if (fs.existsSync(tempPs1)) {
    fs.unlinkSync(tempPs1);
  }
}
