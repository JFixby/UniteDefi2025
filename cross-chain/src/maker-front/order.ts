import { CrossChainOrder } from '@1inch/cross-chain-sdk'

export class OrderWrapper {
    public crossChainOrder: CrossChainOrder

    constructor(crossChainOrder: CrossChainOrder) {
        this.crossChainOrder = crossChainOrder
    }
}

