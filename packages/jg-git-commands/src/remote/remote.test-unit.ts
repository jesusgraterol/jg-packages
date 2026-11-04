// @vitest-environment node
import { expect, test } from 'vitest';

import { parseRemoteRepository } from './remote.js';

test.each([
  ['git@github.com:acme-labs/platform.git', 'acme-labs', 'platform'],
  ['git@github.com:acme-labs/platform', 'acme-labs', 'platform'],
  ['https://github.com/jesusgraterol/jg-agent-hq.git', 'jesusgraterol', 'jg-agent-hq'],
  ['https://github.com/jesusgraterol/jg-agent-hq', 'jesusgraterol', 'jg-agent-hq'],
  ['https://github.com/jesusgraterol/jg-agent-hq/', 'jesusgraterol', 'jg-agent-hq'],
  ['ssh://git@github.com/acme-labs/platform.git', 'acme-labs', 'platform'],
  ['ssh://git@git.example.com:2222/acme-labs/platform.git', 'acme-labs', 'platform'],
  ['git@example.com:org/.github.git', 'org', '.github'],
  ['git@github.com:Org/App.git', 'Org', 'App'],
  ['git@github.com:org/repo.git.git', 'org', 'repo.git'],
])('parseRemoteRepository(%s) -> %s/%s', (url, owner, name) => {
  expect(parseRemoteRepository(url)).toStrictEqual({ owner, name });
});

test.each([
  ['https://github.com/group/sub/platform.git'],
  ['https://user:token@github.com/acme-labs/platform.git'],
  ['../platform'],
  ['/srv/repositories/platform.git'],
  ['file:///srv/repositories/platform.git'],
  ['git@github.com:acme labs/platform.git'],
  ['git@github.com:platform.git'],
  ['https://github.com/acme-labs/.git'],
  [''],
])('parseRemoteRepository(%s) -> null', (url) => {
  expect(parseRemoteRepository(url)).toBeNull();
});
