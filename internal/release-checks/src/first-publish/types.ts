import type { IReleaseManifestEntry } from '../shared/types.ts';

export type IReleaseIdentity = {
  sourceCommit: string;
  manifestSha256: string;
};

export type IStageEvidence = {
  id: string;
  tarball: string;
};

export type IFirstPublishOptions = IReleaseIdentity & {
  packages: string[];
  releaseCheckout?: string;
  retryUncertain?: string;
  stage?: IStageEvidence;
};

export type IFirstPublishAttempt = IReleaseManifestEntry & {
  isPublished: boolean;
  requiresStageEvidence: boolean;
  stageId?: string;
};

export type IFirstPublishState = IReleaseIdentity & {
  attempts: IFirstPublishAttempt[];
};
