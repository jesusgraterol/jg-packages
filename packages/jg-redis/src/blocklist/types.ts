// what createBlocklist takes
export type IBlocklistOptions = {
  // the key of the Redis SET that holds the list, such as `ip-blocklist`, or `{ip-blocklist}` on
  // Redis Cluster, so replaceAll's staging key is in the same slot
  key: string;
};

/*
 * A list of blocked values, such as IP addresses, in one Redis SET. Values are compared exactly, so
 * the caller normalizes them the same way when adding and checking. A value that isn't a string of
 * 1 to 512 characters throws BLOCKLIST_VALUE_INVALID before any command runs, and every command
 * failure throws BLOCKLIST_FAILED, so a caller can fail closed.
 */
export type IBlocklist = {
  // resolves to whether the value is in the list
  has: (value: string) => Promise<boolean>;

  // adds the values, 1,000 at a time
  add: (values: readonly string[]) => Promise<void>;

  // removes the values, 1,000 at a time
  remove: (values: readonly string[]) => Promise<void>;

  // replaces the whole list at once: readers see the old list or the new one, never part of it.
  // An empty list deletes the key
  replaceAll: (values: readonly string[]) => Promise<void>;
};
