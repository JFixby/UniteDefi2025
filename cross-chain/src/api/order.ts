export class OrderBTC2EVM {
  constructor(
    public amountBtc: number,
    public amountEth: number,
    public ethAddress: string
  ) {}
}


export class OrderBTC2EVMResponse {
  constructor(
    public lightningNetworkInvoice: string
  ) {}
}


export class OrderEVM2BTC {
  constructor(
    public amountBtc: number,
    public btcLightningNetInvoice: string,
    public amountEth: number
  ) {}
}

export class OrderEVM2BTCResponse {
  constructor(
    public ethAddress: string,
  ) {}
}
