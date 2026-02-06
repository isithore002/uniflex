$ErrorActionPreference = "Stop"

# Foundry executables
$cast = Join-Path $env:USERPROFILE ".foundry\bin\cast.exe"

Write-Host ""
Write-Host "===================================" -ForegroundColor Magenta
Write-Host " ATTACKER WALLET SETUP" -ForegroundColor Magenta
Write-Host "===================================" -ForegroundColor Magenta
Write-Host ""

# Change to contracts directory
Set-Location H:\uniflex\uniflux\contracts

# Load environment from .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)\s*=\s*(.*)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            New-Item -Path env: -Name $key -Value $val -Force | Out-Null
        }
    }
}

# Check if attacker key exists
if ($env:ATTACKER_PRIVATE_KEY) {
    Write-Host "[INFO] ATTACKER_PRIVATE_KEY already exists" -ForegroundColor Yellow
    
    $attackerAddr = & $cast wallet address --private-key $env:ATTACKER_PRIVATE_KEY
    Write-Host "[OK] Attacker address: $attackerAddr" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "[STEP] Checking balances..." -ForegroundColor Cyan
    $ethBal = & $cast balance $attackerAddr --rpc-url https://sepolia.unichain.org
    Write-Host "  ETH: $ethBal wei" -ForegroundColor White
    
    if ($env:TOKEN_A_ADDRESS) {
        $t0Bal = & $cast call $env:TOKEN_A_ADDRESS "balanceOf(address)(uint256)" $attackerAddr --rpc-url https://sepolia.unichain.org
        Write-Host "  Token0 (mUSDC): $t0Bal" -ForegroundColor White
    }
    
    if ($env:TOKEN_B_ADDRESS) {
        $t1Bal = & $cast call $env:TOKEN_B_ADDRESS "balanceOf(address)(uint256)" $attackerAddr --rpc-url https://sepolia.unichain.org
        Write-Host "  Token1 (mETH): $t1Bal" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "[OK] Wallet ready if balances sufficient" -ForegroundColor Green
    Write-Host ""
    Write-Host "Required: 0.01 ETH + 0.5 token0" -ForegroundColor Cyan
    exit 0
}

# Generate new wallet
Write-Host "[STEP] Generating new attacker wallet..." -ForegroundColor Cyan
Write-Host ""

$walletOutput = & $cast wallet new 2>&1 | Out-String
$addrMatch = [regex]::Match($walletOutput, "Address:\s*(0x[a-fA-F0-9]{40})")
$pkMatch = [regex]::Match($walletOutput, "Private key:\s*(0x[a-fA-F0-9]{64})")

if ($addrMatch.Success -and $pkMatch.Success) {
    $addr = $addrMatch.Groups[1].Value
    $pk = $pkMatch.Groups[1].Value
    
    Write-Host "===================================" -ForegroundColor Yellow
    Write-Host " NEW WALLET" -ForegroundColor Yellow
    Write-Host "===================================" -ForegroundColor Yellow
    Write-Host "Address:     $addr" -ForegroundColor White
    Write-Host "Private Key: $pk" -ForegroundColor White
    Write-Host "===================================" -ForegroundColor Yellow
    Write-Host ""
    
    # Add to .env
    Add-Content -Path .env -Value "`nATTACKER_PRIVATE_KEY=$pk"
    Write-Host "[OK] Added to .env" -ForegroundColor Green
    Write-Host ""
    
    # Funding instructions
    Write-Host "===================================" -ForegroundColor Cyan
    Write-Host " FUNDING REQUIRED" -ForegroundColor Cyan
    Write-Host "===================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Get Unichain Sepolia ETH" -ForegroundColor White
    Write-Host "   https://www.alchemy.com/faucets/unichain-sepolia" -ForegroundColor Gray
    Write-Host "   Amount: 0.01 ETH" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Mint tokens (run these commands):" -ForegroundColor White
    Write-Host ""
    
    if ($env:TOKEN_A_ADDRESS -and $env:PRIVATE_KEY) {
        Write-Host "# Mint mUSDC" -ForegroundColor Yellow
        Write-Host "$cast send $($env:TOKEN_A_ADDRESS) ""mint(address,uint256)"" $addr 1000000000000000000 --private-key `$env:PRIVATE_KEY --rpc-url https://sepolia.unichain.org" -ForegroundColor White
        Write-Host ""
    }
    
    if ($env:TOKEN_B_ADDRESS -and $env:PRIVATE_KEY) {
        Write-Host "# Mint mETH" -ForegroundColor Yellow
        Write-Host "$cast send $($env:TOKEN_B_ADDRESS) ""mint(address,uint256)"" $addr 1000000000000000000 --private-key `$env:PRIVATE_KEY --rpc-url https://sepolia.unichain.org" -ForegroundColor White
        Write-Host ""
    }
    
    Write-Host "3. Run simulation:" -ForegroundColor White
    Write-Host "   .\script\run-sandwich-simulation.ps1" -ForegroundColor Cyan
    Write-Host ""
    
} else {
    Write-Host "[ERROR] Failed to parse wallet" -ForegroundColor Red
    Write-Host $walletOutput
    exit 1
}
