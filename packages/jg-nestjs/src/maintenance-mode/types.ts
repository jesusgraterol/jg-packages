// whether the API is down for maintenance, and what to tell clients meanwhile
export type IMaintenanceModeState = {
  // whether requests are refused
  enabled: boolean;

  // a note for clients, such as when the service is expected back, sent as the error's data
  message?: string | undefined;
};

// what MaintenanceModeGuard takes, through MAINTENANCE_MODE_GUARD_OPTIONS
export type IMaintenanceModeGuardOptions = {
  // reads the current state on every request, such as from an environment flag or a stored record.
  // An error it throws refuses the request, which the filter answers with a 500 and reports
  getState: () => IMaintenanceModeState | Promise<IMaintenanceModeState>;
};
