export type Wallet = {
  walletId: string;
  addresses: string[];
  activity: {
    id: string;
    organizationId: string;
    status: string;
    type: string;
    intent: object;
    result: object;
    votes: object[];
    appProofs: object[];
    fingerprint: string;
    canApprove: boolean;
    canReject: boolean;
    createdAt: Date;
    updatedAt: Date;
    failure: null | object;
  };
};

export type User = {
  userId: string;
  userName: string;
  userEmail: string;
  authenticators: [];
  apiKeys: [];
  userTags: [];
  oauthProviders: [];
  createdAt: { seconds: string; nanos: string };
  updatedAt: { seconds: string; nanos: string };
};

export type SubOrg = {
  subOrganizationId: string;
  wallet: {
    walletId: string;
    addresses: [string];
  };
  rootUserIds: string[];
  activity: {
    id: string;
    organizationId: string;
    status: string;
    type: string;
    intent: { createSubOrganizationIntentV7: [object] };
    result: { createSubOrganizationResultV7: [object] };
    votes: [[object]];
    appProofs: [];
    fingerprint: string;
    canApprove: false;
    canReject: true;
    createdAt: { seconds: string; nanos: string };
    updatedAt: { seconds: string; nanos: string };
    failure: null;
  };
};
