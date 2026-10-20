// error codes
export { ERRORS } from './shared/index.js';

// docker commands
export {
  DEFAULT_DOCKER_MAX_OUTPUT_BYTES,
  DEFAULT_DOCKER_TIMEOUT_SECONDS,
  type IRunDockerOptions,
  runDocker,
} from './run-docker/index.js';

// endpoints
export {
  type IResolveLocalDockerHostOptions,
  isLocalDockerEndpoint,
  resolveLocalDockerHost,
} from './endpoint/index.js';

// compose
export {
  type IComposePublisher,
  type IComposeService,
  type IListComposeServicesOptions,
  type IPublicPort,
  findPublicPorts,
  listComposeServices,
  parseComposePs,
} from './compose/index.js';

// containers
export {
  type IContainerInspection,
  type IContainerPort,
  type IInspectContainerOptions,
  inspectContainer,
} from './inspect/index.js';

// container lifecycles
export {
  type IOwnedContainer,
  type IRemoveContainerOptions,
  type IStartContainerOptions,
  removeContainer,
  startContainer,
  startOwnedContainer,
} from './container/index.js';
