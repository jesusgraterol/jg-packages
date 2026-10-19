# jg-docker recipes

Patterns for development scripts and test setups that use the Docker on the developer's own machine, and must never act on another one.

## Refusing to run against a remote Docker

Use this in a script that destroys local state, such as one that resets the app's development database by removing its volumes. A developer whose shell still points at a shared build server, through `DOCKER_HOST` or a `docker context use` they forgot, would wipe that server's volumes instead, so the script checks the endpoint first and sends every command to the one it checked:

```ts
import { ERRORS, resolveLocalDockerHost, runDocker } from 'jg-docker';
import { hasErrorCode } from 'jg-exception';

// the directory of the Compose project that runs the app's development database
declare const projectDirectory: string;

/**
 * Resolves the local endpoint, or explains what to change when Docker points elsewhere.
 */
const resolveHostOrExplain = async (): Promise<string> => {
  try {
    return await resolveLocalDockerHost({ timeoutSeconds: 10 });
  } catch (error) {
    if (hasErrorCode(error, ERRORS.DOCKER_ENDPOINT_NOT_LOCAL)) {
      throw new Error(
        'Docker points at another machine. Unset DOCKER_HOST, or run `docker context use default`.',
        { cause: error },
      );
    }
    throw error;
  }
};

export const resetDevelopmentDatabase = async (): Promise<void> => {
  const host = await resolveHostOrExplain();

  // both commands go to the endpoint just checked, even if the context changes meanwhile
  for (const args of [
    ['compose', 'down', '--volumes', '--remove-orphans'],
    ['compose', 'up', '--detach', '--wait'],
  ]) {
    const { exitCode } = await runDocker(args, {
      host,
      cwd: projectDirectory,
      timeoutSeconds: 300,
    });
    if (exitCode !== 0) {
      throw new Error(`docker ${args.join(' ')} exited with ${exitCode}.`);
    }
  }
};
```

`resolveLocalDockerHost` refuses a `tcp://` endpoint even on 127.0.0.1, because a forwarded port or an SSH tunnel can reach another machine, and only a Unix socket or a named pipe proves the daemon is local. Its error says whether `DOCKER_HOST` or the context was the problem, without the endpoint itself, which can name a user. `runDocker` resolves with the exit code rather than throwing, so the script decides what a failure means; a command that hangs, such as an image pull on a broken network, stops at `timeoutSeconds`.

## Checking a Compose stack before tests

Use this in a test suite's global setup, when the tests need services that a developer starts with `docker compose up`: each one must run exactly once, be healthy when it has a healthcheck, and publish its port on loopback only, so a test never talks to a stale second container or exposes a database to the network:

```ts
import { findPublicPorts, listComposeServices, resolveLocalDockerHost } from 'jg-docker';

// the services the tests connect to, and the directory of their Compose project
const REQUIRED_SERVICES = ['db', 'cache'];
declare const projectDirectory: string;

// the host port each service publishes, for the tests' connection strings
export const checkTestStack = async (): Promise<Map<string, number>> => {
  const host = await resolveLocalDockerHost();
  const services = await listComposeServices({
    cwd: projectDirectory,
    host,
    services: REQUIRED_SERVICES,
  });

  const problems: string[] = [];
  const ports = new Map<string, number>();
  for (const name of REQUIRED_SERVICES) {
    const [container, ...others] = services.filter(({ service }) => service === name);
    if (container === undefined || others.length > 0) {
      problems.push(
        `${name} has ${others.length + (container === undefined ? 0 : 1)} containers, not 1`,
      );
    } else if (container.state !== 'running' || !['', 'healthy'].includes(container.health)) {
      problems.push(
        `${name} is ${container.state}${container.health === '' ? '' : `, ${container.health}`}`,
      );
    } else {
      const published = container.publishers.find(({ publishedPort }) => publishedPort !== 0);
      if (published === undefined) {
        problems.push(`${name} publishes no port`);
      } else {
        ports.set(name, published.publishedPort);
      }
    }
  }
  for (const { service, url, publishedPort } of findPublicPorts(services)) {
    problems.push(`${service} publishes port ${publishedPort} on ${url}, not on 127.0.0.1`);
  }

  if (problems.length > 0) {
    throw new Error(
      `The test stack isn't ready: ${problems.join('; ')}. Run docker compose up --wait.`,
    );
  }
  return ports;
};
```

`listComposeServices` lists stopped containers too, so a service that crashed shows up as `exited` instead of disappearing, and `health` is `''` for a service without a healthcheck. A Compose file that publishes `6379:6379` without an address binds every interface, `0.0.0.0` and `::`, which `findPublicPorts` reports as two ports; write `127.0.0.1:6379:6379` instead.
