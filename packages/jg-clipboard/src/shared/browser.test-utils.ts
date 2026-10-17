import { vi, type Mock } from 'vitest';

// a ClipboardItem that keeps what it was given, as browsers do
export class FakeClipboardItem {
  readonly items: Record<string, string | Blob | PromiseLike<string | Blob>>;

  constructor(items: Record<string, string | Blob | PromiseLike<string | Blob>>) {
    this.items = items;
  }

  get types(): string[] {
    return Object.keys(this.items);
  }

  async getType(type: string): Promise<Blob> {
    const value = await this.items[type];
    return typeof value === 'string' ? new Blob([value], { type }) : (value as Blob);
  }
}

// the fake clipboard's methods, each a mock the tests inspect
export type IFakeClipboard = {
  write: Mock<(items: FakeClipboardItem[]) => Promise<void>>;
  writeText: Mock<(text: string) => Promise<void>>;
  read: Mock<() => Promise<FakeClipboardItem[]>>;
  readText: Mock<() => Promise<string>>;
};

// how the fake browser is set up
export type IFakeBrowserOptions = {
  isSecureContext?: boolean;
  // the clipboard methods the browser has; all of them by default
  methods?: readonly (keyof IFakeClipboard)[];
  // whether ClipboardItem exists, and the types its supports() accepts, or 'no-supports' without it
  clipboardItem?: boolean | readonly string[] | 'no-supports';
  hasFocus?: boolean;
  // navigator.userActivation.isActive, or undefined for a browser without userActivation
  userActivation?: boolean | undefined;
  // the clipboard permission's state, 'unknown' when the query rejects, or undefined without the API
  permission?: PermissionState | 'unknown' | undefined;
};

/**
 * Builds an error the way a browser names it.
 * @param name The error's name, such as NotAllowedError.
 * @param message The message.
 * @returns The error.
 */
export const domError = (name: string, message = `${name} from the browser`): Error =>
  Object.assign(new Error(message), { name });

/**
 * Stubs the browser globals the package reads, in a secure, focused page with an active click and
 * every clipboard feature unless the options say otherwise.
 * @param options The browser's setup.
 * @returns The fake clipboard and the permission query.
 */
export const installFakeBrowser = ({
  isSecureContext = true,
  methods = ['write', 'writeText', 'read', 'readText'],
  clipboardItem = true,
  hasFocus = true,
  userActivation = true,
  permission,
}: IFakeBrowserOptions = {}): { clipboard: IFakeClipboard; query: Mock } => {
  const clipboard: IFakeClipboard = {
    write: vi.fn(() => Promise.resolve()),
    writeText: vi.fn(() => Promise.resolve()),
    read: vi.fn(() => Promise.resolve([])),
    readText: vi.fn(() => Promise.resolve('')),
  };
  const exposed = Object.fromEntries(methods.map((method) => [method, clipboard[method]]));
  const query = vi.fn(({ name }: { name: string }) =>
    permission === 'unknown'
      ? Promise.reject(new TypeError(`'${name}' is not a valid permission name`))
      : Promise.resolve({ state: permission }),
  );
  vi.stubGlobal('isSecureContext', isSecureContext);
  vi.stubGlobal('navigator', {
    clipboard: exposed,
    ...(userActivation === undefined ? {} : { userActivation: { isActive: userActivation } }),
    ...(permission === undefined ? {} : { permissions: { query } }),
  });
  vi.stubGlobal('document', { hasFocus: () => hasFocus });
  if (clipboardItem === false) {
    vi.stubGlobal('ClipboardItem', undefined);
  } else {
    const ItemClass = class extends FakeClipboardItem {};
    if (typeof clipboardItem === 'object') {
      Object.assign(ItemClass, { supports: (type: string) => clipboardItem.includes(type) });
    } else if (clipboardItem === true) {
      Object.assign(ItemClass, { supports: () => true });
    }
    vi.stubGlobal('ClipboardItem', ItemClass);
  }
  return { clipboard, query };
};
