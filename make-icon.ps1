Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(255, 15, 23, 42))

# Rounded background
$radius = 48
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$d = $radius * 2
$path.AddArc(0, 0, $d, $d, 180, 90)
$path.AddArc($size - $d, 0, $d, $d, 270, 90)
$path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
$path.AddArc(0, $size - $d, $d, $d, 90, 90)
$path.CloseFigure()
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($size, $size)),
    [System.Drawing.Color]::FromArgb(255, 79, 70, 229),
    [System.Drawing.Color]::FromArgb(255, 124, 58, 237))
$g.FillPath($bgBrush, $path)

$white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
$dark = [System.Drawing.Color]::FromArgb(255, 30, 27, 75)
$soft = [System.Drawing.Color]::FromArgb(255, 226, 232, 240)

# Awning (striped top bar)
$awningBrush = New-Object System.Drawing.SolidBrush $white
$g.FillRectangle($awningBrush, 40, 48, 176, 56)
$stripeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 199, 210, 254))
for ($x = 48; $x -lt 216; $x += 24) {
    $g.FillRectangle($stripeBrush, $x, 48, 12, 56)
}
# awning scallops
$scallopBrush = New-Object System.Drawing.SolidBrush $white
for ($x = 40; $x -lt 216; $x += 24) {
    $g.FillEllipse($scallopBrush, $x, 96, 24, 16)
}

# Shop front body
$frontBrush = New-Object System.Drawing.SolidBrush $soft
$g.FillRectangle($frontBrush, 52, 116, 152, 92)

# Door
$doorBrush = New-Object System.Drawing.SolidBrush $white
$g.FillRectangle($doorBrush, 104, 144, 48, 64)
$doorFrame = New-Object System.Drawing.Pen $dark, 4
$g.DrawRectangle($doorFrame, 104, 144, 48, 64)
$knobBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 79, 70, 229))
$g.FillEllipse($knobBrush, 137, 172, 8, 8)

# Window
$winBrush = New-Object System.Drawing.SolidBrush $dark
$g.FillRectangle($winBrush, 62, 128, 32, 28)
$g.FillRectangle($winBrush, 162, 128, 32, 28)
$winLine = New-Object System.Drawing.Pen $soft, 3
$g.DrawLine($winLine, 78, 128, 78, 156)
$g.DrawLine($winLine, 178, 128, 178, 156)

$g.Dispose()

$pngPath = Join-Path $env:TEMP "shop-icon.png"
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Wrap PNG in an ICO file (Vista+ supports PNG-compressed icons)
$pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
$icoPath = Join-Path $PSScriptRoot "shop.ico"
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]1)
$bw.Write([Byte]0)      # width 0 = 256
$bw.Write([Byte]0)      # height 0 = 256
$bw.Write([Byte]0)      # colors
$bw.Write([Byte]0)      # reserved
$bw.Write([UInt16]1)    # planes
$bw.Write([UInt16]32)   # bpp
$bw.Write([UInt32]$pngBytes.Length)
$bw.Write([UInt32]22)   # offset = 6 + 16
$bw.Write($pngBytes)
$bw.Flush()
$bw.Close()
$fs.Close()

Write-Output "Icon created: $icoPath"
