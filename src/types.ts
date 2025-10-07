export type Network = "mainnet" | "testnet";

export declare type Config = {
  name?: string;
  description?: string;
  network?: Network;

  apiBaseUrl: string;
  apiPrivateKey: string;
  apiPublicKey: string;
  defaultOrganizationId: string;
};
