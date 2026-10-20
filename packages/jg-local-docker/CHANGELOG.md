# Changelog

## 0.3.0

### Added

- `startContainer({ host, name, labels, image, ports, createArgs?, command?, env?, timeoutSeconds?, signal? })`, which creates and starts a container with its ports on random ports of `127.0.0.1`, and reads it back with `inspectContainer`: it must be the container created, with the name and every label, and publish each port exactly once on `127.0.0.1`, or it throws `DOCKER_CONTAINER_NOT_OWNED` or `DOCKER_PORTS_NOT_LOOPBACK`. Any failure after the creation removes the container.
- `removeContainer(name, { host, labels, env?, timeoutSeconds?, signal? })`, which removes a container only when it has the exact name and every label, throwing `DOCKER_CONTAINER_NOT_OWNED` otherwise, and confirms it's gone. It resolves to false when there was no container.
- `startOwnedContainer(options)`, `startContainer` through an owner process that removes the container on `release`, when the calling process exits or crashes, and on SIGINT and SIGTERM. A failing owner throws `DOCKER_OWNER_FAILED`.
- `IStartContainerOptions`, `IRemoveContainerOptions`, and `IOwnedContainer`.
- A recipe for a container that lasts one test run.

## 0.2.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

## 0.1.0

### Added

- `resolveLocalDockerHost({ env, timeoutSeconds, signal })`, which gives the endpoint Docker would use after checking that it's on this machine: `DOCKER_HOST`, when set, and the current context's endpoint, which must match it, must each be a Unix socket or a named pipe, or it throws `DOCKER_ENDPOINT_NOT_LOCAL`. `isLocalDockerEndpoint(host)` is the check on its own.
- `runDocker(args, options)`, which runs `docker` through jg-process's `runProcess` with `--host` first, so a context switch can't redirect a command after the check. It resolves with any exit code, within a 30-second timeout and a 64 KiB output limit by default.
- `listComposeServices(options)` and `parseComposePs(stdout)`, the containers of a Compose project from `docker compose ps --format json`, read as one JSON object per line or one array, and `findPublicPorts(services)`, the ports published on an address other than `127.0.0.1` or `::1`.
- `inspectContainer(ref, options)`, a container's ID, name, state, health, the labels asked for, and published ports, through a fixed template that never reads its environment, command, mounts, or logs. A missing container throws `DOCKER_CONTAINER_NOT_FOUND`.
- `DOCKER_NOT_FOUND`, `DOCKER_COMMAND_FAILED`, `DOCKER_OUTPUT_INVALID`, and `DOCKER_INVALID_ARGUMENT`.
- Recipes for refusing to run against a remote Docker and checking a Compose stack before tests.
