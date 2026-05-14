# testplay/test.ps1
# mock/ をコピーして run/ に対して indentier を実行するテストスクリプト
#
# 使い方:
#   .\testplay\test.ps1                          # default モード、全ファイル表示
#   .\testplay\test.ps1 --mode=ruby              # ruby モード
#   .\testplay\test.ps1 --show sample.ts         # 特定ファイルの結果のみ表示
#
# --show <file> は複数指定可。省略時は全ファイルを表示。
# それ以外の引数はすべて indentier にそのまま渡される。
#
# 前提: pnpm build を実行して dist/ を生成しておくこと。

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

# --- run/ をリフレッシュ ---
if (Test-Path $RunDir) { Remove-Item $RunDir -Recurse -Force }
Copy-Item $MockDir $RunDir -Recurse
Write-Host "Copied mock/ -> run/" -ForegroundColor Cyan

# --- indentier 実行 (RunDir から実行して相対パスを使う) ---
$cmdArgs = @("$Cli", '--write', '.') + $IndentierArgs
Write-Host "Running: node $($cmdArgs -join ' ')  (cwd: $RunDir)" -ForegroundColor Cyan
Push-Location $RunDir
& node @cmdArgs
Pop-Location

# --- 結果表示 ---
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