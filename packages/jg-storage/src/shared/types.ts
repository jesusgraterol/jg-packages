// the mechanism a store keeps its records in
export type IStoreMechanism = 'tempMemory' | 'localStorage' | 'sessionStorage' | 'indexedDB';

// identifies a record in a store. undefined addresses the store's root record, and a string or a
// number addresses the record stored under `${storeId}_${recordId}`
export type IRecordId = undefined | string | number;

// the options every store factory accepts
export type IStoreOptions<T> = {
  // keeps records in a memory map owned by the store when its mechanism is unavailable. Without it,
  // get returns undefined and set and del throw STORE_UNAVAILABLE
  fallback?: 'memory';

  // validates or converts every stored value get reads, such as a schema's parse. Its errors
  // propagate
  parse?: (value: unknown) => T;
};

// a store whose methods return their results directly: localStorage, sessionStorage, and memory
export type ISyncStore<T> = {
  // the identifier every record key starts with
  readonly id: string;

  // the mechanism the store was created for. isCompatible tells whether it's available
  readonly mechanism: IStoreMechanism;

  // whether the mechanism accepts writes, probed on the first call and remembered
  isCompatible(): boolean;

  // reads a record, or the root record when recordId is undefined
  get(recordId?: IRecordId): T | undefined;

  // writes a record, or the root record when recordId is undefined
  set(recordId: IRecordId, value: T): void;

  // deletes a record, or the root record when recordId is undefined
  del(recordId?: IRecordId): void;
};

// a store whose methods return promises: IndexedDB
export type IAsyncStore<T> = {
  // the identifier every record key starts with
  readonly id: string;

  // the mechanism the store was created for. isCompatible tells whether it's available
  readonly mechanism: IStoreMechanism;

  // whether the mechanism accepts writes, probed on the first call and remembered
  isCompatible(): Promise<boolean>;

  // reads a record, or the root record when recordId is undefined
  get(recordId?: IRecordId): Promise<T | undefined>;

  // writes a record, or the root record when recordId is undefined
  set(recordId: IRecordId, value: T): Promise<void>;

  // deletes a record, or the root record when recordId is undefined
  del(recordId?: IRecordId): Promise<void>;
};
