import type { IContainerInspection } from '../inspect/index.js';

// what startContainer and startOwnedContainer take
export type IStartContainerOptions = {
  // the Docker endpoint, such as the one resolveLocalDockerHost gives
  host: string;

  // the container's name, which removeContainer finds it by
  name: string;

  // the labels that prove the container is this caller's, such as a random nonce; at least one
  labels: Readonly<Record<string, string>>;

  // the image, such as 'redis:8.6.2-alpine'
  image: string;

  // the container's TCP ports to publish, each on a random port of 127.0.0.1
  ports: readonly number[];

  // more `docker create` arguments, before the image, such as ['--memory', '256m']
  createArgs?: readonly string[] | undefined;

  // the command and its arguments, after the image
  command?: readonly string[] | undefined;

  // the environment docker runs with. Defaults to process.env
  env?: NodeJS.ProcessEnv | undefined;

  // the seconds each docker command may run. Defaults to 30
  timeoutSeconds?: number | undefined;

  // stops the start when it aborts; a container already created is removed
  signal?: AbortSignal | undefined;
};

// what removeContainer takes
export type IRemoveContainerOptions = {
  // the Docker endpoint, such as the one resolveLocalDockerHost gives
  host: string;

  // the labels the container must have, every one with the same value; at least one
  labels: Readonly<Record<string, string>>;

  // the environment docker runs with. Defaults to process.env
  env?: NodeJS.ProcessEnv | undefined;

  // the seconds each docker command may run. Defaults to 30
  timeoutSeconds?: number | undefined;

  // stops the removal when it aborts
  signal?: AbortSignal | undefined;
};

// what startOwnedContainer gives: the running container, and the function that removes it
export type IOwnedContainer = {
  // the container, as inspectContainer reads it once it's running
  container: IContainerInspection;

  // removes the container and waits for its owner process to exit
  release: () => Promise<void>;
};
