import dotenv from "dotenv";
dotenv.config();

import StacksTurnkey from "./index";

const NEXT_PUBLIC_TURNKEY_RP_ID = "localhost";
const TURNKEY_API_PUBLIC_KEY =
  "0365759d222be5120f7cfedff53c2ee67504e02d244b5f9c5c09d99e27baa13ce7";
const TURNKEY_API_PRIVATE_KEY =
  "b3bbef713fbb030631dc0c139154c8f328a9c000b5b40735d6f8c0197626b9ce";
const TURNKEY_API_BASE_URL = "https://api.turnkey.com";
const TURNKEY_ORGANIZATION_ID = "9843f65d-72b1-4f4f-9233-0f5c47a44e57";

if (!TURNKEY_API_BASE_URL) {
  throw new Error("Missing TURNKEY_API_BASE_URL environment variables");
}

if (!TURNKEY_API_PRIVATE_KEY) {
  throw new Error("Missing TURNKEY_API_PRIVATE_KEY environment variables");
}

if (!TURNKEY_API_PUBLIC_KEY) {
  throw new Error("Missing TURNKEY_API_PUBLIC_KEY environment variables");
}

if (!TURNKEY_ORGANIZATION_ID) {
  throw new Error("Missing TURNKEY_ORGANIZATION_ID environment variables");
}

const stacksTurnkey = new StacksTurnkey({
  rpId: NEXT_PUBLIC_TURNKEY_RP_ID,
  apiBaseUrl: TURNKEY_API_BASE_URL,
  apiPrivateKey: TURNKEY_API_PRIVATE_KEY,
  apiPublicKey: TURNKEY_API_PUBLIC_KEY,
  defaultOrganizationId: TURNKEY_ORGANIZATION_ID,
});

const main = async () => {
  const wallet = await stacksTurnkey.createStacksWallet({
    userName: "My Wallet",
    walletName: "My Wallet",
  });
  console.log(wallet);

  const stacksAddress =
    await stacksTurnkey.deriveStacksAddressFromTurnkeyAddress(
      wallet.wallet.addresses[0]
    );
  console.log(stacksAddress);

  const balance = await stacksTurnkey.getStacksBalance(stacksAddress);
  console.log(balance);

  const feeRate = await stacksTurnkey.getFeeRate();
  console.log(feeRate);

  const nonce = await stacksTurnkey.getCurrentNonce(stacksAddress);
  console.log(nonce);

  const transactions = await stacksTurnkey.getStacksTransactions(stacksAddress);
  console.log(transactions);
};

main();
