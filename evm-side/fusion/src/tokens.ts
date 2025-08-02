// Token addresses for different networks

export const TOKENS = {
    ETHEREUM: {
        USDC: '0xA0b86991c6218b36c1d19d4a2e9Eb0cE3606eB48',
        USDT: '0xdAC17F958D2ee523a2206206994597c13D831ec7',
        WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    },
    POLYGON: {
        USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        USDT: '0xC2132D05D31c914a87C6611C10748AEb04B58E8F',
        WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    },
    BSC: {
        USDT: '0x55d398326f99059fF775485246999027B3197955',
        BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        WBNB: '0xbb4CdB9CBd36B01bD1cBaEF60aF814a3f6F8E2E9'
    }
} as const

// Token metadata
export const TOKEN_METADATA = {
    [TOKENS.ETHEREUM.USDC]: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        network: 'Ethereum'
    },
    [TOKENS.ETHEREUM.USDT]: {
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        network: 'Ethereum'
    },
    [TOKENS.POLYGON.USDC]: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        network: 'Polygon'
    },
    [TOKENS.POLYGON.USDT]: {
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        network: 'Polygon'
    }
} as const

// Helper functions
export function getTokenInfo(address: string) {
    return TOKEN_METADATA[address as keyof typeof TOKEN_METADATA]
}

export function formatTokenAmount(amount: string, decimals: number): string {
    const num = parseFloat(amount) / Math.pow(10, decimals)
    return num.toFixed(decimals)
}

export function parseTokenAmount(amount: string, decimals: number): string {
    const num = parseFloat(amount) * Math.pow(10, decimals)
    return Math.floor(num).toString()
} 