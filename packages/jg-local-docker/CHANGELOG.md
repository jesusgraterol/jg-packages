# Changelog

## 0.1.0

### Added

- `resolveLocalDockerHost({ env, timeoutSeconds, signal })`, which gives the endpoint Docker would use after checking that it's on this machine: `DOCKER_HOST`, when set, and the current context's endpoint, which must match it, must each be a Unix socket or a named pipe, or it throws `DOCKER_ENDPOINT_NOT_LOCAL`. `isLocalDockerEndpoint(host)` is the check on its own.
- `runDocker(args, options)`, which runs `docker` through jg-process's `runProcess` with `--host` first, so a context switch can't redirect a command after the check. It resolves with any exit code, within a 30-second timeout and a 64 KiB output limit by default.
- `listComposeServices(options)` and `parseComposePs(stdout)`, the containers of a Compose project from `docker compose ps --format json`, read as one JSON object per line or one array, and `findPublicPorts(services)`, the ports published on an address other than `127.0.0.1` or `::1`.
- `inspectContainer(ref, options)`, a container's ID, name, state, health, the labels asked for, and published ports, through a fixed template that never reads its environment, command, mounts, or logs. A missing container throws `DOCKER_CONTAINER_NOT_FOUND`.
- `DOCKER_NOT_FOUND`, `DOCKER_COMMAND_FAILED`, `DOCKER_OUTPUT_INVALID`, and `DOCKER_INVALID_ARGUMENT`.
- Recipes for refusing to run against a remote Docker and checking a Compose stack before tests.
