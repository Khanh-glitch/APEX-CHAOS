# APEX CHAOS P0 diagnosis bootstrap. Does not alter the installed game or browser profile.
# Windows PowerShell 5.1+; administrator rights not needed.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$base = $PSScriptRoot
$zipName = 'APEX-CHAOS-P0-Diagnosis-44ba89c-fixed.zip'
$zip = Join-Path $base $zipName
$expectedZipSha = '8fbf345eee46f6f7a1eb460ac99ad31f38a9e062a822d6de103129362399fec8'
$expectedZipBytes = 74027901L
$expectedGameSha = '44ba89c1f0d36422c1b08412dfeeb66863662a1c'
$nodeSha = '33b1bc1a8aca11fd5a4f2699e51019c63c0af30cf437701d07af69be7706771b'

function Say([string]$msg) { Write-Host ('[APEX CHAOS] ' + $msg) }
function FileHash([string]$p) { return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }

Say 'Step 1/4 - verifying diagnosis files'
$partsDir = Join-Path $base 'parts'
if (-not (Test-Path -LiteralPath $partsDir -PathType Container)) {
  throw 'The parts/ folder is missing. Extract the entire GitHub ZIP, not only START-HERE.cmd.'
}
$partFiles = @()
for ($i = 0; $i -lt 6; $i++) {
  $file = Join-Path $partsDir ('part-{0:D3}.bin' -f $i)
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw ('Missing ' + $file) }
  $partFiles += $file
}
$sizeSum = 0L
foreach ($part in $partFiles) { $sizeSum += (Get-Item -LiteralPath $part).Length }
if ($sizeSum -ne $expectedZipBytes) { throw ('Incomplete ZIP parts: ' + $sizeSum + ' bytes; expected ' + $expectedZipBytes) }

$zipOk = (Test-Path -LiteralPath $zip -PathType Leaf) -and
  ((Get-Item -LiteralPath $zip).Length -eq $expectedZipBytes)
if ($zipOk) { $zipOk = (FileHash $zip) -eq $expectedZipSha }
if (-not $zipOk) {
  Say 'Joining the six parts automatically...'
  $out = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  try {
    foreach ($part in $partFiles) {
      $inputFile = [System.IO.File]::OpenRead($part)
      try { $inputFile.CopyTo($out) } finally { $inputFile.Dispose() }
    }
  } finally { $out.Dispose() }
}
if ((Get-Item -LiteralPath $zip).Length -ne $expectedZipBytes -or (FileHash $zip) -ne $expectedZipSha) {
  throw 'ZIP SHA-256 mismatch. The download is incomplete or altered. Nothing will run.'
}
Say 'Package SHA-256 verified.'

Say 'Step 2/4 - extracting the diagnosis'
$ready = Join-Path $base 'READY-TO-RUN'
if (-not (Test-Path -LiteralPath $ready -PathType Container)) {
  New-Item -ItemType Directory -Path $ready | Out-Null
}
$launcher = Get-ChildItem -LiteralPath $ready -Filter RUN-DIAGNOSIS.cmd -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $launcher) {
  Expand-Archive -LiteralPath $zip -DestinationPath $ready -Force
  $launcher = Get-ChildItem -LiteralPath $ready -Filter RUN-DIAGNOSIS.cmd -Recurse -File | Select-Object -First 1
}
if (-not $launcher) { throw 'The verified archive contains no RUN-DIAGNOSIS.cmd.' }
$packageDir = $launcher.Directory.FullName
$gameReceipt = Join-Path $packageDir 'game\ITCH_GUEST_BUILD_SHA.txt'
$nodeScript = Join-Path $packageDir 'tools\p0diag\p0run.mjs'
if (-not (Test-Path -LiteralPath $gameReceipt)) { throw 'Game build receipt is missing from the package.' }
if (-not (Test-Path -LiteralPath $nodeScript)) { throw 'Diagnosis runner is missing from the package.' }
$actualGameSha = ([System.IO.File]::ReadAllText($gameReceipt)).Trim()
if ($actualGameSha -ne $expectedGameSha) { throw ('Incorrect game baseline: ' + $actualGameSha) }
Say ('Frozen game SHA verified: ' + $actualGameSha.Substring(0, 8))

Say 'Step 3/4 - preparing the local runtime'
$nodeDir = Join-Path $packageDir 'runtime'
$node = Join-Path $nodeDir 'node.exe'
$useNode = $null
if (Test-Path -LiteralPath $node -PathType Leaf) {
  if ((FileHash $node) -eq $nodeSha) { $useNode = $node }
  else { Remove-Item -LiteralPath $node -Force }
}
if (-not $useNode) {
  $installedNode = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($installedNode) {
    $version = (& $installedNode.Source --version)
    if ($LASTEXITCODE -eq 0 -and $version -match '^v(2[0-9]|[3-9][0-9])\.') {
      Say ('Using existing Node.js ' + $version)
      $useNode = $installedNode.Source
    }
  }
}
if (-not $useNode) {
  Say 'Downloading the official Windows Node.js runtime automatically...'
  New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $urls = @(
    'https://nodejs.org/dist/v22.14.0/win-x64/node.exe',
    'https://nodejs.org/download/release/v22.14.0/win-x64/node.exe'
  )
  $lastError = ''
  foreach ($uri in $urls) {
    try {
      Invoke-WebRequest -Uri $uri -OutFile $node -UseBasicParsing -TimeoutSec 120
      if ((FileHash $node) -ne $nodeSha) { throw 'Official Node.js checksum did not match.' }
      $useNode = $node
      break
    } catch {
      $lastError = $_.Exception.Message
      Remove-Item -LiteralPath $node -Force -ErrorAction SilentlyContinue
    }
  }
  if (-not $useNode) { throw ('Could not automatically download Node.js: ' + $lastError) }
  Say 'Official Node.js downloaded and SHA-256 verified.'
}

Say 'Step 4/4 - launching the real performance diagnosis'
Say 'A Chrome/Edge window will open and run the tests automatically. Do not interact with it.'
Push-Location $packageDir
try {
  & $useNode $nodeScript
  $exitCode = $LASTEXITCODE
} finally { Pop-Location }
$results = Join-Path $packageDir 'tools\p0diag\results'
$report = Join-Path $results 'p0-diagnosis-latest.json'
if (-not (Test-Path -LiteralPath $report -PathType Leaf)) {
  throw ('The run produced no report (exit code ' + $exitCode + '). Check Chrome/Edge availability.')
}
Say ('Report saved: ' + $report)
try { Start-Process -FilePath explorer.exe -ArgumentList ('"' + $results + '"') | Out-Null } catch { }
if ($exitCode -ne 0) {
  Say 'The runner exited with errors; the JSON report is still available for troubleshooting.'
  throw ('Diagnosis exited with code ' + $exitCode)
}
Say 'Completed. Send p0-diagnosis-latest.json in the opened folder.'
