// what runDocker takes
export type IRunDockerOptions = {
  // the Docker endpoint every command goes to, passed as --host, such as the one
  // resolveLocalDockerHost gives. Without it, Docker uses DOCKER_HOST or the current context
  host?: string | undefined;

  // the directory docker runs in, such as a Compose project's
  cwd?: string | undefined;

  // the environment docker runs with. Defaults to process.env
  env?: NodeJS.ProcessEnv | undefined;

  // the seconds the command may run before it's stopped. Defaults to 30
  timeoutSeconds?: number | undefined;

  // the bytes stdout and stderr may hold together. Defaults to 64 KiB
  maxOutputBytes?: number | undefined;

  // stops the command when it aborts
  signal?: AbortSignal | undefined;
};
