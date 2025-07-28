import { NetworkEnum } from "@1inch/fusion-sdk";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Config {
    privateKey: string;
    nodeUrl: string;
    devPortalApiToken: string;
    network: NetworkEnum;
    swapAmount: string;
    pollingInterval: number;
    transactionWaitTime: number;
    timeout: number;
}

export function validateEnvironmentVariables(): void {
    const requiredVars = [
        'PRIVATE_KEY',
        'POLYGON_RPC_URL', 
        'DEV_PORTAL_API_TOKEN'
    ];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            'Please check your .env file and ensure all required variables are set.'
        );
    }
}

export function getConfig(): Config {
    validateEnvironmentVariables();
    
    const privateKey = process.env.PRIVATE_KEY!;
    const nodeUrl = process.env.POLYGON_RPC_URL!;
    const devPortalApiToken = process.env.DEV_PORTAL_API_TOKEN!;
    
    // Ensure private key has 0x prefix
    const privateKeyWithPrefix = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    
    return {
        privateKey: privateKeyWithPrefix,
        nodeUrl,
        devPortalApiToken,
        network: NetworkEnum.POLYGON,
        swapAmount: '1.44',
        pollingInterval: 2000, // 2 seconds
        transactionWaitTime: 10000, // 10 seconds
        timeout: 5 * 60 * 1000 // 5 minutes
    };
}

export function logConfig(config: Config): void {
    console.log('🔧 Configuration:');
    console.log(`- Network: ${config.network}`);
    console.log(`- Node URL: ${config.nodeUrl}`);
    console.log(`- Swap Amount: ${config.swapAmount} USDT`);
    console.log(`- Polling Interval: ${config.pollingInterval}ms`);
    console.log(`- Transaction Wait Time: ${config.transactionWaitTime}ms`);
    console.log(`- Timeout: ${config.timeout}ms`);
    console.log('');
} 