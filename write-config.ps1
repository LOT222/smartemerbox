param(
  [Parameter(Mandatory = $true)][string]$SupabaseUrl,
  [Parameter(Mandatory = $true)][string]$AnonKey,
  [string]$VapidPublicKey = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$content = @"
window.SEB_SUPABASE_URL = "$SupabaseUrl";
window.SEB_SUPABASE_ANON_KEY = "$AnonKey";
window.SEB_VAPID_PUBLIC_KEY = "$VapidPublicKey";
"@
Set-Content -LiteralPath (Join-Path $root "public\config.js") -Value $content -Encoding UTF8
Write-Host "Updated public/config.js"
