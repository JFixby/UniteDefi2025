import { NetworkEnum } from "@1inch/fusion-sdk";

// Token addresses for different networks (most common 10 tokens per network)
export const TOKEN_ADDRESSES = {
    // Ethereum Mainnet
    [NetworkEnum.ETHEREUM]: {
        WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
        UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
        PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    },
    
    // Polygon Mainnet
    [NetworkEnum.POLYGON]: {
        MATIC: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Native token
        WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        LINK: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
        AAVE: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
        CRV: '0x172370d5Cd63279eFa6d502DAB29171933a610AF',
        QUICK: '0xB5C064F955D8e7F38fE0460C556a72987494eE17',
    },
    
    // Binance Smart Chain (BSC)
    [NetworkEnum.BINANCE]: {
        WBNB: '0xbb4CdB9CBd36B01bD1cBaEF2aF378a0bD5D3D3D3D',
        USDT: '0x55d398326f99059fF775485246999027B3197955',
        USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        DAI: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
        WETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
        WBTC: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
        LINK: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD',
        AAVE: '0xfb6115445Bff7b52FeB98650C87f44907E58f802',
        CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    },
    
    // Arbitrum
    [NetworkEnum.ARBITRUM]: {
        WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
        LINK: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
        UNI: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
        AAVE: '0xba5DdD1F9d7F570dc94a51479a000E3bE9670B08',
        CRV: '0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978',
        SUSHI: '0xd4d42F0b6DEF4CE0383636770eF773390d85c61A',
    },
    
    // Optimism
    [NetworkEnum.OPTIMISM]: {
        WETH: '0x4200000000000000000000000000000000000006',
        USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        WBTC: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
        LINK: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6',
        UNI: '0x6fd9d7AD17242c41f7131d257212c54A0e816691',
        AAVE: '0x76FB31fb4af56892A25e32cFC43De717950c9278',
        CRV: '0x0994206dfE8De6Ec6920FF4D779B0d950605Fb53',
        SUSHI: '0x67C10C397dD0BaB4174abC6A3b6F9ec3F6f538ca',
    },
} as const;

// Token decimals for different tokens (complete coverage of all supported tokens)
export const TOKEN_DECIMALS = {
    // Ethereum tokens
    ETH: 18,
    WETH: 18,
    USDT: 6,
    USDC: 6,
    DAI: 18,
    WBTC: 8,
    LINK: 18,
    UNI: 18,
    AAVE: 18,
    CRV: 18,
    COMP: 18,
    SHIB: 18,
    PEPE: 18,
    
    // Polygon tokens
    MATIC: 18,
    WMATIC: 18,
    QUICK: 18,
    
    // BSC tokens
    BNB: 18,
    WBNB: 18,
    CAKE: 18,
    BUSD: 18,
    
    // Arbitrum tokens
    SUSHI: 18,
    
    // Optimism tokens
    // (same decimals as Ethereum for most tokens)
} as const;

// Network configuration
export const NETWORK_CONFIG = {
    [NetworkEnum.ETHEREUM]: {
        name: 'Ethereum Mainnet',
        chainId: 1,
        tokens: TOKEN_ADDRESSES[NetworkEnum.ETHEREUM],
    },
    [NetworkEnum.POLYGON]: {
        name: 'Polygon Mainnet',
        chainId: 137,
        tokens: TOKEN_ADDRESSES[NetworkEnum.POLYGON],
    },
    [NetworkEnum.BINANCE]: {
        name: 'Binance Smart Chain',
        chainId: 56,
        tokens: TOKEN_ADDRESSES[NetworkEnum.BINANCE],
    },
    [NetworkEnum.ARBITRUM]: {
        name: 'Arbitrum',
        chainId: 42161,
        tokens: TOKEN_ADDRESSES[NetworkEnum.ARBITRUM],
    },
    [NetworkEnum.OPTIMISM]: {
        name: 'Optimism',
        chainId: 10,
        tokens: TOKEN_ADDRESSES[NetworkEnum.OPTIMISM],
    },
} as const;

// Type definitions for better type safety
type SupportedNetwork = keyof typeof TOKEN_ADDRESSES;
type TokenSymbol = string;

// Helper function to get token address with improved type safety
export function getTokenAddress(tokenSymbol: string, network: NetworkEnum): string {
    if (!(network in TOKEN_ADDRESSES)) {
        throw new Error(`Network ${network} not supported`);
    }
    
    const networkTokens = TOKEN_ADDRESSES[network as SupportedNetwork];
    const upperSymbol = tokenSymbol.toUpperCase();
    
    if (!(upperSymbol in networkTokens)) {
        const networkName = NETWORK_CONFIG[network as SupportedNetwork]?.name || network;
        throw new Error(`Token ${tokenSymbol} not found on ${networkName}`);
    }
    
    return networkTokens[upperSymbol as keyof typeof networkTokens];
}

// Helper function to get token decimals with improved type safety
export function getTokenDecimals(tokenSymbol: string): number {
    const upperSymbol = tokenSymbol.toUpperCase();
    
    if (!(upperSymbol in TOKEN_DECIMALS)) {
        throw new Error(`Unknown token symbol: ${tokenSymbol}`);
    }
    
    return TOKEN_DECIMALS[upperSymbol as keyof typeof TOKEN_DECIMALS];
}

// Helper function to check if token exists on network (optimized)
export function isTokenSupported(tokenSymbol: string, network: NetworkEnum): boolean {
    if (!(network in TOKEN_ADDRESSES)) {
        return false;
    }
    
    const networkTokens = TOKEN_ADDRESSES[network as SupportedNetwork];
    const upperSymbol = tokenSymbol.toUpperCase();
    
    return upperSymbol in networkTokens;
}

// Helper function to get all supported tokens for a network
export function getSupportedTokens(network: NetworkEnum): string[] {
    if (!(network in TOKEN_ADDRESSES)) {
        return [];
    }
    
    const networkTokens = TOKEN_ADDRESSES[network as SupportedNetwork];
    return Object.keys(networkTokens);
}

// Helper function to get all supported networks
export function getSupportedNetworks(): NetworkEnum[] {
    return Object.keys(NETWORK_CONFIG).map(Number) as NetworkEnum[];
}

// Helper function to validate Ethereum address format
export function isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Helper function to get network info
export function getNetworkInfo(network: NetworkEnum) {
    if (!(network in NETWORK_CONFIG)) {
        throw new Error(`Network ${network} not supported`);
    }
    
    return NETWORK_CONFIG[network as SupportedNetwork];
} 