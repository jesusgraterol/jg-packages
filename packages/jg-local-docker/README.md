# jg-local-docker

Checks for Node.js scripts that Docker is local before using it, plus Compose service and container reads with loopback-only ports.

## Install

```bash
npm install jg-local-docker
```

The `docker` command must be on the `PATH`, with Compose v2 or later for the Compose helpers.

## Usage

Resolve the endpoint once, check that it's on this machine, and pin every later command to it:

```ts
import { listComposeServices, resolveLocalDockerHost, runDocker } from 'jg-local-docker';

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
import { findPublicPorts, listComposeServices } from 'jg-local-docker';

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
import { inspectContainer } from 'jg-local-docker';

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

Start a container a script owns, such as a test database, and remove it afterwards:

```ts
import { randomUUID } from 'node:crypto';
import { removeContainer, startContainer } from 'jg-local-docker';

declare const host: string;

const name = `app-test-redis-${randomUUID()}`;
const labels = { 'app.test.nonce': randomUUID() };
const redis = await startContainer({
  host,
  name,
  labels,
  image: 'redis:8.6.2-alpine',
  ports: [6379],
});
// ... use 127.0.0.1 and redis.ports[0]?.hostPort
await removeContainer(name, { host, labels });
```

`startContainer` creates the container with its name, its labels, and each port published on a random port of `127.0.0.1`, starts it, and reads it back: it must be the container created, with the name and every label, and publish each port exactly once on `127.0.0.1` and nothing else, or it throws `DOCKER_CONTAINER_NOT_OWNED` or `DOCKER_PORTS_NOT_LOOPBACK`. `createArgs` adds `docker create` arguments, such as `['--memory', '256m']`, and `command` the arguments after the image. Any failure after the creation, an aborted `signal` included, removes the container before the error is thrown. `removeContainer` removes a container only when it has the exact name and every label given, so a random label, such as a nonce, proves it's yours: it stops it, removes it with its anonymous volumes, and confirms it's gone, resolving to `false` when there was none.

`startOwnedContainer` does the same through an owner process, which removes the container when `release` is called, when your process exits or crashes, and on SIGINT and SIGTERM, which Ctrl+C sends the whole process group:

```ts
import { startOwnedContainer } from 'jg-local-docker';

declare const host: string;

const { container, release } = await startOwnedContainer({
  host,
  name: 'app-test-redis',
  labels: { 'app.test.nonce': crypto.randomUUID() },
  image: 'redis:8.6.2-alpine',
  ports: [6379],
});
// ... the tests
await release(); // removes the container, and waits for the owner to exit
```

The owner creates the container itself, so it knows the container's ID from the first moment, and removes that container only. Use it in a test runner's global setup, which may exit at once on Ctrl+C, so no run leaves a container behind. `release` throws `DOCKER_OWNER_FAILED` when the owner couldn't confirm the removal.

Every command runs without a shell, within a 30-second timeout and a 64 KiB output limit unless you pass others, which reject with jg-process's `PROCESS_TIMED_OUT` and `PROCESS_OUTPUT_TOO_LARGE`. `runDocker` resolves with any exit code; the other helpers throw `DOCKER_COMMAND_FAILED` on a non-zero one.

### Errors

| Code                         | When                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DOCKER_NOT_FOUND`           | `docker` isn't on the `PATH`                                                                                                                           |
| `DOCKER_ENDPOINT_NOT_LOCAL`  | `DOCKER_HOST` or the current context names an endpoint that isn't a Unix socket or a named pipe, or the two differ                                     |
| `DOCKER_COMMAND_FAILED`      | A helper's command exits with another code than 0                                                                                                      |
| `DOCKER_OUTPUT_INVALID`      | Docker's output isn't in the expected format                                                                                                           |
| `DOCKER_CONTAINER_NOT_FOUND` | The container `inspectContainer` reads doesn't exist                                                                                                   |
| `DOCKER_INVALID_ARGUMENT`    | An argument isn't valid, such as an empty endpoint, a working directory that doesn't exist, or a service name that's an option                         |
| `DOCKER_CONTAINER_NOT_OWNED` | The container `removeContainer` found, or `startContainer` started, doesn't have the name and every label given                                        |
| `DOCKER_PORTS_NOT_LOOPBACK`  | A container `startContainer` started doesn't publish each port exactly once on `127.0.0.1`, such as when `createArgs` publishes another, or it stopped |
| `DOCKER_OWNER_FAILED`        | `startOwnedContainer`'s owner process failed to start, or exited without confirming the container's removal                                            |

`DOCKER_ENDPOINT_NOT_LOCAL`'s data says where the endpoint came from, `DOCKER_HOST` or `context`, never the endpoint, which can name a user. `DOCKER_COMMAND_FAILED`'s data holds the subcommand and the exit code, never stderr, because Compose's diagnostics can quote the project's configuration. jg-process's `PROCESS_START_FAILED`, `PROCESS_TIMED_OUT`, `PROCESS_OUTPUT_TOO_LARGE`, and `PROCESS_TREE_SURVIVED` pass through, and an aborted `signal` rejects with its reason.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-local-docker/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-local-docker/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-local-docker/LICENSE)
