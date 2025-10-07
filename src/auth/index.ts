import {
  Attestation,
  Email,
  EmailParam,
  OauthProviderParams,
  OidcTokenParam,
  PublicKeyParam,
  UsernameParam,
} from "./types";
import Base from "../base";
import { publicKeyToAddress } from "@stacks/transactions";
import { decode, JwtPayload } from "jsonwebtoken";
import { WalletType } from "@turnkey/wallet-stamper";

export default class Auth extends Base {
  /**
   * Derive a Stacks address from a public key
   * @param turnkeyWalletAddress - The public key is turnkey wallet address
   * @returns The Stacks address
   */
  public async deriveStacksAddressFromTurnkeyAddress(
    turnkeyWalletAddress: string
  ): Promise<string> {
    return publicKeyToAddress(turnkeyWalletAddress, this.getNetwork());
  }

  /**
   * Decode a JWT
   * @param credential - The credential
   * @returns The decoded JWT
   */

  public decodeJwt(credential: string): JwtPayload | null {
    const decoded = decode(credential);

    if (decoded && typeof decoded === "object" && "email" in decoded) {
      return decoded as JwtPayload;
    }

    return null;
  }

  /**
   * Create a sub organization
   * @param email - The email of the user
   * @param passkey - The passkey of the user
   * @param oauth - The oauth provider of the user
   * @param wallet - The wallet of the user
   * @returns The sub organization
   */

  public async createUserSubOrg({
    email,
    passkey,
    oauth,
    wallet,
  }: {
    email?: EmailParam | string;
    passkey?: {
      challenge: string;
      attestation: Attestation;
    };
    oauth?: OauthProviderParams;
    wallet?: {
      publicKey: string;
      type: WalletType;
    };
  }) {
    const authenticators = passkey
      ? [
          {
            authenticatorName: "Passkey",
            challenge: passkey.challenge,
            attestation: passkey.attestation,
          },
        ]
      : [];

    const oauthProviders = oauth
      ? [
          {
            providerName: oauth.providerName,
            oidcToken: oauth.oidcToken,
          },
        ]
      : [];

    const apiKeys = wallet
      ? [
          {
            apiKeyName: "Wallet Auth - Embedded Wallet",
            publicKey: wallet.publicKey,
            curveType: "API_KEY_CURVE_SECP256K1" as const,
          },
        ]
      : [];

    let userEmail = email;
    // If the user is logging in with a Google Auth credential, use the email from the decoded OIDC token (credential
    // Otherwise, use the email from the email parameter
    if (oauth) {
      const decoded = this.decodeJwt(oauth.oidcToken);
      if (decoded?.email) {
        userEmail = decoded.email;
      }
    }
    const subOrganizationName = `Sub Org - ${email}`;
    const userName = email ? email.toString().split("@")?.[0] || email : "";

    const subOrg = await this.getClient()
      .apiClient()
      .createSubOrganization({
        organizationId: this.getDefaultOrganizationId(),
        subOrganizationName,
        rootUsers: [
          {
            userName: userName.toString() || "",
            userEmail: userEmail ? userEmail.toString() : "",
            oauthProviders,
            authenticators,
            apiKeys,
          },
        ],
        rootQuorumThreshold: 1,
        wallet: {
          walletName: "Default Wallet",
          accounts: [
            {
              curve: "CURVE_SECP256K1",
              pathFormat: "PATH_FORMAT_BIP32",
              path: "m/44'/5'/0'/0/0",
              addressFormat: "ADDRESS_FORMAT_UNCOMPRESSED",
            },
          ],
        },
      });
    const userId = subOrg.rootUserIds?.[0];
    if (!userId) {
      throw new Error("No root user ID found");
    }
    const { user } = await this.getClient().apiClient().getUser({
      organizationId: subOrg.subOrganizationId,
      userId,
    });

    return { subOrg, user };
  }

  /**
   * OAuth login
   * @param credential - The credential
   * @param publicKey - The public key
   * @param subOrgId - The sub organization ID
   * @returns The user ID
   */
  public async oauth({
    credential,
    publicKey,
    subOrgId,
  }: {
    credential: string;
    publicKey: string;
    subOrgId: string;
  }): Promise<{ userId: string; session: string; organizationId: string }> {
    const oauthResponse = await this.getClient().apiClient().oauthLogin({
      oidcToken: credential,
      publicKey,
      organizationId: subOrgId,
    });
    return {
      userId: oauthResponse.activity.votes?.[0]?.userId,
      session: oauthResponse.session,
      organizationId: subOrgId,
    };
  }

  /**
   * Get the magic link template
   * @param action - The action
   * @param email - The email
   * @param method - The method
   * @param publicKey - The public key
   * @param baseUrl - The base URL
   * @returns The magic link template
   */
  public async getMagicLinkTemplate({
    action,
    email,
    method,
    publicKey,
    baseUrl,
  }: {
    action: string;
    email: string;
    method: string;
    publicKey: string;
    baseUrl: string;
  }) {
    return `${baseUrl}/email-${action}?userEmail=${email}&continueWith=${method}&publicKey=${publicKey}&credentialBundle=%s`;
  }

  /**
   * Initiate email authentication
   * @param email - The email
   * @param targetPublicKey - The target public key
   * @param baseUrl - The base URL
   * @returns The magic link template
   */
  public async initEmailAuth({
    email,
    targetPublicKey,
    baseUrl,
  }: {
    email: string;
    targetPublicKey: string;
    baseUrl?: string;
  }) {
    let organizationId = await this.getSubOrgIdByEmail(email);
    if (!organizationId) {
      const { subOrg } = await this.createUserSubOrg({
        email,
      });
      organizationId = subOrg.subOrganizationId;
    }

    const magicLinkTemplate = this.getMagicLinkTemplate({
      action: "auth",
      email,
      method: "email",
      publicKey: targetPublicKey,
      baseUrl: baseUrl!,
    });

    if (organizationId?.length) {
      const authResponse = await this.getClient()
        .apiClient()
        .initOtp({
          userIdentifier: targetPublicKey,
          otpType: "EMAIL",
          contact: email,
          emailCustomization: {
            appName: "Stacks Embed",
            logoUrl: "https://turnkey.com/logo.png",
          },
        });
      return authResponse;
    }
  }

  /**
   * Verify OTP
   * @param otpId - The OTP ID
   * @param otpCode - The OTP code
   * @returns The OTP response
   */
  public async verifyOtp({
    otpId,
    otpCode,
    publicKey,
  }: {
    otpId: string;
    otpCode: string;
    publicKey: string;
  }) {
    const authResponse = await this.getClient().apiClient().verifyOtp({
      otpId,
      otpCode,
    });

    return authResponse;
  }

  /**
   * OTP login
   * @param publicKey - The public key
   * @param verificationToken - The verification token
   * @param email - The email
   * @returns The OTP response
   */
  public async otpLogin({
    publicKey,
    verificationToken,
    email,
  }: {
    publicKey: string;
    verificationToken: string;
    email: Email;
  }) {
    const subOrgId = await this.getSubOrgIdByEmail(email);

    if (!subOrgId) {
      throw new Error("Could not find suborg by email");
    }

    const sessionResponse = await this.getClient().apiClient().otpLogin({
      verificationToken,
      publicKey,
      organizationId: subOrgId,
    });

    return {
      userId: sessionResponse.activity.votes[0]?.userId,
      session: sessionResponse.session,
      organizationId: subOrgId,
    };
  }

  /**
   * Get the sub organization ID for a user
   * @param param - The user parameter
   * @returns The sub organization ID
   */

  public async getSubOrgId(
    param: EmailParam | PublicKeyParam | UsernameParam | OidcTokenParam
  ): Promise<string> {
    let filterType: string;
    let filterValue: string;

    if ("email" in param) {
      filterType = "EMAIL";
      filterValue = param.email;
    } else if ("publicKey" in param) {
      filterType = "PUBLIC_KEY";
      filterValue = param.publicKey;
    } else if ("username" in param) {
      filterType = "USERNAME";
      filterValue = param.username;
    } else if ("oidcToken" in param) {
      filterType = "OIDC_TOKEN";
      filterValue = param.oidcToken;
    } else {
      throw new Error("Invalid parameter");
    }

    const { organizationIds } = await this.getClient()
      .apiClient()
      .getSubOrgIds({
        organizationId: this.getDefaultOrganizationId(),
        filterType,
        filterValue,
      });

    return organizationIds[0];
  }

  /**
   * Get the sub organization ID for a user by email
   * @param email - The user email
   * @returns The sub organization ID
   */
  public getSubOrgIdByEmail(email: string) {
    return this.getSubOrgId({ email });
  }

  /**
   * Get the sub organization ID for a user by public key
   * @param publicKey - The user public key
   * @returns The sub organization ID
   */
  public getSubOrgIdByPublicKey(publicKey: string) {
    return this.getSubOrgId({ publicKey });
  }

  /**
   * Get the sub organization ID for a user by username
   * @param username - The user username
   * @returns The sub organization ID
   */
  public getSubOrgIdByUsername(username: string) {
    return this.getSubOrgId({ username });
  }

  /**
   * Get the user
   * @param userId - The user ID
   * @param subOrgId - The sub organization ID
   * @returns The user
   */
  public async getUser(userId: string, subOrgId: string) {
    return this.getClient().apiClient().getUser({
      organizationId: subOrgId,
      userId,
    });
  }

  /**
   * Get the wallet
   * @param walletId - The wallet ID
   * @param subOrgId - The sub organization ID
   * @returns The wallet
   */
  public async getWallet({
    walletId,
    subOrgId,
  }: {
    walletId: string;
    subOrgId: string;
  }) {
    const { wallet } = await this.getClient().apiClient().getWallet({
      walletId,
      organizationId: subOrgId,
    });

    const { accounts } = await this.getClient().apiClient().getWalletAccounts({
      walletId,
      organizationId: subOrgId,
    });

    const accountsWithAddresses = accounts.map((account) => {
      return {
        ...account,
        address: this.deriveStacksAddressFromTurnkeyAddress(account.address),
      };
    });

    return {
      wallet,
      accounts: accountsWithAddresses,
    };
  }

  /**
   * Get the authenticators for a user
   * @param userId - The user ID
   * @param subOrgId - The sub organization ID
   * @returns The authenticators
   */
  public async getAuthenticators({
    userId,
    subOrgId,
  }: {
    userId: string;
    subOrgId: string;
  }) {
    const { authenticators } = await this.getClient()
      .apiClient()
      .getAuthenticators({
        organizationId: subOrgId,
        userId,
      });
    return authenticators;
  }

  /**
   * Get the authenticator for a user
   * @param authenticatorId - The authenticator ID
   * @param subOrgId - The sub organization ID
   * @returns The authenticator
   */
  public async getAuthenticator({
    authenticatorId,
    subOrgId,
  }: {
    authenticatorId: string;
    subOrgId: string;
  }) {
    const { authenticator } = await this.getClient()
      .apiClient()
      .getAuthenticator({
        organizationId: subOrgId,
        authenticatorId,
      });
    return authenticator;
  }
}
