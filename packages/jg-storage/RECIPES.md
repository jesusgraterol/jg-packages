# jg-storage recipes

Patterns for apps that keep settings and drafts in the browser, and keep working where the browser blocks storage.

## Typed settings with a schema

Use this for preferences an app reads at startup, such as a theme and a font size. A schema gives the store its type and checks every record `get` reads, because a stored record can come from an older version of the app, or be edited by hand in the browser's devtools:

```ts
import { createLocalStore } from 'jg-storage';

type ISettings = { theme: 'light' | 'dark' | 'system'; fontSize: number };

// a Zod schema, or any validator with parse. Give fields added later a default, so settings saved
// by an older version still parse
declare const SettingsSchema: { parse(value: unknown): ISettings };

const DEFAULT_SETTINGS: ISettings = { theme: 'system', fontSize: 16 };

// the record type comes from the schema. localStorage is probed on the first call, not here, so the
// store can be created at module scope, even during server rendering
const settingsStore = createLocalStore('settings', { schema: SettingsSchema });

// reads the saved settings, or the defaults when nothing is saved or the saved record is invalid
export const readSettings = (): ISettings => {
  try {
    return settingsStore.get() ?? DEFAULT_SETTINGS;
  } catch {
    // the schema rejected the record, or it isn't JSON. Either way it's unusable, and the next save
    // replaces it
    return DEFAULT_SETTINGS;
  }
};

// saves a change and keeps the other settings as they were
export const updateSettings = (changes: Partial<ISettings>): ISettings => {
  const settings = { ...readSettings(), ...changes };
  settingsStore.set(undefined, settings);
  return settings;
};

// a theme switch saves only the theme, and the font size keeps its saved value
updateSettings({ theme: 'dark' });
```

The schema checks what `get` reads, not what `set` writes: the type checker covers what your code saves. When the schema rejects a record, its own error, such as a `ZodError`, propagates unchanged, and a record that isn't JSON throws `FAILED_TO_PARSE_JSON`, so `readSettings` catches both and starts from the defaults. Where the browser blocks localStorage, `get` returns `undefined` and `set` throws `STORE_UNAVAILABLE`; the next recipe keeps the records in memory there instead.

## A store that falls back to memory

Use this where the app should keep working when the browser blocks storage, such as with site data blocked in its privacy settings, or inside a sandboxed iframe. With `fallback: 'memory'`, the store keeps its records in memory there, and `isCompatible` tells you which one it uses, so you can say the work won't be kept:

```ts
import { createLocalStore } from 'jg-storage';

type IDraft = { title: string; body: string };

// the notice that says drafts last only until the page closes
declare const draftNotice: HTMLElement;

// one store for the whole app: the records in memory belong to this store object, so another
// store with the same id wouldn't see them
const drafts = createLocalStore<IDraft>('drafts', { fallback: 'memory' });

export const saveDraft = (postId: string, draft: IDraft): void => {
  drafts.set(postId, draft);

  // localStorage was probed on the store's first call, and the answer is remembered
  draftNotice.hidden = drafts.isCompatible();
};

export const readDraft = (postId: string): IDraft | undefined => drafts.get(postId);
```

An IndexedDB store falls back the same way, with promises. Its records keep their types, such as a `Blob` or a `Date`, in IndexedDB and in memory alike:

```ts
import { createIndexedDbStore } from 'jg-storage';

// a photo taken while offline, waiting to be uploaded
type IPendingUpload = { photo: Blob; takenAt: Date };

const pendingUploads = createIndexedDbStore<IPendingUpload>('pending-uploads', {
  fallback: 'memory',
});

// queues a photo, and resolves to whether it survives the page closing before it's uploaded
export const queueUpload = async (uploadId: string, photo: Blob): Promise<boolean> => {
  await pendingUploads.set(uploadId, { photo, takenAt: new Date() });
  return pendingUploads.isCompatible();
};
```

The fallback covers a mechanism that's unavailable when the store first probes it. Errors from a mechanism that's available still propagate, such as a full localStorage quota from `set`, so catch them where a save can fail. In memory, a record is the object you saved, not a copy, so don't change an object after saving it. Leave the fallback out where data kept only in memory would mislead, and catch `STORE_UNAVAILABLE` instead.
