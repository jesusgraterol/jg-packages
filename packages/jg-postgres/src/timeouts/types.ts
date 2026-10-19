// how long a query may run, in seconds: on the server, waiting for a lock, and on the client, which
// stops waiting for the server's answer. defineTimeoutProfile builds it
export type ITimeoutProfile = Readonly<{
  statementTimeoutSeconds: number;
  lockTimeoutSeconds: number;
  queryTimeoutSeconds: number;
}>;
