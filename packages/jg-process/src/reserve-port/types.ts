// the options reservePort takes
export type IReservePortOptions = {
  // the port to try first, from 1 to 65535; another free one is reserved when it's taken
  preferredPort?: number | undefined;

  // the address to listen on. Defaults to 127.0.0.1
  host?: string | undefined;
};

// a port held until it's released, so nothing else can take it meanwhile
export type IPortReservation = {
  // the reserved port
  port: number;

  // the address it's reserved on
  host: string;

  // stops holding the port; calling it again does nothing
  release: () => Promise<void>;
};
