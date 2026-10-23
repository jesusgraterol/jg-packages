import { describe, expect, test, vi } from 'vitest';

import { positionCopyHint, registerCopyDom } from './copy-dom.ts';

/** Supplies the layout boundary; rendered tests verify the real CSS and browser geometry. */
const createHint = (
  left: number,
  right: number,
  viewport: { width: number; offsetLeft: number } | null = null,
) => {
  const style = {
    transform: 'translateX(999px)',
    maxWidth: '',
    removeProperty: (name: string) => {
      if (name === 'transform') style.transform = '';
    },
  };
  const hint = {
    style,
    ownerDocument: {
      defaultView: { visualViewport: viewport },
      documentElement: { clientWidth: 320 },
    },
    getBoundingClientRect: () => ({ left, right }),
  };
  return { hint, element: hint as unknown as HTMLElement, style };
};

// a changed subtree can contain controls, or be a control itself
interface ITestNode {
  nodeType: number;
  isConnected: boolean;
  hidden: boolean;
  inert: boolean;
  classList: { remove: (name: string) => void };
  matches: () => boolean;
  querySelectorAll: () => ITestNode[];
}
const createNode = (isButton = true, children: ITestNode[] = []): ITestNode => ({
  nodeType: 1,
  isConnected: true,
  hidden: false,
  inert: true,
  classList: { remove: vi.fn() },
  matches: () => isButton,
  querySelectorAll: () => children,
});

/** Records the document, viewport, and observer boundaries independently for each scenario. */
const createDocument = () => {
  type IListener = () => void;
  const rootListeners = new Map<string, unknown[]>();
  const viewListeners = new Map<string, IListener[]>();
  const viewportListeners = new Map<string, IListener[]>();
  const buttons: ReturnType<typeof createNode>[] = [];
  const hints: HTMLElement[] = [];
  let callback: (records: MutationRecord[]) => void = () => undefined;
  let pendingRecords: MutationRecord[] = [];
  const observe = vi.fn();
  const disconnect = vi.fn();
  const takeRecords = vi.fn(() => pendingRecords);
  const addListener = (listeners: Map<string, IListener[]>, type: string, listener: IListener) => {
    listeners.set(type, [...(listeners.get(type) ?? []), listener]);
  };
  class FakeObserver {
    public observe = observe;
    public disconnect = disconnect;
    public takeRecords = takeRecords;
    public constructor(listener: (records: MutationRecord[]) => void) {
      callback = listener;
    }
  }
  const view = {
    MutationObserver: FakeObserver,
    visualViewport: {
      width: 320,
      offsetLeft: 0,
      addEventListener: (type: string, listener: IListener) =>
        addListener(viewportListeners, type, listener),
    } as {
      width: number;
      offsetLeft: number;
      addEventListener: (type: string, listener: IListener) => void;
    } | null,
    addEventListener: (type: string, listener: IListener) =>
      addListener(viewListeners, type, listener),
  };
  const root = {
    defaultView: view as typeof view | null,
    contains: (button: ReturnType<typeof createNode>) => buttons.includes(button),
    querySelectorAll: (selector: string) => (selector === '[data-copy-button]' ? buttons : hints),
    addEventListener: (type: string, listener: unknown) => {
      rootListeners.set(type, [...(rootListeners.get(type) ?? []), listener]);
    },
  };
  const emit = (listeners: Map<string, IListener[]>, type: string) => {
    listeners.get(type)?.forEach((listener) => listener());
  };
  const records = (addedNodes: object[], removedNodes: object[] = []): MutationRecord[] =>
    [{ addedNodes, removedNodes }] as unknown as MutationRecord[];
  return {
    root,
    document: root as unknown as Document,
    view,
    buttons,
    hints,
    rootListeners,
    observe,
    disconnect,
    takeRecords,
    records,
    deliver: (records: MutationRecord[]) => callback(records),
    queue: (records: MutationRecord[]) => {
      pendingRecords = records;
    },
    emitView: (name: string) => emit(viewListeners, name),
    emitViewport: (name: string) => emit(viewportListeners, name),
    pageLoad: () =>
      (rootListeners.get('astro:page-load') as IListener[] | undefined)?.forEach((listener) =>
        listener(),
      ),
  };
};

describe('positionCopyHint', () => {
  test.each([
    [-104, 136, 'translateX(120px)'],
    [250, 490, 'translateX(-186px)'],
    [32, 272, ''],
  ])('fits [%d, %d] inside the viewport with %s', (left, right, expected) => {
    const { element, style } = createHint(left, right);
    positionCopyHint(element);
    expect(style.transform).toBe(expected);
    expect(style.maxWidth).toBe('288px');
    positionCopyHint(element);
    expect(style.transform).toBe(expected);
  });

  test('uses the zoomed viewport and its pan offset', () => {
    const { element, style } = createHint(-40, 128, { width: 200, offsetLeft: 40 });
    positionCopyHint(element);
    expect(style.transform).toBe('translateX(96px)');
    expect(style.maxWidth).toBe('168px');
  });

  test('does not measure a document without a browsing context', () => {
    const hint = { ownerDocument: { defaultView: null }, getBoundingClientRect: vi.fn() };
    positionCopyHint(hint as unknown as HTMLElement);
    expect(hint.getBoundingClientRect).not.toHaveBeenCalled();
  });
});

describe('registerCopyDom', () => {
  test('reveals current controls only after installing one handler, and reuses its document owner', async () => {
    const fixture = createDocument();
    const first = createNode();
    fixture.buttons.push(first);
    const onClick = vi.fn();
    const onRemove = vi.fn<(button: HTMLElement) => void>();
    registerCopyDom(fixture.document, onClick, onRemove);
    expect(first.inert).toBe(false);
    const next = createNode();
    fixture.buttons.push(next);
    registerCopyDom(fixture.document, onClick, onRemove);
    expect(next.inert).toBe(false);
    expect(fixture.rootListeners.get('click')).toStrictEqual([onClick]);
    expect(fixture.observe).toHaveBeenCalledExactlyOnceWith(fixture.document, {
      childList: true,
      subtree: true,
    });
    vi.resetModules();
    const secondBundle = await import('./copy-dom.ts');
    secondBundle.registerCopyDom(fixture.document, vi.fn(), vi.fn());
    expect(fixture.rootListeners.get('click')).toStrictEqual([onClick]);
  });

  test('observes changed subtrees, ignores text and foreign nodes, and preserves controls moved within the document', () => {
    const fixture = createDocument();
    const onRemove = vi.fn<(button: HTMLElement) => void>();
    registerCopyDom(fixture.document, vi.fn(), onRemove);
    const direct = createNode();
    const nested = createNode();
    const foreign = createNode();
    const wrapper = createNode(false, [nested]);
    fixture.buttons.push(direct, nested);
    fixture.deliver(fixture.records([{ nodeType: 3 }, direct, wrapper, foreign]));
    expect(direct.inert).toBe(false);
    expect(nested.inert).toBe(false);
    expect(foreign.inert).toBe(true);
    fixture.deliver(fixture.records([], [direct]));
    expect(onRemove).not.toHaveBeenCalled();
    direct.isConnected = false;
    fixture.deliver(fixture.records([], [direct]));
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(direct);
  });

  test('flushes removed controls on page dismissal, releases current feedback, and resumes on bfcache return', () => {
    const fixture = createDocument();
    const current = createNode();
    const removed = createNode();
    removed.isConnected = false;
    fixture.buttons.push(current);
    const onRemove = vi.fn<(button: HTMLElement) => void>();
    registerCopyDom(fixture.document, vi.fn(), onRemove);
    fixture.queue(fixture.records([], [removed]));
    fixture.emitView('pagehide');
    expect(onRemove.mock.calls.map(([button]) => button)).toStrictEqual([removed, current]);
    expect(fixture.disconnect).toHaveBeenCalledOnce();
    expect(fixture.takeRecords).toHaveBeenCalledOnce();
    const next = createNode();
    fixture.buttons.push(next);
    fixture.emitView('pageshow');
    expect(next.inert).toBe(false);
    expect(fixture.observe).toHaveBeenCalledTimes(2);
    fixture.pageLoad();
    expect(fixture.observe).toHaveBeenCalledTimes(2);
  });

  test('keeps visible hints in bounds after viewport resize and zoom/pan changes', () => {
    const fixture = createDocument();
    const { element, style } = createHint(-104, 136);
    fixture.hints.push(element);
    registerCopyDom(fixture.document, vi.fn(), vi.fn());
    fixture.emitView('resize');
    expect(style.transform).toBe('translateX(120px)');
    style.transform = '';
    fixture.emitViewport('resize');
    expect(style.transform).toBe('translateX(120px)');
    style.transform = '';
    fixture.emitViewport('scroll');
    expect(style.transform).toBe('translateX(120px)');
  });

  test('supports a window without VisualViewport and a document without a window', () => {
    const first = createDocument();
    first.view.visualViewport = null;
    registerCopyDom(first.document, vi.fn(), vi.fn());
    const second = createDocument();
    second.root.defaultView = null;
    const button = createNode();
    second.buttons.push(button);
    registerCopyDom(second.document, vi.fn(), vi.fn());
    expect(button.inert).toBe(false);
  });
});
