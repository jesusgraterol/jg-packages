# jg-docker

Checks for Node.js scripts that Docker is local before using it, plus Compose service and container reads with loopback-only ports.

## Install

```bash
npm install jg-docker
```

The `docker` command must be on the `PATH`, with Compose v2 or later for the Compose helpers.

## Usage

Resolve the endpoint once, check that it's on this machine, and pin every later command to it:

```ts
import { listComposeServices, resolveLocalDockerHost, runDocker } from 'jg-docker';

const host = await resolveLocalDockerHost(); // such as 'unix:///var/run/docker.sock'
await runDocker(['compose', 'up', '--detach', '--wait'], {
  host,
  cwd: '/srv/app',
  timeoutSeconds: 300,
});
const services = await listComposeServices({ cwd: '/srv/app', host });
```

`resolveLocalDockerHost` accepts only a Unix socket (`unix://`) or a Windows named pipe (`npipe://`): `DOCKER_HOST` when it's set, and the current context's endpoint, which must match it. A `tcp://` endpoint is refused even on 127.0.0.1, because a forwarded port or a tunnel can reach another machine, and so is `ssh://`. Either throws `DOCKER_ENDPOINT_NOT_LOCAL` before the script sends anything to the daemon. `runDocker` passes the endpoint as `--host` first, so a `docker context use` between the check and a later command can't send that command somewhere else.

Check that a Compose stack publishes its ports on loopback only:

```ts
import { findPublicPorts, listComposeServices } from 'jg-docker';

declare const host: string;

for (const { service, url, publishedPort } of findPublicPorts(
  await listComposeServices({ cwd: '/srv/app', host }),
)) {
  console.error(`${service} publishes port ${publishedPort} on ${url}`);
}
```

`findPublicPorts` flags a port published on any address but `127.0.0.1` or `::1`, such as both halves of a port on `0.0.0.0` and `::`, and ignores a port only exposed to other containers. `listComposeServices` runs `docker compose ps --format json`, stopped containers included unless `all` is `false`, and `parseComposePs` reads that output when you run the command yourself, as one JSON object per line or one array.

Read one container's state, labels, and published ports:

```ts
import { inspectContainer } from 'jg-docker';

declare const host: string;

const cache = await inspectContainer('app-cache-1', {
  host,
  labels: ['com.docker.compose.project'],
});
// { id, name: 'app-cache-1', isRunning: true, health: 'healthy',
//   labels: { 'com.docker.compose.project': 'app' },
//   ports: [{ containerPort: 6379, protocol: 'tcp', hostIp: '127.0.0.1', hostPort: 6380 }] }
```

`inspectContainer` uses a fixed template that never reads the container's environment, command, mounts, or logs, which can hold secrets. A label the container doesn't have reads as `null`, and a container without a healthcheck has a `null` health.

Every command runs without a shell, within a 30-second timeout and a 64 KiB output limit unless you pass others, which reject with jg-process's `PROCESS_TIMED_OUT` and `PROCESS_OUTPUT_TOO_LARGE`. `runDocker` resolves with any exit code; the other helpers throw `DOCKER_COMMAND_FAILED` on a non-zero one.

### Errors

| Code                         | When                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `DOCKER_NOT_FOUND`           | `docker` isn't on the `PATH`                                                                                                   |
| `DOCKER_ENDPOINT_NOT_LOCAL`  | `DOCKER_HOST` or the current context names an endpoint that isn't a Unix socket or a named pipe, or the two differ             |
| `DOCKER_COMMAND_FAILED`      | A helper's command exits with another code than 0                                                                              |
| `DOCKER_OUTPUT_INVALID`      | Docker's output isn't in the expected format                                                                                   |
| `DOCKER_CONTAINER_NOT_FOUND` | The container `inspectContainer` reads doesn't exist                                                                           |
| `DOCKER_INVALID_ARGUMENT`    | An argument isn't valid, such as an empty endpoint, a working directory that doesn't exist, or a service name that's an option |

`DOCKER_ENDPOINT_NOT_LOCAL`'s data says where the endpoint came from, `DOCKER_HOST` or `context`, never the endpoint, which can name a user. `DOCKER_COMMAND_FAILED`'s data holds the subcommand and the exit code, never stderr, because Compose's diagnostics can quote the project's configuration. jg-process's `PROCESS_START_FAILED`, `PROCESS_TIMED_OUT`, `PROCESS_OUTPUT_TOO_LARGE`, and `PROCESS_TREE_SURVIVED` pass through, and an aborted `signal` rejects with its reason.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-docker/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-docker/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-docker/LICENSE)
