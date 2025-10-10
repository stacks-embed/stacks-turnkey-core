export type Network = "mainnet" | "testnet";

export declare type Config = {
  name?: string;
  description?: string;
  network?: Network;
  rpId: string;

  apiBaseUrl: string;
  apiPrivateKey: string;
  apiPublicKey: string;
  defaultOrganizationId: string;
};
