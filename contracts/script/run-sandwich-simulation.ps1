# ============================================================================
# MEV Sandwich Simulation Script
# Demonstrates canonical sandwich attack pattern on Unichain Sepolia
# ============================================================================

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step { param($msg) Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Yellow }
function Write-Error-Custom { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                              ║" -ForegroundColor Magenta
Write-Host "║         MEV SANDWICH SIMULATION - UniFlux                    ║" -ForegroundColor Magenta
Write-Host "║         Canonical Three-Transaction Attack Pattern           ║" -ForegroundColor Magenta
Write-Host "║                                                              ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# Set Foundry bin path
$foundryBin = Join-Path $env:USERPROFILE ".foundry\bin"
$env:Path = "$foundryBin;$env:Path"

# Change to contracts directory
Set-Location H:\uniflex\uniflux\contracts

# Load .env
if (-not (Test-Path .env)) {
    Write-Error-Custom ".env file not found!"
    exit 1
}

Write-Info "Environment loaded from .env"
Write-Info "Pool: mUSDC/mETH on Unichain Sepolia"
Write-Host ""

# Check if attacker private key is set
$attackerKey = $env:ATTACKER_PRIVATE_KEY
if (-not $attackerKey) {
    Write-Host "⚠️  ATTACKER_PRIVATE_KEY not set in .env" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Creating new attacker wallet..." -ForegroundColor Yellow
    
    # Generate new wallet
    $walletOutput = cast wallet new 2>&1 | Out-String
    Write-Host $walletOutput
    
    Write-Host ""
    Write-Host "📝 Add this to your .env file:" -ForegroundColor Cyan
    Write-Host "   ATTACKER_PRIVATE_KEY=0x..." -ForegroundColor White
    Write-Host ""
    Write-Host "Then fund the attacker address with:" -ForegroundColor Cyan
    Write-Host "   1. Unichain Sepolia ETH (for gas)" -ForegroundColor White
    Write-Host "   2. mETH and mUSDC tokens" -ForegroundColor White
    Write-Host ""
    exit 0
}

Write-Success "Attacker wallet configured"
Write-Host ""

# ============================================================================
# STEP 1: FRONTRUN (Attacker pushes price)
# ============================================================================
Write-Step "STEP 1/3: FRONTRUN SWAP"
Write-Info "Attacker swaps 0.5 token0 → token1"
Write-Info "This pushes the price UP"
Write-Host ""

forge script script/SandwichSimulation.s.sol `
    --sig "frontrun()" `
    --rpc-url https://sepolia.unichain.org `
    --broadcast

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Frontrun swap failed!"
    exit 1
}

Write-Success "Frontrun complete - Price moved UP"
Write-Host ""
Write-Host "Press Enter to continue to victim swap..." -ForegroundColor Yellow
Read-Host

# ============================================================================
# STEP 2: VICTIM (User suffers from displaced price)
# ============================================================================
Write-Step "STEP 2/3: VICTIM SWAP"
Write-Info "Victim swaps 0.1 token0 → token1"
Write-Info "Executes at WORSE price due to frontrun"
Write-Host ""

forge script script/SandwichSimulation.s.sol `
    --sig "victim()" `
    --rpc-url https://sepolia.unichain.org `
    --broadcast

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Victim swap failed!"
    exit 1
}

Write-Success "Victim swap complete - Suffered slippage"
Write-Info "SandwichDetectorV2 should detect this loss"
Write-Host ""
Write-Host "Press Enter to continue to backrun..." -ForegroundColor Yellow
Read-Host

# ============================================================================
# STEP 3: BACKRUN (Attacker restores price, extracts profit)
# ============================================================================
Write-Step "STEP 3/3: BACKRUN SWAP"
Write-Info "Attacker reverses position: token1 → token0"
Write-Info "Restores price, extracts MEV profit"
Write-Host ""

forge script script/SandwichSimulation.s.sol `
    --sig "backrun()" `
    --rpc-url https://sepolia.unichain.org `
    --broadcast

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Backrun swap failed!"
    exit 1
}

Write-Success "Backrun complete - Price restored"
Write-Host ""

# ============================================================================
# VERIFICATION
# ============================================================================
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                 SANDWICH SIMULATION COMPLETE                 ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Success "Three transactions executed:"
Write-Host "   1. Attacker frontrun  (0.5 token0 → token1)" -ForegroundColor White
Write-Host "   2. Victim swap        (0.1 token0 → token1 at worse price)" -ForegroundColor White
Write-Host "   3. Attacker backrun   (0.5 token1 → token0)" -ForegroundColor White
Write-Host ""
Write-Host "🔍 VERIFICATION STEPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Check Unichain Sepolia explorer for transactions" -ForegroundColor White
Write-Host "   https://sepolia.uniscan.xyz" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Look for SandwichDetectorV2 events:" -ForegroundColor White
Write-Host "   - SandwichDetected(attacker, victim, loss, refund)" -ForegroundColor Gray
Write-Host "   - RefundClaimed(victim, amount)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Check UniFlux Agent UI:" -ForegroundColor White
Write-Host "   - MEV stats should show detection" -ForegroundColor Gray
Write-Host "   - Timeline should show escalation" -ForegroundColor Gray
Write-Host "   - Agent may remove liquidity as response" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Run: Get-Content broadcast\SandwichSimulation.s.sol\1301\run-latest.json | ConvertFrom-Json" -ForegroundColor White
Write-Host "   To see detailed transaction data" -ForegroundColor Gray
Write-Host ""
Write-Success "Simulation ready for judge review!"
Write-Host ""
