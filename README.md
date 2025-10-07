# Stacks Embed SDK

A TypeScript SDK that integrates the Stacks blockchain toolchain with Turnkey-managed keys to provide secure, developer-friendly primitives for account management, signing, and transaction flows. This SDK is designed to be embedded into web applications or used as a library in Node.js/Edge runtimes.

- **Stacks**: address derivation, transaction building, broadcasting, message signing
- **Turnkey**: secure key custody, policy controls, and server-side signing

> Note: This README focuses on concepts and end-to-end usage patterns. Exact class/function names may differ slightly depending on your version. See `src/` for the latest API surface.

## Features

- **Key custody with Turnkey**: create/import wallets, derive addresses, and sign without exposing private keys
- **Stacks transactions**: build, sign, and broadcast STX and Clarity contract calls
- **Network aware**: mainnet/testnet configuration with Hiro API endpoints
- **Browser and Server**: flexible usage patterns; keep server-only code on the server
- **Embeddable UX**: designed to plug into existing apps with minimal wiring

## Architecture Overview

- **Client app (browser)**
  - Builds Stacks transactions and requests signatures
  - Never sees raw private keys
- **Server (Node / Serverless / Edge)**
  - Uses Turnkey to hold keys and perform signatures
  - Optionally exposes thin endpoints for signing and policy checks
- **Stacks network**
  - Broadcasts signed transactions and queries state via Hiro API

Data flow (high-level):

1. App prepares a Stacks transaction (or message) to be signed
2. App sends signing intent to your backend
3. Backend calls Turnkey to sign payload deterministically with the configured key
4. App receives signature, finalizes the transaction, and broadcasts to Stacks

## Installation

```bash
# with pnpm
pnpm add @stacks/transactions @stacks/network @stacks/common
pnpm add @turnkey/sdk-server @turnkey/sdk-client isomorphic-fetch cross-fetch

# or with yarn
yarn add @stacks/transactions @stacks/network @stacks/common \
  @turnkey/sdk-server @turnkey/sdk-client isomorphic-fetch cross-fetch
```

If you plan to bundle in a web app, also ensure your bundler can handle JSON imports and Node built-ins (see Troubleshooting).

## Requirements

- Node.js 18+ (or a compatible Edge runtime)
- A Turnkey organization with API credentials (org ID, API key/policy)
- Hiro API endpoints (mainnet/testnet) for broadcasting and read operations

## Environment Configuration

Set the relevant environment variables in your server runtime:

```bash
# Turnkey
TURNKEY_ORG_ID=org_...             # Your Turnkey organization ID
TURNKEY_API_BASE_URL=https://api.turnkey.com
TURNKEY_API_PRIVATE_KEY=...        # Server-side private key (or KMS reference)

# Stacks
STX_NETWORK=testnet                # or mainnet
HIRO_API_URL=https://api.testnet.hiro.so  # or https://api.hiro.so for mainnet
```

Never expose server-only secrets to the browser. If you need browser-initiated signing, proxy through your backend.

## Usage

### 1) Initialize Stacks network

```ts
import { StacksMainnet, StacksTestnet } from "@stacks/network";

const isMainnet = process.env.STX_NETWORK === "mainnet";
const network = isMainnet
  ? new StacksMainnet({ url: process.env.HIRO_API_URL })
  : new StacksTestnet({ url: process.env.HIRO_API_URL });
```

### 2) Prepare a transaction

```ts
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  cvToHex,
  standardPrincipalCV,
  stringAsciiCV,
} from "@stacks/transactions";

async function buildContractCallTx(params: {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: any[]; // Clarity values
  senderKeyPlaceholder?: string; // we do not store private key here
}) {
  const tx = await makeContractCall({
    contractAddress: params.contractAddress,
    contractName: params.contractName,
    functionName: params.functionName,
    functionArgs: params.functionArgs,
    network,
    anchorMode: AnchorMode.Any,
    fee: 1000n, // example; estimate in production
    senderKey: "00".repeat(32), // placeholder; real signing occurs via Turnkey
  });

  // Serialize to bytes to send to your server for signing
  const unsignedTxBytes = tx.serialize();
  return unsignedTxBytes;
}
```

### 3) Server-side Turnkey signing

```ts
import { TurnkeyServerSDK } from "@turnkey/sdk-server";

const turnkey = new TurnkeyServerSDK({
  baseUrl: process.env.TURNKEY_API_BASE_URL!,
  organizationId: process.env.TURNKEY_ORG_ID!,
  // Authentication configuration (JWT, API key, etc.)
});

async function signStacksTransaction(
  unsignedTxBytes: Uint8Array,
  keyId: string
) {
  // Hash-to-sign depends on Stacks serialization; sign raw bytes deterministically
  const { signature } = await turnkey.sign({
    keyId,
    payload: unsignedTxBytes,
    scheme: "ECDSA_SECP256K1",
  });
  return signature; // DER or compact based on your Turnkey config
}
```

### 4) Finalize and broadcast

```ts
import {
  deserializeTransaction,
  broadcastTransaction,
} from "@stacks/transactions";

async function finalizeAndBroadcast(
  unsignedTxBytes: Uint8Array,
  signature: Uint8Array
) {
  const tx = deserializeTransaction(unsignedTxBytes);
  // attach signature to tx.auth
  // tx.auth.spendingCondition.signature = ...; // depends on your signing flow

  const result = await broadcastTransaction(tx, network);
  return result; // txid or error
}
```

> The exact wiring for attaching signatures depends on how you build the transaction and the chosen auth type. Check the `@stacks/transactions` docs for `StandardAuthorization` and `SpendingCondition` helpers.

## Functionality Details

- **Wallet and Address Management**
  - Use Turnkey to create/import a secp256k1 key
  - Derive Stacks addresses (SLIP-0044 coin type 5757) from public keys
- **Deterministic Signing**
  - Server-side signing via Turnkey; private keys never leave custody
  - Supports transaction bytes and message digests
- **Transactions**
  - Build Clarity contract calls and STX transfers
  - Attach Turnkey-generated signatures, then broadcast via Hiro API
- **Policy and Security**
  - Apply Turnkey policies (domains, rate limits, time windows)
  - Use server-only credentials and rotate keys regularly
- **Embeddable UX**
  - Wire these primitives into your UI (connect, sign, send) with minimal custom code

## API Surface (typical)

While the exact exports depend on your current version under `src/`, the SDK typically exposes helpers like:

- Network helpers to initialize mainnet/testnet
- Builders for common transaction types (STX transfer, contract call)
- Serialization utilities to move unsigned payloads to the backend
- Thin wrappers to request server-side signatures

Inspect `src/index.ts` and related modules for current exports and types.

## Building the SDK

```bash
pnpm install
pnpm build
```

This runs the TypeScript build and bundles outputs in `dist/` (both ESM and CJS if configured).

## Recommended Bundler Configuration (Rollup)

If you are bundling this SDK or an app that consumes it, ensure:

```js
// rollup.config.mjs (example)
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: [
    { file: "dist/cjs/index.js", format: "cjs", sourcemap: true },
    { file: "dist/esm/index.js", format: "esm", sourcemap: true },
  ],
  external: [
    /* your externals */
  ],
  plugins: [
    json(),
    resolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
  ],
};
```

Notes:

- `@rollup/plugin-json` is required for packages that import JSON tables (e.g., `tr46`)
- `preferBuiltins: false` avoids preferring Node built-ins over browser shims when bundling for the web

## Troubleshooting

- "Module level directives cause errors when bundled, 'use server' ignored"

  - The message originates from server-only libraries. Ensure server-only Turnkey code (`@turnkey/sdk-server`) runs on the server, not in the browser bundle.

- Circular dependency warnings from `@stacks/transactions`

  - These are known in the Stacks toolchain and generally safe. Keep packages up-to-date.

- "this has been rewritten to undefined" from `borsh` or similar

  - Typical when bundling ESM in strict mode. It’s a warning and usually safe.

- "preferring built-in module 'buffer' over local alternative"

  - When targeting browsers, set `resolve({ browser: true, preferBuiltins: false })`.

- "default is not exported by ... mappingTable.json"

  - Add `@rollup/plugin-json` to your Rollup config as shown above.

- TypeScript type mismatches during build

  - Ensure `tsconfig.json` `moduleResolution` is `bundler` or `node16` for mixed ESM/CJS deps.

- Using `@turnkey/sdk-server` in browsers
  - Avoid. Use it on the server. For browser interactions, create thin HTTP endpoints on your backend that proxy signing requests to Turnkey.

## Security Considerations

- Never ship server credentials to the client
- Apply Turnkey policies to restrict signing scope and rate
- Log signing requests, validate domains, and verify payload sizes
- Consider using detached signatures and perform verification before broadcasting

## Roadmap Ideas

- Higher-level react hooks/components for common UX flows
- Built-in fee estimation and mempool queries
- Ledger-style message framing for advanced signing

## Contributing

- Fork the repo and create a feature branch
- Run lint and tests before opening a PR
- Keep changes small and well-documented

## License

MIT
