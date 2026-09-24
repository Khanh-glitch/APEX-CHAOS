#Requires -Version 2.0
# APEX CHAOS — Arsenal Quest playable Windows static server.
# Built-in PowerShell/.NET only. No Node/pnpm/npm/Python/Git/internet required.
# Serves .\app\ on a dynamically chosen free localhost port, cache disabled,
# opens the browser ONLY after the listener is up, prints the exact build SHA.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $root 'app'

if (-not (Test-Path (Join-Path $appDir 'index.html'))) {
  Write-Error "FATAL: app\index.html not found next to serve.ps1 ($appDir). Extract the full ZIP first."
  exit 1
}

$sha = 'unknown'
$shaFile = Join-Path $appDir 'ARSENAL_BUILD_SHA.txt'
if (Test-Path $shaFile) { $sha = (Get-Content $shaFile -TotalCount 1).Trim() }

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'
  '.webp' = 'image/webp'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.ogg'  = 'audio/ogg'; '.wav' = 'audio/wav'; '.mp3' = 'audio/mpeg'; '.opus' = 'audio/opus'
  '.txt'  = 'text/plain; charset=utf-8'; '.map' = 'application/json'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'
}

# Dynamically choose an actually free port (never a fixed one like 8765).
$listener = $null
$port = 0
$candidates = New-Object System.Collections.Generic.List[int]
# probe the OS for a free ephemeral port first, then fall back to random probes
try {
  $probe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
  $probe.Start()
  $candidates.Add($probe.LocalEndpoint.Port)
  $probe.Stop()
} catch { }
for ($i = 0; $i -lt 40; $i++) { $candidates.Add((Get-Random -Minimum 49200 -Maximum 65500)) }

foreach ($p in $candidates) {
  $try = New-Object System.Net.HttpListener
  $try.Prefixes.Add("http://localhost:$p/")
  try { $try.Start(); $listener = $try; $port = $p; break } catch { try { $try.Close() } catch { } }
}
if ($null -eq $listener) {
  Write-Error 'FATAL: could not bind any localhost port. Close other instances and retry.'
  exit 1
}

$url = "http://localhost:$port/?build=$sha"
Write-Host '=============================================================='
Write-Host ' APEX CHAOS — ARSENAL QUEST playable build (static server)'
Write-Host " Build SHA : $sha"
Write-Host " URL       : $url"
Write-Host ' Keep this window open while playing. Close it to stop.'
Write-Host '=============================================================='

# Open the browser only after the server is listening.
try { Start-Process $url } catch { Write-Host "Could not auto-open browser; visit $url manually." }

function Resolve-PathSafe([string]$rawUrl) {
  $p = [Uri]::UnescapeDataString(([System.Uri]$rawUrl).AbsolutePath)
  if ($p -eq '/' -or $p -eq '') { $p = '/index.html' }
  $full = [System.IO.Path]::GetFullPath((Join-Path $appDir $p.TrimStart('/')))
  $appFull = [System.IO.Path]::GetFullPath($appDir)
  if (-not $full.StartsWith($appFull)) { return $null }
  return $full
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $resp = $ctx.Response
      $resp.AddHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      $resp.AddHeader('Pragma', 'no-cache')
      $resp.AddHeader('Expires', '0')
      $file = Resolve-PathSafe $ctx.Request.RawUrl
      if ($null -eq $file -or -not (Test-Path $file -PathType Leaf)) {
        $resp.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 not found')
        $resp.ContentType = 'text/plain; charset=utf-8'
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $resp.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $data = [System.IO.File]::ReadAllBytes($file)
        $resp.StatusCode = 200
        $resp.OutputStream.Write($data, 0, $data.Length)
      }
      $resp.OutputStream.Close()
    } catch {
      try { $ctx.Response.StatusCode = 500; $ctx.Response.OutputStream.Close() } catch { }
    }
  }
} finally {
  try { $listener.Stop(); $listener.Close() } catch { }
  Write-Host 'Server stopped.'
}
