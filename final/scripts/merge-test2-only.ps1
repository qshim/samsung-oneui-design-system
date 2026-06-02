# Merge samsung_test2 test2 ONLY — never touch test3/test1 blocks.
$ErrorActionPreference = 'Stop'
$loc = 'c:\Users\82104\Desktop\sam0523\mlp-prototype'
$sam = 'c:\Users\82104\Desktop\sam0523\samsung_test2'

function Read-Lines($path) { [System.IO.File]::ReadAllLines($path) }
function Write-Lines($path, $lines) {
  $enc = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($path, $lines, $enc)
}

# --- p2-galaxy-star.js (test2 only asset) ---
Copy-Item "$sam\public\app\p2-galaxy-star.js" "$loc\public\app\p2-galaxy-star.js" -Force

# --- p2-agent-fill-gl.js: samsung P2 + local Test3MusicFillGL inside same IIFE ---
$glSam = [System.IO.File]::ReadAllText("$sam\public\app\p2-agent-fill-gl.js")
$glLoc = Read-Lines "$loc\public\app\p2-agent-fill-gl.js"
$test3Idx = -1
for ($i = 0; $i -lt $glLoc.Length; $i++) {
  if ($glLoc[$i] -match '^\s*function Test3MusicFillGL\(\)') { $test3Idx = $i; break }
}
if ($test3Idx -lt 0) { throw 'Test3MusicFillGL block not found in local p2-agent-fill-gl.js' }
$tail = ($glLoc[$test3Idx..($glLoc.Length - 1)] -join "`n").TrimEnd()
$merged = ($glSam.TrimEnd() -replace '\}\)\(\);\s*$', "`n$tail`n})();")
$merged = $merged -replace '\}\)\(\);\s*\}\)\(\);\s*$', '})();'
$enc = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("$loc\public\app\p2-agent-fill-gl.js", $merged + "`n", $enc)
Write-Host 'p2-agent-fill-gl.js: samsung P2 + local Test3'

# --- prototype-logic.js (test2 motion; no test3 refs in either repo) ---
Copy-Item "$sam\public\prototype-logic.js" "$loc\public\prototype-logic.js" -Force

# --- theme-page.css: replace test2 block only (284..2344 -> samsung 285..3187) ---
$cssLoc = Read-Lines "$loc\styles\theme-page.css"
$cssSam = Read-Lines "$sam\styles\theme-page.css"
$test3StartLoc = -1
for ($i = 0; $i -lt $cssLoc.Length; $i++) {
  if ($cssLoc[$i] -match 'test3 . mobile phone canvas wallpaper') { $test3StartLoc = $i; break }
}
$test3StartSam = -1
for ($i = 0; $i -lt $cssSam.Length; $i++) {
  if ($cssSam[$i] -match 'test3 \(health home\): intro runner') { $test3StartSam = $i; break }
}
if ($test3StartLoc -lt 0 -or $test3StartSam -lt 0) { throw 'test3 CSS marker missing' }
$test2StartLoc = 283   # 0-based line before first test2 rule (line 284)
$test2StartSam = 284   # samsung line 285 comment
$cssOut = @()
$cssOut += $cssLoc[0..$test2StartLoc]
$cssOut += $cssSam[$test2StartSam..($test3StartSam - 1)]
$cssOut += $cssLoc[$test3StartLoc..($cssLoc.Length - 1)]
Write-Lines "$loc\styles\theme-page.css" $cssOut
Write-Host "theme-page.css: inserted $($test3StartSam - $test2StartSam) samsung test2 lines"

# User wallpaper override in test2 ::before
$cssText = [System.IO.File]::ReadAllText("$loc\styles\theme-page.css")
$cssText = $cssText -replace "url\('/assets/figma/lock-screen/lock-screen-wallpaper\.png'\)", "url('/assets/test2/test2-wallpaper.png?v=2')"
$cssText = $cssText -replace "url\(""/assets/figma/lock-screen/lock-screen-wallpaper\.png""\)", "url('/assets/test2/test2-wallpaper.png?v=2')"
[System.IO.File]::WriteAllText("$loc\styles\theme-page.css", $cssText, $enc)

# surface-layout.js: NEVER splice large regions (renderAtomicForRole contains test3).
# Patch persona2-widgets + galaxy star helpers via StrReplace in merge-test2-only.ps1
# or run this script after `git checkout HEAD -- public/app/surface-layout.js`.
Write-Host 'surface-layout.js: skipped bulk splice (test3 safety)'

# persona2-widgets test2 HTML (samsung structure)
$slText = [System.IO.File]::ReadAllText("$loc\public\app\surface-layout.js")
$samCase = [System.IO.File]::ReadAllText("$sam\public\app\surface-layout.js")
$marker = "    case 'persona2-widgets':"
$locIdx = $slText.IndexOf($marker)
$samIdx = $samCase.IndexOf($marker)
if ($locIdx -lt 0 -or $samIdx -lt 0) { throw 'persona2-widgets case not found' }
$locTest2 = $slText.IndexOf("if (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2')", $locIdx)
$locEnd = $slText.IndexOf("      return '<div class=`"p2-widgets`" style=`"position:relative; width: 100%; height: 450px;`">'", $locTest2)
$samTest2 = $samCase.IndexOf("if (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2')", $samIdx)
$samEnd = $samCase.IndexOf("      return '<div class=`"p2-widgets`" style=`"position:relative; width: 100%; height: 450px;`">'", $samTest2)
$samBlock = $samCase.Substring($samTest2, $samEnd - $samTest2)
$slText = $slText.Substring(0, $locTest2) + $samBlock + $slText.Substring($locEnd)
[System.IO.File]::WriteAllText("$loc\public\app\surface-layout.js", $slText, $enc)

# generateSurfaceScenario: add installTest2GalaxyStar for test2
$slText = [System.IO.File]::ReadAllText("$loc\public\app\surface-layout.js")
if ($slText -notmatch 'installTest2GalaxyStar\(canvas\)') {
  $slText = $slText -replace "(if \(testScope === 'test2'\) \{\s*try \{\s*installTest2P2TransitionBridge\(canvas\);)", "`$1`n      installTest2GalaxyStar(canvas);"
  [System.IO.File]::WriteAllText("$loc\public\app\surface-layout.js", $slText, $enc)
}

Write-Host 'merge-test2-only.ps1 done'
