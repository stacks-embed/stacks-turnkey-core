import {
  broadcastTransaction,
  Cl,
  createMessageSignature,
  makeUnsignedContractCall,
  makeUnsignedSTXTokenTransfer,
  publicKeyToAddress,
  sigHashPreSign,
  SingleSigSpendingCondition,
  TransactionSigner,
  UnsignedContractCallOptions,
} from "@stacks/transactions";
import Base from "../base";

// Utility to convert objects potentially containing BigInt to safe JSON-compatible data
function toSerializableJson(data: any): any {
  if (typeof data === "bigint") {
    return data.toString();
  }
  if (Array.isArray(data)) {
    return data.map(toSerializableJson);
  }
  if (data !== null && typeof data === "object") {
    const newObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      newObj[key] = toSerializableJson(value);
    }
    return newObj;
  }
  return data; // primitive or serializable type
}

export default class Transactions extends Base {
  public async generateStacksWallet({
    userName,
    walletName,
  }: {
    userName: string;
    walletName: string;
  }): Promise<{
    subOrganization: any;
    wallet: any;
    stacksAddress: string;
  }> {
    const client = this.getClient();
    const subOrganization = await client.apiClient().createSubOrganization({
      organizationId: this.getDefaultOrganizationId(),
      subOrganizationName: `${walletName}'s Sub organization`,
      rootUsers: [
        {
          userName,
          apiKeys: [
            {
              apiKeyName: "root-api-key",
              publicKey: this.getApiPublicKey(),
              curveType: "API_KEY_CURVE_SECP256K1",
            },
          ],
          authenticators: [],
          oauthProviders: [],
        },
      ],
      rootQuorumThreshold: 1,
    });

    if (!subOrganization) throw new Error("Failed to create sub-organization");

    await client.apiClient().createPrivateKeys({
      organizationId: subOrganization.subOrganizationId,
      privateKeys: [
        {
          privateKeyName: "stacks-key-1",
          curve: "CURVE_SECP256K1",
          privateKeyTags: [],
          addressFormats: ["ADDRESS_FORMAT_UNCOMPRESSED"],
        },
      ],
    });

    const wallet = await client.apiClient().createWallet({
      walletName: "My Wallet 3",
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/5'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_UNCOMPRESSED",
        },
      ],
      organizationId: subOrganization.subOrganizationId,
    });

    return toSerializableJson({
      subOrganization,
      wallet,
      stacksAddress: publicKeyToAddress(wallet.addresses[0], this.getNetwork()),
    });
  }

  public async deriveStacksAddressFromTurnkeyAddress(
    turnkeyWalletAddress: string
  ): Promise<string> {
    return publicKeyToAddress(turnkeyWalletAddress, this.getNetwork());
  }

  public async getCurrentNonce(address: string): Promise<string> {
    try {
      const response = await this.invoke<{ nonce: number | string }>(
        `https://stacks-node-api.${this.getNetwork()}.stacks.co/v2/accounts/${address}`
      );
      if (
        response &&
        (typeof response.nonce === "number" ||
          typeof response.nonce === "string")
      ) {
        return response.nonce.toString();
      }
      throw new Error("Nonce field missing or invalid in response");
    } catch (error) {
      console.error("Error fetching account nonce:", error);
      return "0";
    }
  }

  public async getStacksTransactions(address: string): Promise<unknown[]> {
    try {
      const response = await this.invoke<{ results: unknown[] }>(
        `https://api.${this.getNetwork()}.hiro.so/extended/v2/addresses/${address}/transactions`
      );
      if (response.results && Array.isArray(response.results)) {
        return toSerializableJson(response.results);
      }
      console.error("Transactions field missing or invalid in response");
      return [];
    } catch (error) {
      console.error("Error fetching account transactions:", error);
      return [];
    }
  }

  public async getStacksBalance(address: string): Promise<string> {
    try {
      const response = await this.invoke<{
        stx?: { balance: string };
        balance?: string;
        [key: string]: unknown;
      }>(
        `https://api.${this.getNetwork()}.hiro.so/extended/v1/address/${address}/balances?unanchored=true`
      );
      if (response.stx && typeof response.stx.balance === "string") {
        return response.stx.balance;
      }
      if (typeof response.balance === "string") {
        return response.balance;
      }
      throw new Error("Balance field missing in response");
    } catch (error) {
      console.error("Error fetching account balance:", error);
      return "0";
    }
  }

  public async getFeeRate(): Promise<string> {
    try {
      const response = await this.invoke<string>(
        "https://api.testnet.hiro.so/v2/fees/transfer"
      );
      const bigintVal = BigInt(response);
      return bigintVal.toString();
    } catch (error) {
      console.error("Error fetching fee rate:", error);
      return "1";
    }
  }

  private safeTransferAmount({
    balance,
    feeRate,
    estimatedSize,
  }: {
    balance: bigint;
    feeRate: bigint;
    estimatedSize: number;
  }): bigint {
    const estimatedFee = feeRate * BigInt(estimatedSize);
    if (balance <= estimatedFee) {
      throw new Error("Balance too low to cover the fee");
    }
    return balance - estimatedFee;
  }

  public async transferSTX({
    turnkeyWalletAddress,
    to,
    amount,
  }: {
    turnkeyWalletAddress: string;
    to: string;
    amount: bigint;
  }) {
    const senderAddress = await this.deriveStacksAddressFromTurnkeyAddress(
      turnkeyWalletAddress
    );
    const balanceStr = await this.getStacksBalance(senderAddress);
    const balance = BigInt(balanceStr);
    const feeRateStr = await this.getFeeRate();
    const feeRate = BigInt(feeRateStr);

    const dummyTx = await makeUnsignedSTXTokenTransfer({
      recipient: to,
      amount,
      publicKey: turnkeyWalletAddress,
      nonce: 0n,
      fee: 0n,
      network: this.getNetwork(),
    });
    const estimatedSize = dummyTx.serializeBytes().byteLength;
    const estimatedFee = feeRate * BigInt(estimatedSize);
    const totalRequired = amount + estimatedFee;

    if (balance < totalRequired) {
      const adjustedAmount = this.safeTransferAmount({
        balance,
        feeRate,
        estimatedSize,
      });
      console.log(
        `Insufficient funds for ${amount} + fee. Adjusting send amount to ${adjustedAmount}.`
      );
      amount = adjustedAmount;
    }

    const nonceStr = await this.getCurrentNonce(senderAddress);
    const nonce = BigInt(nonceStr);

    const transaction = await makeUnsignedSTXTokenTransfer({
      recipient: to,
      amount,
      publicKey: turnkeyWalletAddress,
      nonce,
      fee: estimatedFee,
      network: this.getNetwork(),
    });

    const signer = new TransactionSigner(transaction);
    const preSignSigHash = sigHashPreSign(
      signer.sigHash,
      transaction.auth.authType,
      transaction.auth.spendingCondition.fee,
      transaction.auth.spendingCondition.nonce
    );

    const payload = `0x${preSignSigHash}`;
    const signature = await this.getClient().apiClient().signRawPayload({
      payload,
      signWith: turnkeyWalletAddress,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
    });

    if (!signature) throw new Error("No signature returned");

    const signatureString = `${signature.v}${signature.r.padStart(
      64,
      "0"
    )}${signature.s.padStart(64, "0")}`;

    const spendingCondition = transaction.auth
      .spendingCondition as SingleSigSpendingCondition;
    spendingCondition.signature = createMessageSignature(signatureString);

    const broadcastResult = await broadcastTransaction({
      transaction,
      network: this.getNetwork(),
    });

    return toSerializableJson(broadcastResult);
  }

  public async executeFunctionCall({
    turnkeyWalletAddress,
    contractCallOptions,
  }: {
    turnkeyWalletAddress: string;
    contractCallOptions: UnsignedContractCallOptions;
  }) {
    try {
      const transaction = await makeUnsignedContractCall(contractCallOptions);
      const txSigner = new TransactionSigner(transaction);
      const stacksTxSigner = txSigner;
      const stacksTransaction = txSigner.transaction;

      const preSignSigHash = sigHashPreSign(
        stacksTxSigner.sigHash,
        stacksTransaction.auth.authType,
        stacksTransaction.auth.spendingCondition.fee,
        stacksTransaction.auth.spendingCondition.nonce
      );

      const payload = `0x${preSignSigHash}`;
      const signature = await this.getClient().apiClient().signRawPayload({
        payload,
        signWith: turnkeyWalletAddress,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction: "HASH_FUNCTION_NO_OP",
      });
      if (!signature) throw new Error("No signature returned");

      const signatureString = `${signature.v}${signature.r.padStart(
        64,
        "0"
      )}${signature.s.padStart(64, "0")}`;

      const spendingCondition = stacksTransaction.auth
        .spendingCondition as SingleSigSpendingCondition;
      spendingCondition.signature = createMessageSignature(signatureString);

      const broadcastResult = await broadcastTransaction({
        transaction: stacksTransaction,
        network: this.getNetwork(),
      });

      return toSerializableJson(broadcastResult);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error executing function call:", error.message);
      }
      throw error;
    }
  }

  public async transferSBTC({
    turnkeyWalletAddress,
    to,
    amount,
  }: {
    turnkeyWalletAddress: string;
    to: string;
    amount: bigint;
  }) {
    try {
      const contractCallOptions = {
        contractAddress: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4",
        contractName: "sbtc-token",
        functionName: "transfer",
        functionArgs: [
          Cl.uint(amount),
          Cl.principal(turnkeyWalletAddress),
          Cl.principal(to),
          Cl.none(),
        ],
        numSignatures: 1,
        publicKey: turnkeyWalletAddress,
        postConditions: [],
        network: this.getNetwork(),
      };

      const result = await this.executeFunctionCall({
        turnkeyWalletAddress,
        contractCallOptions,
      });

      return toSerializableJson(result);
    } catch (error) {
      console.error("Error transferring sBTC:", error);
      throw error;
    }
  }
}
