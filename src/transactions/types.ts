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
