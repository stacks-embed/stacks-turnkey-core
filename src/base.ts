import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { Config as ConfigType, Network } from "./types";

export default class Base {
  private client: TurnkeyServerSDK;
  private name?: string;
  protected network?: Network;

  // turnkey client config variables
  private description?: string;
  protected apiBaseUrl: string;
  protected apiPrivateKey: string;
  protected apiPublicKey: string;
  protected defaultOrganizationId: string;

  constructor(config: ConfigType) {
    this.name = config.name;
    this.description = config.description;
    this.apiBaseUrl = config.apiBaseUrl;
    this.apiPrivateKey = config.apiPrivateKey;
    this.apiPublicKey = config.apiPublicKey;
    this.defaultOrganizationId = config.defaultOrganizationId;
    this.network =
      !config.network || config.network === undefined
        ? "testnet"
        : config.network;

    // init the turnkey client
    this.client = new TurnkeyServerSDK({
      apiBaseUrl: this.apiBaseUrl,
      apiPrivateKey: this.apiPrivateKey,
      apiPublicKey: this.apiPublicKey,
      defaultOrganizationId: this.defaultOrganizationId,
    });
  }

  getName(): string {
    return this.name || "Stacks Embed SDK";
  }

  getDescription(): string {
    return (
      this.description || "An SDK for Stacks Embedded wallet using turnkey"
    );
  }

  getbaseUrl(): string {
    return this.apiBaseUrl;
  }

  getApiPrivateKey(): string {
    return this.apiPrivateKey;
  }

  getApiPublicKey(): string {
    return this.apiPublicKey;
  }

  getDefaultOrganizationId(): string {
    return this.defaultOrganizationId;
  }

  getNetwork(): Network {
    return this.network ?? "testnet";
  }

  setNetwork(network: Network) {
    this.network = network;
  }

  getClient(): TurnkeyServerSDK {
    return this.client;
  }

  async invoke<T>(url: string, options?: RequestInit): Promise<T> {
    return fetch(url, { ...options }).then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }
      return response.json() as Promise<T>;
    });
  }
}
