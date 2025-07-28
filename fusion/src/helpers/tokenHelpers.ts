import { JsonRpcProvider, Contract, formatUnits, parseUnits } from "ethers";

// Token addresses on Polygon
export const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
export const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// Token decimals
export const USDT_DECIMALS = 6;
export const USDC_DECIMALS = 6;

// 1inch Aggregation Router V6 on Polygon
export const ROUTER_ADDRESS = '0x1111111254EEB25477B68fb85Ed929f73A960582';

// ERC20 ABI (minimal for balanceOf and allowance)
export const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

export interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
}

export interface BalanceInfo {
    balance: string;
    balanceInWei: string;
    symbol: string;
    decimals: number;
}

export interface AllowanceInfo {
    allowance: string;
    allowanceInWei: string;
}

export const TOKENS: Record<string, TokenInfo> = {
    USDT: {
        address: USDT_ADDRESS,
        symbol: 'USDT',
        decimals: USDT_DECIMALS
    },
    USDC: {
        address: USDC_ADDRESS,
        symbol: 'USDC',
        decimals: USDC_DECIMALS
    }
};

export function getTokenInfo(tokenAddress: string): TokenInfo | null {
    for (const token of Object.values(TOKENS)) {
        if (token.address.toLowerCase() === tokenAddress.toLowerCase()) {
            return token;
        }
    }
    return null;
}

export function getTokenSymbol(tokenAddress: string): string {
    const tokenInfo = getTokenInfo(tokenAddress);
    return tokenInfo?.symbol || 'UNKNOWN';
}

export async function checkTokenBalance(
    provider: JsonRpcProvider, 
    walletAddress: string, 
    tokenAddress: string
): Promise<BalanceInfo> {
    const tokenSymbol = getTokenSymbol(tokenAddress);
    console.log(`Checking ${tokenSymbol} balance...`);
    
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    
    try {
        const [balance, symbol, decimals] = await Promise.all([
            tokenContract.balanceOf(walletAddress),
            tokenContract.symbol(),
            tokenContract.decimals()
        ]);
        
        const balanceInWei = balance.toString();
        const balanceFormatted = formatUnits(balance, decimals);
        
        console.log(`${symbol} Balance: ${balanceFormatted} ${symbol}`);
        console.log(`${symbol} Balance (wei): ${balanceInWei}`);
        
        return {
            balance: balanceFormatted,
            balanceInWei,
            symbol,
            decimals
        };
        
    } catch (error) {
        console.error(`Error checking ${tokenSymbol} balance:`, error);
        throw error;
    }
}

export async function checkTokenAllowance(
    provider: JsonRpcProvider, 
    walletAddress: string, 
    tokenAddress: string
): Promise<AllowanceInfo> {
    const tokenSymbol = getTokenSymbol(tokenAddress);
    console.log(`Checking ${tokenSymbol} allowance for 1inch router...`);
    
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    
    try {
        const allowance = await tokenContract.allowance(walletAddress, ROUTER_ADDRESS);
        const allowanceInWei = allowance.toString();
        const tokenInfo = getTokenInfo(tokenAddress);
        const decimals = tokenInfo?.decimals || 18;
        const allowanceFormatted = formatUnits(allowance, decimals);
        
        console.log(`${tokenSymbol} Allowance for 1inch Router: ${allowanceFormatted} ${tokenSymbol}`);
        console.log(`${tokenSymbol} Allowance (wei): ${allowanceInWei}`);
        
        return {
            allowance: allowanceFormatted,
            allowanceInWei
        };
        
    } catch (error) {
        console.error(`Error checking ${tokenSymbol} allowance:`, error);
        throw error;
    }
}

export async function validateTokenBalance(
    provider: JsonRpcProvider,
    walletAddress: string,
    tokenAddress: string,
    requiredAmount: string
): Promise<BalanceInfo> {
    const balanceInfo = await checkTokenBalance(provider, walletAddress, tokenAddress);
    const tokenInfo = getTokenInfo(tokenAddress);
    
    if (!tokenInfo) {
        throw new Error(`Unknown token address: ${tokenAddress}`);
    }
    
    const required = parseUnits(requiredAmount, tokenInfo.decimals);
    const current = parseUnits(balanceInfo.balance, balanceInfo.decimals);
    
    if (current < required) {
        throw new Error(
            `Insufficient ${tokenInfo.symbol} balance. Required: ${requiredAmount} ${tokenInfo.symbol}, Available: ${balanceInfo.balance} ${tokenInfo.symbol}`
        );
    }
    
    console.log(`✅ Sufficient ${tokenInfo.symbol} balance confirmed`);
    return balanceInfo;
}

export async function validateTokenAllowance(
    provider: JsonRpcProvider,
    walletAddress: string,
    tokenAddress: string,
    requiredAmount: string
): Promise<AllowanceInfo> {
    const allowanceInfo = await checkTokenAllowance(provider, walletAddress, tokenAddress);
    const tokenInfo = getTokenInfo(tokenAddress);
    
    if (!tokenInfo) {
        throw new Error(`Unknown token address: ${tokenAddress}`);
    }
    
    const required = parseUnits(requiredAmount, tokenInfo.decimals);
    const current = parseUnits(allowanceInfo.allowance, tokenInfo.decimals);
    
    if (current < required) {
        console.log(`⚠️  Insufficient ${tokenInfo.symbol} allowance. You need to approve ${tokenInfo.symbol} for 1inch router first.`);
        console.log('   You can use the allowance script: npm run allowance');
        throw new Error(
            `Insufficient ${tokenInfo.symbol} allowance. Required: ${requiredAmount} ${tokenInfo.symbol}, Allowed: ${allowanceInfo.allowance} ${tokenInfo.symbol}`
        );
    }
    
    console.log(`✅ Sufficient ${tokenInfo.symbol} allowance confirmed`);
    return allowanceInfo;
} 