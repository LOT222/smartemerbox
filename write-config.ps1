param(
  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$AnonKey
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$content = @"
window.SEB_SUPABASE_URL = "$SupabaseUrl";
window.SEB_SUPABASE_ANON_KEY = "$AnonKey";
"@

Set-Content -LiteralPath (Join-Path $root "config.js") -Value $content -Encoding UTF8
Set-Content -LiteralPath (Join-Path $root "public\config.js") -Value $content -Encoding UTF8
Write-Host "Updated config.js and public/config.js"

