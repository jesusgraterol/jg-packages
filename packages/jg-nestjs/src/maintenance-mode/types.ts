import type { ExecutionContext } from '@nestjs/common';
import type { IJsonValue } from 'jg-exception';

// whether the API is down for maintenance, and what to tell clients meanwhile
export type IMaintenanceModeState = {
  // whether requests are refused
  enabled: boolean;

  // a note for clients, such as when the service is expected back, sent as the error's data,
  // `{ message }`, when there's no data
  message?: string | undefined;

  // what the client reads, such as `{ maintenanceMode: { content, updatedAt } }`, sent as the
  // error's data as it is, in place of the message
  data?: IJsonValue | undefined;
};

// what MaintenanceModeGuard takes, through MAINTENANCE_MODE_GUARD_OPTIONS
export type IMaintenanceModeGuardOptions = {
  // reads the current state on every request, such as from an environment flag or a stored record,
  // given the request's context, so it can exempt a route by its metadata. An error it throws
  // refuses the request, which the filter answers with a 500 and reports
  getState: (context: ExecutionContext) => IMaintenanceModeState | Promise<IMaintenanceModeState>;
};
