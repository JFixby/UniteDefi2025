import { 
    JsonRpcProvider,
    Contract,
    Wallet,
    formatUnits,
    parseUnits
} from "ethers";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY || 'YOUR_PRIVATE_KEY'
const NODE_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'

// Token addresses on Polygon
const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' // USDT on Polygon
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC on Polygon

// 1inch Aggregation Router V6 on Polygon
const ROUTER_ADDRESS = '0x1111111254EEB25477B68fb85Ed929f73A960582'

// ERC20 ABI (minimal for approve and allowance)
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    balance: string;
    allowance: string;
}

async function getTokenInfo(contract: Contract, walletAddress: string): Promise<TokenInfo> {
    const [balance, allowance, symbol, decimals] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.allowance(walletAddress, ROUTER_ADDRESS),
        contract.symbol(),
        contract.decimals()
    ]);
    
    return {
        address: contract.target as string,
        symbol,
        decimals,
        balance: formatUnits(balance, decimals),
        allowance: formatUnits(allowance, decimals)
    };
}

async function listCurrentAllowances(provider: JsonRpcProvider, walletAddress: string) {
    console.log('\n=== CURRENT ALLOWANCES ===');
    
    const usdtContract = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
    const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
    
    try {
        const [usdtInfo, usdcInfo] = await Promise.all([
            getTokenInfo(usdtContract, walletAddress),
            getTokenInfo(usdcContract, walletAddress)
        ]);
        
        console.log(`\nUSDT (${usdtInfo.address}):`);
        console.log(`  Balance: ${usdtInfo.balance} ${usdtInfo.symbol}`);
        console.log(`  Allowance for 1inch: ${usdtInfo.allowance} ${usdtInfo.symbol}`);
        
        console.log(`\nUSDC (${usdcInfo.address}):`);
        console.log(`  Balance: ${usdcInfo.balance} ${usdcInfo.symbol}`);
        console.log(`  Allowance for 1inch: ${usdcInfo.allowance} ${usdcInfo.symbol}`);
        
        return { usdtInfo, usdcInfo };
        
    } catch (error) {
        console.error('Error getting token info:', error);
        throw error;
    }
}

async function updateAllowanceTo1MillionUSD(wallet: Wallet, tokenInfo: TokenInfo) {
    const currentAllowance = parseFloat(tokenInfo.allowance);
    const requiredAllowance = 1000000.0; // 1 million USD
    
    if (currentAllowance >= requiredAllowance) {
        console.log(`\n=== ${tokenInfo.symbol} ALLOWANCE ALREADY SUFFICIENT ===`);
        console.log(`Current allowance: ${currentAllowance.toLocaleString()} ${tokenInfo.symbol}`);
        console.log(`Required allowance: ${requiredAllowance.toLocaleString()} ${tokenInfo.symbol}`);
        console.log(`✅ No update needed for ${tokenInfo.symbol}`);
        return;
    }
    
    console.log(`\n=== UPDATING ${tokenInfo.symbol} ALLOWANCE TO $1,000,000 ===`);
    
    const contract = new Contract(tokenInfo.address, ERC20_ABI, wallet);
    
    // Approve $1,000,000 worth (assuming 1:1 USD ratio for stablecoins)
    const amountToApprove = parseUnits('1000000', tokenInfo.decimals);
    
    console.log(`Approving ${formatUnits(amountToApprove, tokenInfo.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${tokenInfo.symbol} for 1inch router...`);
    
    try {
        const approveTx = await contract.approve(ROUTER_ADDRESS, amountToApprove);
        console.log(`Approval transaction sent: ${approveTx.hash}`);
        
        // Wait for transaction confirmation
        console.log('Waiting for transaction confirmation...');
        const receipt = await approveTx.wait();
        
        console.log(`✅ ${tokenInfo.symbol} approval confirmed!`);
        console.log(`Transaction hash: ${receipt.hash}`);
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);
        
        // Verify the allowance was actually updated
        const newAllowance = await contract.allowance(wallet.address, ROUTER_ADDRESS);
        console.log(`New allowance: ${formatUnits(newAllowance, tokenInfo.decimals)} ${tokenInfo.symbol}`);
        
    } catch (error) {
        console.error(`Error approving ${tokenInfo.symbol}:`, error);
        throw error;
    }
}

async function checkAndUpdateAllowances() {
    console.log('Checking and updating USDT/USDC allowances for 1inch router...');
    
    try {
        // Initialize provider and wallet
        const provider = new JsonRpcProvider(NODE_URL);
        const privateKeyWithPrefix = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
        const wallet = new Wallet(privateKeyWithPrefix, provider);
        
        console.log('Wallet address:', wallet.address);
        
        // Step 1: List current allowances
        const { usdtInfo, usdcInfo } = await listCurrentAllowances(provider, wallet.address);
        
        // Step 2: Update allowances to $1,000,000
        await updateAllowanceTo1MillionUSD(wallet, usdtInfo);
        await updateAllowanceTo1MillionUSD(wallet, usdcInfo);
        
        // Step 3: List allowances again to verify (re-fetch current data)
        console.log('\n=== VERIFYING UPDATED ALLOWANCES ===');
        await listCurrentAllowances(provider, wallet.address);
        
        console.log('\n✅ Allowance update process completed!');
        
    } catch (error) {
        console.error('Error during allowance update:', error);
        throw error;
    }
}

// Run the allowance check and update
checkAndUpdateAllowances().catch(console.error); 