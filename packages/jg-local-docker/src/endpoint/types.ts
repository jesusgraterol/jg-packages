// what resolveLocalDockerHost takes
export type IResolveLocalDockerHostOptions = {
  // the environment DOCKER_HOST is read from and docker runs with. Defaults to process.env
  env?: NodeJS.ProcessEnv | undefined;

  // the seconds `docker context inspect` may run. Defaults to 30
  timeoutSeconds?: number | undefined;

  // stops the command when it aborts
  signal?: AbortSignal | undefined;
};
