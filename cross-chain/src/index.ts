console.log('Cross-chain DeFi project initialized!');

interface CrossChainConfig {
  name: string;
  version: string;
  description: string;
}

const config: CrossChainConfig = {
  name: 'cross-chain',
  version: '1.0.0',
  description: 'Cross-chain DeFi project'
};

console.log('Configuration:', config);

export { config }; 