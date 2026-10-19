/*
 * The fields `docker inspect` writes, as one JSON object: never the environment, the command, or
 * the mounts, which can hold secrets. The state and the labels are read whole, because a template
 * fails on a key a container doesn't have, such as `.State.Health` without a healthcheck, and the
 * labels are narrowed to the keys asked for, so no caller value enters the template.
 */
export const INSPECT_TEMPLATE =
  '{"id":{{json .Id}},"name":{{json .Name}},"state":{{json .State}},' +
  '"labels":{{json .Config.Labels}},"ports":{{json .NetworkSettings.Ports}}}';

// a label key, as Docker's naming guidance allows
export const LABEL_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

// a container port's key in `docker inspect` output, such as '6379/tcp'
export const PORT_KEY_PATTERN = /^(\d+)\/([a-z]+)$/;

// what Docker writes to stderr for a container that doesn't exist
export const NOT_FOUND_PATTERN = /No such (?:container|object)/i;
