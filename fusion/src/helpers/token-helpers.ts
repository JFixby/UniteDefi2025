import { JsonRpcProvider, formatUnits, Contract, Wallet } from "ethers";

// ERC20 ABI for balance, allowance checks and approvals
export const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function approve(address spender, uint256 amount) returns (bool)'
]

// Function to check token balance
export async function checkTokenBalance(
    tokenAddress: string, 
    walletAddress: string, 
    provider: JsonRpcProvider
): Promise<{ balance: string, formatted: string, decimals: number, symbol: string }> {
    try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider)
        
        const [balance, decimals, symbol] = await Promise.all([
            tokenContract.balanceOf(walletAddress),
            tokenContract.decimals(),
            tokenContract.symbol()
        ])
        
        const formattedBalance = formatUnits(balance, decimals)
        
        return {
            balance: balance.toString(),
            formatted: formattedBalance,
            decimals,
            symbol
        }
    } catch (error) {
        console.error(`Error checking balance for token ${tokenAddress}:`, error)
        return {
            balance: '0',
            formatted: '0',
            decimals: 18,
            symbol: 'UNKNOWN'
        }
    }
}

// Function to check token allowance
export async function checkTokenAllowance(
    tokenAddress: string, 
    walletAddress: string, 
    spenderAddress: string, 
    provider: JsonRpcProvider
): Promise<{ allowance: string, formatted: string, decimals: number }> {
    try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider)
        
        const [allowance, decimals] = await Promise.all([
            tokenContract.allowance(walletAddress, spenderAddress),
            tokenContract.decimals()
        ])
        
        const formattedAllowance = formatUnits(allowance, decimals)
        
        return {
            allowance: allowance.toString(),
            formatted: formattedAllowance,
            decimals
        }
    } catch (error) {
        console.error(`Error checking allowance for token ${tokenAddress}:`, error)
        return {
            allowance: '0',
            formatted: '0',
            decimals: 18
        }
    }
}

// Function to approve tokens
export async function approveTokens(
    tokenAddress: string, 
    spenderAddress: string, 
    amount: string, 
    wallet: Wallet
): Promise<boolean> {
    try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet)
        console.log(`🔄 Approving ${amount} tokens...`)
        
        const tx = await tokenContract.approve(spenderAddress, amount)
        console.log(`📝 Transaction hash: ${tx.hash}`)
        
        const receipt = await tx.wait()
        console.log(`✅ Approval confirmed in block ${receipt.blockNumber}`)
        
        return true
    } catch (error) {
        console.error(`❌ Approval failed:`, error)
        return false
    }
}

// Function to check allowance for a specific wallet and token
export async function checkAllowance(
    walletAddress: string, 
    tokenAddress: string, 
    spenderAddress: string, 
    provider: JsonRpcProvider,
    tokenName?: string
): Promise<{ balance: string, allowance: string, symbol: string, decimals: number, needsApproval: boolean }> {
    const balanceInfo = await checkTokenBalance(tokenAddress, walletAddress, provider)
    const allowanceInfo = await checkTokenAllowance(tokenAddress, walletAddress, spenderAddress, provider)
    
    const hasAllowance = BigInt(allowanceInfo.allowance) > BigInt(0)
    
    return {
        balance: balanceInfo.formatted,
        allowance: allowanceInfo.formatted,
        symbol: balanceInfo.symbol,
        decimals: balanceInfo.decimals,
        needsApproval: !hasAllowance
    }
}

// Function to check if wallet has sufficient balance and allowance for a specific amount
export async function checkWalletStatus(
    walletAddress: string, 
    tokenAddress: string, 
    requiredAmount: string, 
    routerAddress: string,
    provider: JsonRpcProvider
): Promise<{
    hasBalance: boolean,
    hasAllowance: boolean,
    balance: string,
    allowance: string,
    required: string,
    symbol: string,
    decimals: number
}> {
    console.log(`\n🔍 Checking wallet status for token: ${tokenAddress}`)
    
    const balanceInfo = await checkTokenBalance(tokenAddress, walletAddress, provider)
    const routerAllowanceInfo = await checkTokenAllowance(tokenAddress, walletAddress, routerAddress, provider)
    
    const hasBalance = BigInt(balanceInfo.balance) >= BigInt(requiredAmount)
    const hasRouterAllowance = BigInt(routerAllowanceInfo.allowance) >= BigInt(requiredAmount)
    const hasAllowance = hasRouterAllowance
    
    console.log(`\n💰 BALANCE CHECK:`)
    console.log(`   Raw Balance: ${balanceInfo.balance} (${balanceInfo.decimals} decimals)`)
    console.log(`   Formatted Balance: ${balanceInfo.formatted} ${balanceInfo.symbol}`)
    console.log(`   Required Amount: ${formatUnits(requiredAmount, balanceInfo.decimals)} ${balanceInfo.symbol}`)
    console.log(`   Status: ${hasBalance ? '✅ Sufficient' : '❌ Insufficient'}`)
    
    console.log(`\n🔐 ALLOWANCE CHECK:`)
    console.log(`   Router (${routerAddress}):`)
    console.log(`     Raw Allowance: ${routerAllowanceInfo.allowance} (${routerAllowanceInfo.decimals} decimals)`)
    console.log(`     Formatted Allowance: ${routerAllowanceInfo.formatted} ${balanceInfo.symbol}`)
    console.log(`     Status: ${hasRouterAllowance ? '✅ Sufficient' : '❌ Insufficient'}`)
    
    console.log(`\n📊 SUMMARY:`)
    console.log(`   Has sufficient balance: ${hasBalance ? '✅ Yes' : '❌ No'}`)
    console.log(`   Has sufficient allowance: ${hasAllowance ? '✅ Yes' : '❌ No'}`)
    console.log(`   Can proceed with swap: ${hasBalance && hasAllowance ? '✅ Yes' : '❌ No'}`)
    
    if (!hasAllowance) {
        console.log(`\n💡 APPROVAL NEEDED:`)
        console.log(`   You need to approve the router to spend your ${balanceInfo.symbol}:`)
        console.log(`   - Router: ${routerAddress}`)
    }
    
    return {
        hasBalance,
        hasAllowance,
        balance: balanceInfo.balance,
        allowance: routerAllowanceInfo.allowance,
        required: requiredAmount,
        symbol: balanceInfo.symbol,
        decimals: balanceInfo.decimals
    }
}

// Function to check and approve tokens with detailed logging
export async function checkAndApproveTokens(
    wallet: Wallet, 
    tokenAddress: string, 
    tokenName: string, 
    routerAddress: string
): Promise<void> {
    const walletAddress = wallet.address
    const provider = wallet.provider as JsonRpcProvider
    
    // Initial check
    console.log(`\n🔍 ${tokenName}:`)
    const initialCheck = await checkAllowance(walletAddress, tokenAddress, routerAddress, provider, tokenName)
    console.log(`   Balance: ${initialCheck.balance} ${initialCheck.symbol} (${tokenAddress})`)
    console.log(`   Allowance: ${initialCheck.allowance} ${initialCheck.symbol} ${initialCheck.needsApproval ? '❌' : '✅'}`)
    
    // If approval needed, approve 1M tokens (regardless of balance)
    if (initialCheck.needsApproval) {
        const approvalAmount = BigInt(10) ** BigInt(initialCheck.decimals) * BigInt(1000000) // 1M tokens
        console.log(`   ⚡ Approving 1M ${initialCheck.symbol}...`)
        
        const approved = await approveTokens(tokenAddress, routerAddress, approvalAmount.toString(), wallet)
        
        if (approved) {
            // Check again after approval
            console.log(`   🔄 Re-checking allowance...`)
            const finalCheck = await checkAllowance(walletAddress, tokenAddress, routerAddress, provider, tokenName)
            console.log(`   ✅ New Allowance: ${finalCheck.allowance} ${initialCheck.symbol}`)
        }
    } else {
        console.log(`   ✅ Already approved`)
    }
}

// Function to check native token balance (ETH, MATIC, etc.)
export async function checkNativeBalance(
    walletAddress: string, 
    provider: JsonRpcProvider,
    tokenName: string = 'Native'
): Promise<{ balance: string, formatted: string }> {
    try {
        const balance = await provider.getBalance(walletAddress)
        const formattedBalance = formatUnits(balance, 18)
        
        return {
            balance: balance.toString(),
            formatted: formattedBalance
        }
    } catch (error) {
        console.error(`Error checking ${tokenName} balance:`, error)
        return {
            balance: '0',
            formatted: '0'
        }
    }
} 