## Stacks Embed SDK

A small TypeScript SDK that wires the Stacks toolchain to Turnkey-managed keys. It exposes a single default class `StacksTurnkey` that mixes in auth utilities and transaction helpers for Node environments.

- Stacks: address derivation, balances, transactions (build/broadcast), simple contract calls
- Turnkey: organization, users, wallets, server-side signing

### Package entry points

- CommonJS (Node): `dist/cjs/turnkey-stacks.js`
- ES Module (browser-friendly): `dist/esm/turnkey-stacks.m.js`
- Types: `dist/index.d.ts`

The package name is `turnkey-stacks` and the default export is `StacksTurnkey`.

## Installation

```bash
pnpm add turnkey-stacks @stacks/transactions jsonwebtoken @turnkey/wallet-stamper
# If using this repo locally during development
pnpm add file:/absolute/path/to/stacks-embed-sdk
```

## Requirements

- Node.js 18+
- A Turnkey organization and API credentials
- Network: `"mainnet"` or `"testnet"` (default is `"testnet"`)

## Quickstart

```ts
import StacksTurnkey from "turnkey-stacks";

const sdk = new StacksTurnkey({
  apiBaseUrl: process.env.TURNKEY_API_BASE_URL!,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  // network?: "mainnet" | "testnet" (default: "testnet")
});

async function main() {
  const res = await sdk.createStacksWallet({
    userName: "alice",
    walletName: "alice",
  });
  console.log(res.stacksAddress);
}

main();
```

## Configuration

Constructor config (see `src/types.ts`):

- `apiBaseUrl: string`
- `apiPrivateKey: string`
- `apiPublicKey: string`
- `defaultOrganizationId: string`
- `name?: string`
- `description?: string`
- `network?: "mainnet" | "testnet"`

Helpers on the base class (`src/base.ts`):

- `getClient()` returns the Turnkey server SDK client used under the hood
- `getNetwork()` returns the configured network
- `invoke(url, options?)` small fetch wrapper used by the helpers

## Transactions API (`src/transactions/index.ts`)

- `generateStacksWallet({ userName, walletName })` → creates a Turnkey sub-org, key, wallet; returns `{ subOrganization, wallet, stacksAddress }`
- `deriveStacksAddressFromTurnkeyAddress(turnkeyWalletAddress)` → Stacks address
- `getCurrentNonce(address)` → nonce as string
- `getStacksTransactions(address)` → recent transactions (array)
- `getStacksBalance(address)` → STX balance as string
- `transferSTX({ turnkeyWalletAddress, to, amount })` → builds, signs via Turnkey, broadcasts STX transfer
- `executeFunctionCall({ turnkeyWalletAddress, contractCallOptions })` → builds, signs via Turnkey, broadcasts contract call
- `transferSBTC({ turnkeyWalletAddress, to, amount })` → convenience helper for the sbtc-token contract

Minimal example (read-only helpers):

```ts
const address = await sdk.deriveStacksAddressFromTurnkeyAddress(
  "04...uncompressed-public-key-hex"
);
const balance = await sdk.getStacksBalance(address);
const txs = await sdk.getStacksTransactions(address);
```

Sending STX (simplified):

```ts
await sdk.transferSTX({
  turnkeyWalletAddress: "04...uncompressed-public-key-hex",
  to: "ST...receiver",
  amount: 10n, // in microSTX
});
```

## Auth API (`src/auth/index.ts`)

- `createUserSubOrg({ email?, passkey?, oauth?, wallet? })` → creates a sub-org and default wallet
- `oauth({ credential, publicKey, subOrgId })` → OAuth login via Turnkey
- `initEmailAuth({ email, targetPublicKey, baseUrl })` → initiate OTP
- `verifyOtp({ otpId, otpCode, publicKey })` → verify OTP
- `otpLogin({ publicKey, verificationToken, email })` → complete OTP login
- `getSubOrgId(...)`, `getSubOrgIdByEmail(email)`, `getSubOrgIdByPublicKey(key)`, `getSubOrgIdByUsername(name)`
- `getUser(userId, subOrgId)`
- `getWallet({ walletId, subOrgId })`
- `getAuthenticators({ userId, subOrgId })`, `getAuthenticator({ authenticatorId, subOrgId })`

Example: create a user and derive their Stacks address

```ts
const { subOrg, user } = await sdk.createUserSubOrg({
  email: "user@example.com",
});
// get wallet info
const { wallet, accounts } = await sdk.getWallet({
  walletId: "<wallet-id>",
  subOrgId: subOrg.subOrganizationId,
});
```

## Import styles

- ESM: `import StacksTurnkey from "turnkey-stacks";`
- CJS: `const StacksTurnkey = require("turnkey-stacks").default;`

## Building this package

```bash
pnpm install
pnpm build
```

Build outputs go to `dist/` with both CJS and ESM bundles.

## Notes and caveats

- This SDK is server-oriented; it uses `@turnkey/sdk-server`. Do not expose your Turnkey API keys in browsers.
- CJS build targets Node, ESM build targets browsers. In Node 18+/20+, importing `turnkey-stacks` resolves to the Node-friendly build.
- `@stacks/transactions` may log circular dependency warnings; these are known and benign.

## License

MIT
