# Average RGB per cell of the reference map image. Output: JSON {w,h,rgb:[r,g,b,...]}
param([string]$Image = "notes/attachments/peta-referensi.jpg", [int]$W = 128, [int]$H = 96, [string]$Out = "tools/map-rgb.json")
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap (Resolve-Path $Image).Path
$small = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($small)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
$g.DrawImage($bmp, 0, 0, $W, $H)
$vals = New-Object System.Collections.Generic.List[int]
for ($y = 0; $y -lt $H; $y++) { for ($x = 0; $x -lt $W; $x++) { $c = $small.GetPixel($x, $y); $vals.Add($c.R); $vals.Add($c.G); $vals.Add($c.B) } }
$json = '{"w":' + $W + ',"h":' + $H + ',"rgb":[' + ($vals -join ',') + ']}'
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $Out), $json)
"ok $W x $H"
