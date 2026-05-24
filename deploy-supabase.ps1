param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRef,

    [Parameter(Mandatory = $true)]
    [string]$PublicSiteUrl
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw "npx command not found: Please check your Node.js installation."
}

Write-Host "Linking Supabase project $ProjectRef ..."
& npx supabase link --project-ref $ProjectRef

Write-Host "Applying database schema ..."
& npx supabase db push

Write-Host "Setting Edge Function secret PUBLIC_SITE_URL ..."
& npx supabase secrets set "PUBLIC_SITE_URL=$PublicSiteUrl"

Write-Host "Deploying Edge Function api ..."
& npx supabase functions deploy api --no-verify-jwt

Write-Host ""
Write-Host "Done."
Write-Host "API URL: https://$ProjectRef.supabase.co/functions/v1/api"
Write-Host "Next: run .\write-config.ps1 with your Supabase URL and anon key."