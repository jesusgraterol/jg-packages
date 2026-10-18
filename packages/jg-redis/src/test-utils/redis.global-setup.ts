import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';

// the image Moldea runs, so the tests run against the server it uses
const REDIS_IMAGE = 'redis:8.6.2-alpine';

declare module 'vitest' {
  export interface ProvidedContext {
    redisUrl: string;
  }
}

/**
 * Starts one Redis container for the integration tests, provides its URL, and stops it once
 * they finish.
 * @param project The integration project.
 * @returns A promise that resolves to the teardown, which stops the container.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container: StartedTestContainer = await new GenericContainer(REDIS_IMAGE)
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();
  project.provide('redisUrl', `redis://${container.getHost()}:${container.getMappedPort(6379)}`);
  return async () => {
    await container.stop();
  };
}
