$PackageDir = Split-Path $PSScriptRoot -Parent
$MockDir    = Join-Path $PSScriptRoot "mock"
$RunDir     = Join-Path $PSScriptRoot "run"
$Cli        = Join-Path $PackageDir "dist\cli.mjs"

$Show          = @()
$IndentierArgs = @()

$i = 0
while ($i -lt $args.Count) {
    if ($args[$i] -eq '--show') {
        $i++
        if ($i -lt $args.Count) { $Show += $args[$i] }
    } else {
        $IndentierArgs += $args[$i]
    }
    $i++
}

if (Test-Path $RunDir) { Remove-Item $RunDir -Recurse -Force }
Copy-Item $MockDir $RunDir -Recurse
Write-Host "Copied mock/ -> run/" -ForegroundColor Cyan

$cmdArgs = @("$Cli", '--write', '.') + $IndentierArgs
Write-Host "Running: node $($cmdArgs -join ' ')  (cwd: $RunDir)" -ForegroundColor Cyan
Push-Location $RunDir
& node @cmdArgs
Pop-Location

$filesToShow = if ($Show.Count -gt 0) {
    $Show | ForEach-Object { Join-Path $RunDir $_ }
} else {
    Get-ChildItem $RunDir -File | Sort-Object Name | Select-Object -ExpandProperty FullName
}

foreach ($f in $filesToShow) {
    if (Test-Path $f) {
        $rel = $f.Substring($PackageDir.Length).TrimStart('\', '/')
        Write-Host "`n--- $rel ---" -ForegroundColor Yellow
        Get-Content $f
    } else {
        Write-Host "Not found: $f" -ForegroundColor Red
    }
}
