// a port a Compose service's container publishes, from `docker compose ps`
export type IComposePublisher = {
  // the host address the port is published on, such as '127.0.0.1', or '' when it isn't
  url: string;

  // the port inside the container
  targetPort: number;

  // the port on the host, or 0 when the port is only exposed to other containers
  publishedPort: number;

  // 'tcp', 'udp', or 'sctp'
  protocol: string;
};

// a Compose service's container, from `docker compose ps --format json`
export type IComposeService = {
  // the container's full ID
  id: string;

  // the container's name, such as 'app-db-1'
  name: string;

  // the service's name in the Compose file
  service: string;

  // the Compose project's name
  project: string;

  // the container's state, such as 'running', 'exited', or 'restarting'
  state: string;

  // the healthcheck's status, such as 'healthy', or '' without a healthcheck
  health: string;

  // the exit code of a container that stopped
  exitCode: number;

  // the ports the container publishes or exposes
  publishers: IComposePublisher[];
};

// a port a service publishes on an address other than a loopback one
export type IPublicPort = IComposePublisher & {
  // the service's name in the Compose file
  service: string;

  // the container's name
  name: string;
};

// what listComposeServices takes
export type IListComposeServicesOptions = {
  // the Compose project's directory, where its compose.yaml is
  cwd: string;

  // the Docker endpoint, such as the one resolveLocalDockerHost gives
  host: string;

  // the project's name, instead of the one Compose derives from the directory
  projectName?: string | undefined;

  // the profiles to enable, for services that belong to one
  profiles?: readonly string[] | undefined;

  // the services to list. Defaults to every one
  services?: readonly string[] | undefined;

  // whether stopped containers are listed too. Defaults to true
  all?: boolean | undefined;

  // the environment docker runs with. Defaults to process.env
  env?: NodeJS.ProcessEnv | undefined;

  // the seconds the command may run. Defaults to 30
  timeoutSeconds?: number | undefined;

  // stops the command when it aborts
  signal?: AbortSignal | undefined;
};
