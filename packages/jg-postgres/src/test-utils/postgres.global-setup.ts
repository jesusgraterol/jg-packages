import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';

// the image Moldea runs, so the tests run against the server it uses
const POSTGRES_IMAGE = 'postgres:18.3-alpine';

// the container's superuser password, which only these tests use
const POSTGRES_PASSWORD = 'jg-postgres-tests';

// how the tests reach the database the container runs
export type IPostgresConnection = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

declare module 'vitest' {
  export interface ProvidedContext {
    postgres: IPostgresConnection;
  }
}

/**
 * Starts one PostgreSQL container for the integration tests, provides its connection details,
 * and stops it once they finish.
 * @param project The integration project.
 * @returns A promise that resolves to the teardown, which stops the container.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container: StartedTestContainer = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD })
    .withExposedPorts(5432)
    // the server restarts once after its first start, so it's ready on the second message
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .withTmpFs({ '/var/lib/postgresql': 'rw' })
    .start();
  project.provide('postgres', {
    host: container.getHost(),
    port: container.getMappedPort(5432),
    user: 'postgres',
    password: POSTGRES_PASSWORD,
    database: 'postgres',
  });
  return async () => {
    await container.stop();
  };
}
