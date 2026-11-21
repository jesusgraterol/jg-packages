// npm and pnpm have tested, shell-free install commands and script refusal
export type IPackedConsumerManager = 'npm' | 'pnpm';

// the temporary ESM project and the environment for commands run in it
export type IPackedConsumer = {
  directory: string;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
};

// setup options for one temporary consumer
export type IPackedConsumerOptions = {
  packageManager: IPackedConsumerManager;
  tarballs: string[];
  additionalPackages?: string[];
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  installTimeoutSeconds?: number;
  offline?: boolean;
  prepare?: (consumer: IPackedConsumer) => Promise<void>;
};
