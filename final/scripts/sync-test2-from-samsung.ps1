$ErrorActionPreference = 'Stop'
$loc = 'c:\Users\82104\Desktop\sam0523\mlp-prototype'
$sam = 'c:\Users\82104\Desktop\sam0523\samsung_test2'

function Read-Lines($path) {
  [System.IO.File]::ReadAllLines($path)
}

function Write-Lines($path, $lines) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($path, $lines, $utf8NoBom)
}

# 1) Core test2 JS (samsung exact)
Copy-Item "$sam\public\prototype-logic.js" "$loc\public\prototype-logic.js" -Force
Copy-Item "$sam\public\app\p2-galaxy-star.js" "$loc\public\app\p2-galaxy-star.js" -Force
Copy-Item "$sam\pages\test2.js" "$loc\pages\test2.js" -Force

# 2) p2-agent-fill-gl.js = samsung + local Test3MusicFillGL tail
$glSam = Read-Lines "$sam\public\app\p2-agent-fill-gl.js"
$glLoc = Read-Lines "$loc\public\app\p2-agent-fill-gl.js"
$test3Idx = -1
for ($i = 0; $i -lt $glLoc.Length; $i++) {
  if ($glLoc[$i] -match 'function Test3MusicFillGL') {
    $test3Idx = $i
    break
  }
}
if ($test3Idx -ge 0) {
  # Insert Test3MusicFillGL before the IIFE closing — not after })();
  $samText = [System.IO.File]::ReadAllText("$sam\public\app\p2-agent-fill-gl.js")
  $tail = ($glLoc[$test3Idx..($glLoc.Length - 1)] -join "`n")
  $samText = $samText -replace '\}\)\(\);\s*$', "`n$tail"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText("$loc\public\app\p2-agent-fill-gl.js", $samText.TrimEnd() + "`n", $utf8NoBom)
} else {
  Copy-Item "$sam\public\app\p2-agent-fill-gl.js" "$loc\public\app\p2-agent-fill-gl.js" -Force
}

# 3) theme-page.css: replace test2 block (keep test1 header + test3+ tail)
$cssLoc = Read-Lines "$loc\styles\theme-page.css"
$cssSam = Read-Lines "$sam\styles\theme-page.css"
$test2Start = -1
$test3StartLoc = -1
$test3StartSam = -1
for ($i = 0; $i -lt $cssLoc.Length; $i++) {
  if ($cssLoc[$i] -match 'test2 lock persona' -or ($cssLoc[$i] -match 'Persona2: loading crossfade' -and $test2Start -lt 0)) {
    if ($test2Start -lt 0 -and $cssLoc[$i] -match 'test2 lock persona') { $test2Start = $i }
  }
  if ($cssLoc[$i] -match 'test3 \(health home\): intro runner') { $test3StartLoc = $i; break }
}
for ($i = 0; $i -lt $cssSam.Length; $i++) {
  if ($cssSam[$i] -match 'test2 lock persona') { if ($test2StartSam -lt 0) { $test2StartSam = $i } }
  if ($cssSam[$i] -match 'test3 \(health home\): intro runner') { $test3StartSam = $i; break }
}
if ($test2StartSam -lt 0) { $test2StartSam = 284 }
if ($test3StartSam -lt 0) { throw 'samsung test3 marker not found' }
if ($test3StartLoc -lt 0) { throw 'local test3 marker not found' }
if ($test2Start -lt 0) { $test2Start = 284 }
$cssOut = @()
$cssOut += $cssLoc[0..($test2Start - 1)]
$cssOut += $cssSam[$test2StartSam..($test3StartSam - 1)]
$cssOut += $cssLoc[$test3StartLoc..($cssLoc.Length - 1)]
Write-Lines "$loc\styles\theme-page.css" $cssOut
Write-Host "theme-page.css test2 lines: $($test3StartSam - $test2StartSam) from samsung"

# 4) surface-layout.js: replace test2 helper region
$slLoc = Read-Lines "$loc\public\app\surface-layout.js"
$slSam = Read-Lines "$sam\public\app\surface-layout.js"
$startLoc = -1
$endLoc = -1
$startSam = -1
$endSam = -1
for ($i = 0; $i -lt $slLoc.Length; $i++) {
  if ($slLoc[$i] -eq 'function _isTest2Scope() {') { $startLoc = $i }
  if ($slLoc[$i] -eq 'var TEST1_INTRO_DELAY_MS = 1300;') { $endLoc = $i; break }
}
for ($i = 0; $i -lt $slSam.Length; $i++) {
  if ($slSam[$i] -eq 'function _isTest2Scope() {') { $startSam = $i }
  if ($slSam[$i] -eq 'window.generateSurfaceScenario = function generateSurfaceScenario(surfaceType) {') {
    if ($startSam -ge 0 -and $endSam -lt 0) { $endSam = $i }
  }
}
if ($startLoc -lt 0 -or $endLoc -lt 0 -or $startSam -lt 0 -or $endSam -lt 0) {
  throw "surface-layout markers missing startLoc=$startLoc endLoc=$endLoc startSam=$startSam endSam=$endSam"
}
$slOut = @()
$slOut += $slLoc[0..($startLoc - 1)]
$slOut += $slSam[$startSam..($endSam - 1)]
$slOut += $slLoc[$endLoc..($slLoc.Length - 1)]
Write-Lines "$loc\public\app\surface-layout.js" $slOut
Write-Host "surface-layout test2 region: samsung $($endSam - $startSam) lines"

# 5) lock-screen assets from samsung design + public
$lockSrc = "$sam\design\assets\figma\lock-screen"
$lockDst = "$loc\public\assets\figma\lock-screen"
if (Test-Path $lockSrc) {
  New-Item -ItemType Directory -Force -Path $lockDst | Out-Null
  Copy-Item "$lockSrc\*" $lockDst -Force -Recurse
}
Copy-Item "$sam\public\assets\figma\lock-screen\*" $lockDst -Force -ErrorAction SilentlyContinue
if (Test-Path "$loc\public\assets\test2\test2-wallpaper.png") {
  Copy-Item "$loc\public\assets\test2\test2-wallpaper.png" "$lockDst\lock-screen-wallpaper.png" -Force
}

Write-Host 'sync-test2-from-samsung.ps1 done'
