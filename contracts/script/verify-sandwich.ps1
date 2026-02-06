# MEV Sandwich Verification Script
# Analyzes the three-transaction sandwich pattern on Unichain Sepolia

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host " MEV SANDWICH VERIFICATION" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host ""

$cast = Join-Path $env:USERPROFILE ".foundry\bin\cast.exe"
$rpc = "https://sepolia.unichain.org"

# Transaction hashes from simulation
$frontrunTx = "0xa5458ebedc6893fff8b704875cfb00862a0f45a95fedd42fa239aa615c3f41a5"
$victimTx = "0xbd6c79025e88c35497e832823f27813a8f30f833c00fe1c4ff39d2f73479ec0c"
$backrunTx = "0xbce8cf85b346bd210df9dcf0991f078e8039492d7cc52a1613bc77b3b9768481"

$attacker = "0x32c100A22d5F463F804221e01673Da6eB19d1181"
$victim = "0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903"

Write-Host "[1/3] Fetching FRONTRUN transaction..." -ForegroundColor Cyan
$frontrun = & $cast tx $frontrunTx --rpc-url $rpc --json | ConvertFrom-Json
Write-Host "  Block: $($frontrun.blockNumber)" -ForegroundColor White
Write-Host "  From:  $($frontrun.from)" -ForegroundColor White
Write-Host "  Gas:   $($frontrun.gasUsed)" -ForegroundColor White
Write-Host ""

Write-Host "[2/3] Fetching VICTIM transaction..." -ForegroundColor Cyan
$victimData = & $cast tx $victimTx --rpc-url $rpc --json | ConvertFrom-Json
Write-Host "  Block: $($victimData.blockNumber)" -ForegroundColor White
Write-Host "  From:  $($victimData.from)" -ForegroundColor White
Write-Host "  Gas:   $($victimData.gasUsed)" -ForegroundColor White
Write-Host ""

Write-Host "[3/3] Fetching BACKRUN transaction..." -ForegroundColor Cyan
$backrun = & $cast tx $backrunTx --rpc-url $rpc --json | ConvertFrom-Json
Write-Host "  Block: $($backrun.blockNumber)" -ForegroundColor White
Write-Host "  From:  $($backrun.from)" -ForegroundColor White
Write-Host "  Gas:   $($backrun.gasUsed)" -ForegroundColor White
Write-Host ""

Write-Host "=============================================" -ForegroundColor Green
Write-Host " SANDWICH PATTERN ANALYSIS" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Check pattern
$sameAttacker = ($frontrun.from -eq $backrun.from)
$differentVictim = ($frontrun.from -ne $victimData.from)
$blockWindow = [int]$backrun.blockNumber - [int]$frontrun.blockNumber

Write-Host "Pattern Checks:" -ForegroundColor Yellow
Write-Host "  [$(if($sameAttacker){'PASS'}else{'FAIL'})] Same attacker in frontrun & backrun" -ForegroundColor $(if($sameAttacker){'Green'}else{'Red'})
Write-Host "  [$(if($differentVictim){'PASS'}else{'FAIL'})] Different victim address" -ForegroundColor $(if($differentVictim){'Green'}else{'Red'})
Write-Host "  [$(if($blockWindow -lt 100){'PASS'}else{'WARN'})] Time window: $blockWindow blocks" -ForegroundColor $(if($blockWindow -lt 100){'Green'}else{'Yellow'})
Write-Host ""

Write-Host "Wallet Verification:" -ForegroundColor Yellow
Write-Host "  Attacker: $attacker" -ForegroundColor White
Write-Host "  Victim:   $victim" -ForegroundColor White
Write-Host ""

if ($sameAttacker -and $differentVictim) {
    Write-Host "[SUCCESS] Valid sandwich pattern detected!" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Pattern mismatch" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " EXPLORER LINKS" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontrun: https://sepolia.uniscan.xyz/tx/$frontrunTx" -ForegroundColor Gray
Write-Host "Victim:   https://sepolia.uniscan.xyz/tx/$victimTx" -ForegroundColor Gray
Write-Host "Backrun:  https://sepolia.uniscan.xyz/tx/$backrunTx" -ForegroundColor Gray
Write-Host ""
Write-Host "Attacker Wallet: https://sepolia.uniscan.xyz/address/$attacker" -ForegroundColor Gray
Write-Host "Victim Wallet:   https://sepolia.uniscan.xyz/address/$victim" -ForegroundColor Gray
Write-Host ""
