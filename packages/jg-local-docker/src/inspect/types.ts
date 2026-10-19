// a container port published on the host
export type IContainerPort = {
  // the port inside the container
  containerPort: number;

  // 'tcp', 'udp', or 'sctp'
  protocol: string;

  // the host address it's published on, such as '127.0.0.1' or '0.0.0.0'
  hostIp: string;

  // the port on the host
  hostPort: number;
};

// what inspectContainer gives
export type IContainerInspection = {
  // the container's full ID
  id: string;

  // the container's name, without Docker's leading '/'
  name: string;

  // whether it's running
  isRunning: boolean;

  // the healthcheck's status, such as 'healthy' or 'starting', or null without a healthcheck
  health: string | null;

  // the value of each label asked for, or null when the container doesn't have it
  labels: Record<string, string | null>;

  // the ports published on the host; a port only exposed to other containers isn't one
  ports: IContainerPort[];
};

// what inspectContainer takes
export type IInspectContainerOptions = {
  // the Docker endpoint, such as the one resolveLocalDockerHost gives
  host: string;

  // the label keys to read, such as 'com.docker.compose.project'
  labels?: readonly string[] | undefined;

  // the environment docker runs with. Defaults to process.env
  env?: NodeJS.ProcessEnv | undefined;

  // the seconds the command may run. Defaults to 30
  timeoutSeconds?: number | undefined;

  // stops the command when it aborts
  signal?: AbortSignal | undefined;
};
