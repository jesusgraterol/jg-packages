// where createIndexedDbPersister keeps a client's persisted copy
export type IIndexedDbPersisterOptions = {
  // the IndexedDB database's name, such as 'app-query-cache'
  databaseName: string;

  // the object store's name in that database
  storeName: string;

  // the key the persisted copy is stored under
  key: string;
};
