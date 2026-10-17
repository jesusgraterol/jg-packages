// the options buildServiceWorker and writeServiceWorker accept
export type IBuildServiceWorkerOptions = {
  // the environment whose file the firebase-fcm template reads its Firebase config from: .env,
  // .env.staging, or .env.production. The firebase-fcm template requires it
  environment?: 'development' | 'staging' | 'production';

  // false leaves out precaching, cache cleanup, and the fetch handler, for development. Defaults
  // to true
  caching?: boolean;

  // the directory outDir and the environment files are resolved from. Defaults to process.cwd()
  cwd?: string;
};

// an environment buildServiceWorker accepts
export type IServiceWorkerEnvironment = NonNullable<IBuildServiceWorkerOptions['environment']>;
