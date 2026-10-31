import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import type { ImageBlockConfig } from '@milkdown/kit/component/image-block';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import { AllSelection, NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import { getByRole } from '@testing-library/dom';

import {
  openEmptyMarkdownEditorInsertMenu,
  syncMarkdownEditorEmptyState,
} from './empty-state.utilities.js';
import type {
  IMarkdownEditorTool,
  IMarkdownEditorBlockActionTarget,
  IMarkdownEditorTurnIntoOption,
  IMarkdownEditorTurnIntoOptionKind,
} from './types.js';
import {
  MARKDOWN_EDITOR_ALL_TOOLS,
  MARKDOWN_EDITOR_AUTHORING_TOOLS,
  MARKDOWN_EDITOR_TOOLS,
  MARKDOWN_EDITOR_TURN_INTO_OPTIONS,
} from './constants.js';
import {
  getMarkdownEditorSupportedToolsKey,
  getVisibleMarkdownEditorToolbarActions,
  getVisibleMarkdownEditorTurnIntoOptions,
} from './tool-policy.utilities.js';
import {
  applyMarkdownEditorAccessibility,
  configureMarkdownEditorSerialization,
  ensureMarkdownEditorVueFragmentGlobal,
  getMarkdownEditorActiveTurnIntoOptionKind,
  getMarkdownEditorBlockActionTarget,
  getMarkdownEditorCrepeConfig,
  getMarkdownEditorMarkdown,
  getMarkdownEditorTurnIntoMenuPosition,
  highlightMarkdownEditorVariablesPlugin,
  insertMarkdownEditorVariable,
  disableMarkdownEditorFileUploads,
  deleteMarkdownEditorBlock,
  syncEditorPlaceholder,
  syncEditorValue,
  patchMarkdownEditorInlineMathSchemaPlugin,
  syncEditorAttributes,
  turnMarkdownEditorBlockInto,
} from './utilities.js';

let fragmentDescriptor: PropertyDescriptor | undefined;
beforeEach(() => {
  fragmentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Fragment');
});

const sessions: Array<{ crepe: Crepe; root: HTMLDivElement }> = [];

const createConversionEditor = async (
  markdown: string,
  supportedTools?: ReadonlyArray<IMarkdownEditorTool>,
  shouldEnableTopBar = false,
): Promise<Crepe> => {
  const root = document.createElement('div');
  const config = getMarkdownEditorCrepeConfig({
    isDarkMode: false,
    placeholder: 'e.g. Add notes',
    ...(supportedTools ? { supportedTools } : {}),
  });
  const crepe = new Crepe({
    ...config,
    ...(shouldEnableTopBar
      ? { features: { ...config.features, [CrepeFeature.TopBar]: true } }
      : {}),
    defaultValue: markdown,
    root,
  });
  document.body.append(root);
  sessions.push({ crepe, root });
  ensureMarkdownEditorVueFragmentGlobal();
  configureMarkdownEditorTestSerialization(crepe);
  crepe.editor.use(highlightMarkdownEditorVariablesPlugin);
  crepe.editor.config(disableMarkdownEditorFileUploads);
  await crepe.create();
  return crepe;
};

const createImageEditor = async (prefix = '', imageSize = 128) => {
  const canvas = document.createElement('canvas');
  canvas.width = imageSize;
  canvas.height = imageSize;
  canvas.getContext('2d')!.fillRect(0, 0, imageSize, imageSize);
  const crepe = await createConversionEditor(
    `${prefix}![1.00](${canvas.toDataURL()} "Example image")`,
  );
  const root = sessions.at(-1)!.root;
  await vi.waitFor(() => {
    const image = root.querySelector<HTMLImageElement>('img');
    expect(image?.naturalHeight).toBe(imageSize);
    expect(image?.dataset['height']).toBeDefined();
  });
  return { crepe, root };
};

afterEach(async () => {
  for (const { crepe, root } of sessions.splice(0)) {
    try {
      await crepe.destroy();
    } finally {
      root.remove();
    }
  }
  vi.restoreAllMocks();
  if (fragmentDescriptor) Object.defineProperty(globalThis, 'Fragment', fragmentDescriptor);
  else Reflect.deleteProperty(globalThis, 'Fragment');
});

// global shape used to isolate the Crepe image input compatibility patch.
type IMarkdownEditorGlobalScope = typeof globalThis & {
  Fragment?: symbol;
};

// selected editor text ranges use absolute ProseMirror document positions.
type IMarkdownEditorTextRange = {
  from: number;
  to: number;
};

/**
 * Finds the first matching text range inside a ProseMirror document.
 * @param doc The ProseMirror document to inspect.
 * @param selectedText The text range to find.
 * @returns The matching absolute text range.
 */
const getMarkdownEditorTextRange = (
  doc: ProseMirrorNode,
  selectedText: string,
): IMarkdownEditorTextRange => {
  let selectedRange: IMarkdownEditorTextRange | null = null;

  doc.descendants((node, position) => {
    if (selectedRange || !node.isText || typeof node.text !== 'string') {
      return;
    }

    const selectedTextIndex = node.text.indexOf(selectedText);

    if (selectedTextIndex < 0) {
      return;
    }

    selectedRange = {
      from: position + selectedTextIndex,
      to: position + selectedTextIndex + selectedText.length,
    };
  });

  if (!selectedRange) {
    throw new Error(`Could not find "${selectedText}" in the editor document.`);
  }

  return selectedRange;
};

/**
 * Selects the first matching text range inside a mounted Crepe editor.
 * @param crepe The mounted Crepe editor instance.
 * @param selectedText The text range to select.
 */
const selectMarkdownEditorText = (crepe: Crepe, selectedText: string): void => {
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const selectedRange = getMarkdownEditorTextRange(view.state.doc, selectedText);

    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, selectedRange.from, selectedRange.to),
      ),
    );
  });
};

/**
 * Places the cursor inside the first matching text range.
 * @param crepe The mounted Crepe editor instance.
 * @param selectedText The text range to place the cursor inside.
 * @param offset The offset from the start of the matching text.
 */
const placeMarkdownEditorCursorInsideText = (
  crepe: Crepe,
  selectedText: string,
  offset: number,
): void => {
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const selectedRange = getMarkdownEditorTextRange(view.state.doc, selectedText);
    const cursorPosition = selectedRange.from + offset;

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, cursorPosition)));
  });
};

/**
 * Reads the current selected text from a mounted Crepe editor.
 * @param crepe The mounted Crepe editor instance.
 * @returns The text currently selected in the editor document.
 */
const getSelectedMarkdownEditorText = (crepe: Crepe): string =>
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { selection } = view.state;

    return view.state.doc.textBetween(selection.from, selection.to, ' ');
  });

/**
 * Returns a static turn-into option used by block action tests.
 * @param kind The target option kind.
 * @returns The matching turn-into option.
 */
const getMarkdownEditorTurnIntoOption = (
  kind: IMarkdownEditorTurnIntoOptionKind,
): IMarkdownEditorTurnIntoOption => {
  const turnIntoOption = MARKDOWN_EDITOR_TURN_INTO_OPTIONS.find((option) => option.kind === kind);

  if (!turnIntoOption) {
    throw new Error(`Could not find the ${kind} turn-into option.`);
  }

  return turnIntoOption;
};

/**
 * Applies editor serialization options to direct Crepe instances used in tests.
 * @param crepe The test editor instance to configure.
 */
const configureMarkdownEditorTestSerialization = (crepe: Crepe): void => {
  crepe.editor.config(configureMarkdownEditorSerialization);
};

describe('markdown editor block action utilities', () => {
  test.each(['Enter', ' '])(
    'the real selection toolbar activates variable insertion with %s',
    async (key) => {
      const crepe = await createConversionEditor('Hello First name.');
      const root = sessions.at(-1)!.root;
      crepe.editor.action((ctx) => ctx.get(editorViewCtx).focus());
      selectMarkdownEditorText(crepe, 'First name');
      await vi.waitFor(() => {
        expect(
          root.querySelector('.milkdown-toolbar .toolbar-item[data-toolbar-item="variable"]'),
        ).not.toBeNull();
      });
      applyMarkdownEditorAccessibility(root);
      const button = getByRole<HTMLButtonElement>(root, 'button', { name: 'Insert variable' });
      button.focus();
      button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      expect(getMarkdownEditorMarkdown(crepe)).toContain('Hello {{FIRST_NAME}}.');
      expect(getSelectedMarkdownEditorText(crepe)).toBe('FIRST_NAME');
    },
  );
  test.each([
    ['heading-1', '# Note'],
    ['heading-2', '## Note'],
    ['heading-3', '### Note'],
    ['quote', '> Note'],
    ['bullet-list', '* Note'],
    ['ordered-list', '1. Note'],
    ['code', '```\nNote\n```'],
    ['table', '|'],
  ] satisfies Array<[IMarkdownEditorTurnIntoOptionKind, string]>)(
    'converts a selected paragraph into %s through the real schema',
    async (kind, markdown) => {
      const crepe = await createConversionEditor('Note');
      const target = getMarkdownEditorBlockActionTarget(crepe)!;
      expect(
        turnMarkdownEditorBlockInto(crepe, target, getMarkdownEditorTurnIntoOption(kind)),
      ).toBe(true);
      expect(getMarkdownEditorMarkdown(crepe)).toContain(markdown);
      crepe.editor.action((ctx) => ctx.get(editorViewCtx).state.doc.check());
    },
  );

  test.each(['quote', 'bullet-list', 'ordered-list', 'code'] as const)(
    'restores variable text while converting to %s',
    async (kind) => {
      const crepe = await createConversionEditor('{{PROJECT_STATUS}}');
      const target = getMarkdownEditorBlockActionTarget(crepe)!;
      expect(
        turnMarkdownEditorBlockInto(crepe, target, getMarkdownEditorTurnIntoOption(kind)),
      ).toBe(true);
      expect(getMarkdownEditorMarkdown(crepe)).toContain('project status');
      expect(getMarkdownEditorMarkdown(crepe)).not.toContain('{{');
    },
  );

  test('deleting one block preserves its siblings and deleting the final block keeps a valid empty document', async () => {
    const crepe = await createConversionEditor('First\n\nSecond');
    expect(deleteMarkdownEditorBlock(crepe, getMarkdownEditorBlockActionTarget(crepe)!)).toBe(true);
    expect(getMarkdownEditorMarkdown(crepe).trim()).toBe('Second');
    expect(deleteMarkdownEditorBlock(crepe, getMarkdownEditorBlockActionTarget(crepe)!)).toBe(true);
    expect(getMarkdownEditorMarkdown(crepe).trim()).toBe('');
    crepe.editor.action((ctx) => {
      const doc = ctx.get(editorViewCtx).state.doc;
      doc.check();
      expect(doc.childCount).toBe(1);
      expect(doc.firstChild?.type.name).toBe('paragraph');
    });
  });

  test('updates placeholders in place and rejects authoring commands after destruction', async () => {
    const crepe = await createConversionEditor('Note');
    const target = getMarkdownEditorBlockActionTarget(crepe)!;
    syncEditorPlaceholder(crepe, 'e.g. Add details');
    const currentMarkdownRef = { current: 'Note' };
    syncEditorValue(crepe, 'Changed', currentMarkdownRef);
    expect(getMarkdownEditorMarkdown(crepe).trim()).toBe('Changed');
    expect(currentMarkdownRef.current).toBe('Changed');
    syncEditorValue(crepe, 'Changed', currentMarkdownRef);
    await crepe.destroy();
    expect(getMarkdownEditorBlockActionTarget(crepe)).toBeNull();
    expect(
      turnMarkdownEditorBlockInto(crepe, target, getMarkdownEditorTurnIntoOption('heading-1')),
    ).toBe(false);
    expect(deleteMarkdownEditorBlock(crepe, target)).toBe(false);
    expect(insertMarkdownEditorVariable(crepe)).toBe(false);
    syncEditorPlaceholder(crepe, 'e.g. Ignore a late placeholder');
    syncEditorValue(crepe, 'Late replacement', currentMarkdownRef);
    expect(currentMarkdownRef.current).toBe('Changed');
  });

  test('stale block targets and rejected view transactions preserve the current document', async () => {
    const crepe = await createConversionEditor('Note');
    const target = getMarkdownEditorBlockActionTarget(crepe)!;
    expect(
      turnMarkdownEditorBlockInto(crepe, target, getMarkdownEditorTurnIntoOption('paragraph')),
    ).toBe(false);
    const missing = { ...target, from: target.to, to: target.to };
    expect(
      turnMarkdownEditorBlockInto(crepe, missing, getMarkdownEditorTurnIntoOption('heading-1')),
    ).toBe(false);
    expect(deleteMarkdownEditorBlock(crepe, { ...target, from: 999, to: 1000 })).toBe(false);
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const dispatch = vi.spyOn(view, 'dispatch').mockImplementation(() => {
        throw new Error('The view was disposed during an action.');
      });
      try {
        expect(
          turnMarkdownEditorBlockInto(crepe, target, getMarkdownEditorTurnIntoOption('heading-1')),
        ).toBe(false);
        expect(deleteMarkdownEditorBlock(crepe, target)).toBe(false);
        expect(insertMarkdownEditorVariable(crepe)).toBe(false);
      } finally {
        dispatch.mockRestore();
      }
    });
    expect(getMarkdownEditorMarkdown(crepe).trim()).toBe('Note');
  });

  test('a retained block action reads the current variable text and code blocks are never decorated', async () => {
    const crepe = await createConversionEditor('Previous label!!');
    const target = getMarkdownEditorBlockActionTarget(crepe)!;
    syncEditorValue(crepe, '{{PROJECT_NAME}}', { current: 'Previous label!!' });
    expect(
      turnMarkdownEditorBlockInto(crepe, target, getMarkdownEditorTurnIntoOption('variable')),
    ).toBe(true);
    expect(getMarkdownEditorMarkdown(crepe).trim()).toBe('project name');
    const code = await createConversionEditor('```\n{{PROJECT_NAME}}\n```');
    expect(sessions.at(-1)!.root.querySelector('[data-markdown-variable]')).toBeNull();
    expect(getMarkdownEditorMarkdown(code)).toContain('{{PROJECT_NAME}}');
  });

  test.each(['Variable', 'YouTube video'])(
    'the native slash command %s works with the default configuration',
    async (label) => {
      const crepe = await createConversionEditor('/');
      const root = sessions.at(-1)!.root;
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.focus();
        view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
      });
      await vi.waitFor(() =>
        expect(root.querySelector('.milkdown-slash-menu')?.getAttribute('data-show')).toBe('true'),
      );
      const item = Array.from(root.querySelectorAll('li')).find(
        (candidate) => candidate.textContent?.trim() === label,
      )!;
      expect(item).toBeDefined();
      item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect(getMarkdownEditorMarkdown(crepe).trim()).toBe(
        label === 'Variable' ? '{{VARIABLE_NAME}}' : '/',
      );
    },
  );

  test('selection targets distinguish whole documents and atom selections, and file upload stays disabled', async () => {
    const crepe = await createConversionEditor('First {{NAME}}.\n\nSecond {{NAME}}.');
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
      expect(getMarkdownEditorBlockActionTarget(crepe)).toBeNull();
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
      expect(getMarkdownEditorBlockActionTarget(crepe)?.nodeTypeName).toBe('paragraph');
    });
    placeMarkdownEditorCursorInsideText(crepe, '{{NAME}}', 3);
    expect(insertMarkdownEditorVariable(crepe)).toBe(true);
    expect(getMarkdownEditorMarkdown(crepe)).toContain('First name.');
    const uploadResult = crepe.editor.action((ctx) => {
      const files = new DataTransfer();
      files.items.add(new File(['image bytes'], 'image.png', { type: 'image/png' }));
      return ctx
        .get(uploadConfig.key)
        .uploader(files.files, ctx.get(editorViewCtx).state.schema, ctx, 0);
    });
    expect(await uploadResult).toStrictEqual([]);
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      expect(
        deleteMarkdownEditorBlock(crepe, {
          ...getMarkdownEditorBlockActionTarget(crepe)!,
          from: 1,
          to: 1,
        }),
      ).toBe(false);
      expect(view.state.doc.textContent).toContain('Second {{NAME}}');
    });
  });

  test('partial and older native menu markup remains safe and scrolls without Element.scrollTo', () => {
    const container = document.createElement('div');
    container.innerHTML = `<div class="milkdown-slash-menu" data-show="true"></div>
      <div class="milkdown-slash-menu" data-show="true"><div class="menu-groups" style="height:16px;overflow:auto"><div style="height:256px"></div></div></div>
      <div class="milkdown-top-bar"><button class="top-bar-heading-button">Paragraph</button><div class="top-bar-heading-selector"></div><button class="top-bar-heading-option">Heading 1</button></div>
      <div class="milkdown-toolbar">${'<button class="toolbar-item"></button>'.repeat(16)}</div>
      <div class="milkdown-table-block"><div data-role="col-drag-handle"><div class="button-group">${'<button></button>'.repeat(8)}</div></div></div>`;
    document.body.append(container);
    try {
      const scrollArea = container.querySelector<HTMLElement>('.menu-groups')!;
      Object.defineProperty(scrollArea, 'scrollTo', { configurable: true, value: undefined });
      scrollArea.scrollTop = 32;
      applyMarkdownEditorAccessibility(container);
      expect(scrollArea.scrollTop).toBe(0);
      const heading = getByRole(container, 'button', { name: 'Heading 1' });
      const activate = vi.fn();
      heading.addEventListener('pointerdown', activate);
      heading.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      expect(activate).toHaveBeenCalledOnce();
      expect(
        container
          .querySelector('.top-bar-heading-selector')
          ?.getAttribute('data-editor-menu-was-open'),
      ).toBe('false');
    } finally {
      container.remove();
    }
  });

  test('empty-state controls suppress readonly activation and tolerate an unavailable node DOM', async () => {
    const crepe = await createConversionEditor('');
    const root = sessions.at(-1)!.root;
    await vi.waitFor(() =>
      expect(
        root.querySelector('.milkdown-block-handle > .operation-item:first-child'),
      ).not.toBeNull(),
    );
    crepe.setReadonly(true);
    syncEditorAttributes(crepe);
    expect(crepe.readonly).toBe(true);
    expect(crepe.editor.action((ctx) => ctx.get(editorViewCtx).editable)).toBe(false);
    expect(openEmptyMarkdownEditorInsertMenu(crepe, root)).toBe(true);
    expect(getMarkdownEditorMarkdown(crepe)).toBe('');
    crepe.setReadonly(false);
    syncEditorAttributes(crepe);
    crepe.editor.action((ctx) => {
      const nodeDom = vi.spyOn(ctx.get(editorViewCtx), 'nodeDOM').mockReturnValue(null);
      try {
        expect(() => syncMarkdownEditorEmptyState(crepe, root)).not.toThrow();
      } finally {
        nodeDom.mockRestore();
      }
    });
    expect(root.dataset['emptyBlockHandle']).toBe('true');
  });

  test.each(['## Heading', '###### Heading'])(
    'heading targets retain the imported document scale for %s',
    async (markdown) => {
      const crepe = await createConversionEditor(markdown);
      expect(getMarkdownEditorBlockActionTarget(crepe)?.headingLevel).toBe(
        markdown.startsWith('######') ? 6 : 2,
      );
    },
  );

  test.each(['code', 'heading-1', 'quote'] as const)(
    'empty blocks remain valid when converted into %s',
    async (kind) => {
      const crepe = await createConversionEditor('');
      expect(
        turnMarkdownEditorBlockInto(
          crepe,
          getMarkdownEditorBlockActionTarget(crepe)!,
          getMarkdownEditorTurnIntoOption(kind),
        ),
      ).toBe(true);
      crepe.editor.action((ctx) => ctx.get(editorViewCtx).state.doc.check());
    },
  );

  test('accessibility updates retain functional editor attributes and late slash commands preserve a replaced draft', async () => {
    const crepe = await createConversionEditor('/');
    const root = sessions.at(-1)!.root;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.setProps({ attributes: () => ({ 'data-consumer-state': 'retained' }) });
      syncEditorAttributes(crepe, 'Custom label');
      view.focus();
      view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
    });
    expect(root.querySelector('[data-consumer-state="retained"]')?.getAttribute('aria-label')).toBe(
      'Custom label',
    );
    await vi.waitFor(() =>
      expect(root.querySelector('.milkdown-slash-menu')?.getAttribute('data-show')).toBe('true'),
    );
    const item = Array.from(root.querySelectorAll('li')).find(
      (candidate) => candidate.textContent?.trim() === 'YouTube video',
    )!;
    syncEditorValue(crepe, 'Replacement draft', { current: '/' });
    item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(getMarkdownEditorMarkdown(crepe).trim()).toBe('Replacement draft');
  });

  test('nonempty document insertion commands are ignored without moving focus or changing text', async () => {
    const crepe = await createConversionEditor('Existing note');
    const root = sessions.at(-1)!.root;
    expect(openEmptyMarkdownEditorInsertMenu(crepe, root)).toBe(false);
    expect(getMarkdownEditorMarkdown(crepe).trim()).toBe('Existing note');
  });

  test('native image captions and height editing work from the keyboard and respect readonly state', async () => {
    const { crepe, root } = await createImageEditor('Intro\n\n');
    const form = document.createElement('form');
    root.before(form);
    form.append(root);
    try {
      applyMarkdownEditorAccessibility(root, undefined, crepe);
      applyMarkdownEditorAccessibility(root, undefined, crepe);
      const caption = getByRole<HTMLInputElement>(root, 'textbox', { name: 'Image caption' });
      expect(caption.value).toBe('Example image');
      const toggle = getByRole(root, 'button', { name: 'Toggle image caption' });
      toggle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await vi.waitFor(() => expect(root.querySelector('.caption-input')).toBeNull());
      toggle.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
      );
      await vi.waitFor(() => expect(root.querySelector('.caption-input')).not.toBeNull());
      applyMarkdownEditorAccessibility(root, undefined, crepe);
      const height = getByRole<HTMLInputElement>(root, 'spinbutton', {
        name: 'Image height in pixels',
      });
      expect(height.valueAsNumber).toBe(128);
      expect(height.form).toBeNull();
      height.value = '';
      height.dispatchEvent(new Event('input', { bubbles: true }));
      expect(root.querySelector<HTMLImageElement>('img')?.dataset['height']).toBe('128.00');
      expect(form.checkValidity()).toBe(true);
      height.dispatchEvent(new Event('blur'));
      const error = root.ownerDocument.getElementById(height.getAttribute('aria-describedby')!)!;
      expect(error.hidden).toBe(false);
      expect(error.textContent).not.toBe('');
      height.value = '50';
      height.dispatchEvent(new Event('input', { bubbles: true }));
      expect(error.textContent).toContain('100');
      height.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      expect(height.getAttribute('aria-invalid')).toBe('true');
      height.value = '128';
      height.stepUp(16);
      height.dispatchEvent(new Event('input', { bubbles: true }));
      await vi.waitFor(() =>
        expect(root.querySelector<HTMLImageElement>('img')?.dataset['height']).toBe('144.00'),
      );
      expect(getMarkdownEditorMarkdown(crepe)).toContain('![1.13]');
      expect(error.hidden).toBe(true);
      height.focus();
      height.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      height.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      expect(document.activeElement).toBe(height);
      height.focus();
      root.dataset['disabled'] = 'true';
      crepe.setReadonly(true);
      applyMarkdownEditorAccessibility(root, undefined, crepe);
      expect(height.disabled).toBe(true);
      expect(document.activeElement).toBe(root.querySelector('img'));
      expect(root.querySelector<HTMLInputElement>('.caption-input')?.readOnly).toBe(true);
      const snapshot = getMarkdownEditorMarkdown(crepe);
      height.value = '192';
      height.dispatchEvent(new Event('input', { bubbles: true }));
      toggle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      expect(getMarkdownEditorMarkdown(crepe)).toBe(snapshot);
      expect(root.querySelector('.caption-input')).not.toBeNull();
    } finally {
      form.replaceWith(root);
    }
  });

  test('height fields show the actual size of existing small images before resizing', async () => {
    const { crepe, root } = await createImageEditor('', 64);
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    const field = getByRole<HTMLInputElement>(root, 'spinbutton', {
      name: 'Image height in pixels',
    });
    expect(field.valueAsNumber).toBe(64);
    expect(root.querySelector<HTMLImageElement>('img')!.dataset['height']).toBe('64.00');
    field.stepUp();
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(field.valueAsNumber).toBe(100);
    expect(root.querySelector<HTMLImageElement>('img')!.dataset['height']).toBe('100.00');
  });

  test('image height controls follow undo and redo without interrupting the native drag gesture', async () => {
    const { crepe, root } = await createImageEditor();
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    const height = getByRole<HTMLInputElement>(root, 'spinbutton', {
      name: 'Image height in pixels',
    });
    height.value = '160';
    height.dispatchEvent(new Event('input', { bubbles: true }));
    expect(getMarkdownEditorMarkdown(crepe)).toContain('![1.25]');
    height.value = '';
    height.dispatchEvent(new Event('input', { bubbles: true }));
    height.dispatchEvent(new Event('blur'));
    expect(height.getAttribute('aria-invalid')).toBe('true');
    height.focus();
    crepe.editor.action((ctx) => ctx.get(commandsCtx).call(undoCommand.key));
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    expect(getMarkdownEditorMarkdown(crepe)).toContain('![1.00]');
    expect(root.querySelector<HTMLImageElement>('img')?.dataset['height']).toBe('128.00');
    expect(height.value).toBe('128');
    expect(height.getAttribute('aria-invalid')).toBe('false');
    expect(
      root.ownerDocument.getElementById(height.getAttribute('aria-describedby')!)!.hidden,
    ).toBe(true);
    crepe.editor.action((ctx) => ctx.get(commandsCtx).call(redoCommand.key));
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    expect(root.querySelector<HTMLImageElement>('img')?.dataset['height']).toBe('160.00');
    const image = root.querySelector<HTMLImageElement>('img')!;
    const handle = root.querySelector<HTMLElement>('.image-resize-handle')!;
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    try {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientY: image.getBoundingClientRect().top + 176 }),
      );
      applyMarkdownEditorAccessibility(root, undefined, crepe);
      expect(image.dataset['height']).toBe('176.00');
    } finally {
      window.dispatchEvent(new PointerEvent('pointerup'));
    }
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    expect(image.dataset['height']).toBe('176.00');
    expect(getMarkdownEditorMarkdown(crepe)).toContain('![1.38]');
  });

  test.each([
    MARKDOWN_EDITOR_TOOLS.Variable,
    MARKDOWN_EDITOR_TOOLS.YouTube,
    MARKDOWN_EDITOR_TOOLS.Bold,
  ])('a real editor restricted to %s initializes only its supported menu groups', async (tool) => {
    const crepe = await createConversionEditor('Note', [tool]);
    expect(getMarkdownEditorMarkdown(crepe).trim()).toBe('Note');
    crepe.editor.action((ctx) => ctx.get(editorViewCtx).state.doc.check());
  });

  test('menu visibility and scrolling follow the reduced motion setting', () => {
    const matchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      const result = matchMedia(query);
      if (query === '(prefers-reduced-motion: reduce)')
        Object.defineProperty(result, 'matches', { value: true });
      return result;
    });
    const root = document.createElement('div');
    root.innerHTML =
      '<div class="milkdown-slash-menu" data-show="false"><div class="menu-groups"></div></div>';
    const groups = root.querySelector<HTMLElement>('.menu-groups')!;
    const scroll = vi.spyOn(groups, 'scrollTo');
    applyMarkdownEditorAccessibility(root);
    root.querySelector<HTMLElement>('.milkdown-slash-menu')!.dataset['show'] = 'true';
    applyMarkdownEditorAccessibility(root);
    expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', top: 0 });
  });

  test('a foreign heading level falls back to the paragraph label in the opt-in top bar', async () => {
    const crepe = await createConversionEditor('# Heading', undefined, true);
    const root = sessions.at(-1)!.root;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(
        view.state.tr.setNodeMarkup(0, undefined, {
          ...view.state.doc.firstChild!.attrs,
          level: 8,
        }),
      );
      view.focus();
    });
    await vi.waitFor(() =>
      expect(root.querySelector('.top-bar-heading-button')?.textContent).toContain('Paragraph'),
    );
  });

  test('embedded code editors have language-aware names and a keyboard scrolling target', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div class="milkdown-slash-menu" data-show="false"></div><div class="milkdown-code-block"><div class="cm-scroller"><div class="cm-content" data-language="typescript"></div><div class="cm-content"></div></div></div>';
    applyMarkdownEditorAccessibility(root);
    expect(root.querySelector('[aria-label="typescript code editor"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Code editor"]')).not.toBeNull();
    const scroller = getByRole(root, 'group', { name: 'Scrollable code block' });
    expect(scroller.tabIndex).toBe(0);
  });

  test('image controls cannot mutate an editor that has not initialized', async () => {
    const { root } = await createImageEditor();
    const preview = root.cloneNode(true) as HTMLDivElement;
    const pending = new Crepe({ root: document.createElement('div') });
    document.body.append(preview);
    try {
      applyMarkdownEditorAccessibility(preview, undefined, pending);
      const field = getByRole<HTMLInputElement>(preview, 'spinbutton', {
        name: 'Image height in pixels',
      });
      field.value = '160';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      expect(preview.querySelector<HTMLImageElement>('img')!.dataset['height']).toBe('128.00');
    } finally {
      preview.remove();
      await pending.destroy();
    }
  });

  test('an empty editor retains its insertion control while its mounted container is temporarily detached', async () => {
    const crepe = await createConversionEditor('');
    const root = sessions.at(-1)!.root;
    await vi.waitFor(() => expect(root.querySelector('.milkdown-block-handle')).not.toBeNull());
    root.remove();
    try {
      syncMarkdownEditorEmptyState(crepe, root);
      expect(getByRole(root, 'button', { name: 'Insert block' }).tabIndex).toBe(0);
    } finally {
      document.body.append(root);
    }
  });

  test('image height ignores readonly races, unavailable dimensions and stale image positions', async () => {
    const { crepe, root } = await createImageEditor('Intro\n\n');
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    const height = getByRole<HTMLInputElement>(root, 'spinbutton', {
      name: 'Image height in pixels',
    });
    const image = root.querySelector<HTMLImageElement>('img')!;
    const snapshot = getMarkdownEditorMarkdown(crepe);
    const change = () => {
      height.value = '160';
      height.dispatchEvent(new Event('input', { bubbles: true }));
    };
    crepe.setReadonly(true);
    change();
    expect(getMarkdownEditorMarkdown(crepe)).toBe(snapshot);
    crepe.setReadonly(false);
    delete image.dataset['origin'];
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    change();
    expect(getMarkdownEditorMarkdown(crepe)).toBe(snapshot);
    image.dataset['origin'] = '128';
    const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx));
    const position = vi.spyOn(view, 'posAtDOM').mockReturnValue(0);
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    change();
    expect(getMarkdownEditorMarkdown(crepe)).toBe(snapshot);
    position.mockRestore();
    delete image.dataset['height'];
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    expect(height.valueAsNumber).toBe(100);
    height.focus();
    height.value = '';
    height.dispatchEvent(new Event('input', { bubbles: true }));
    height.blur();
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    expect(height.value).toBe('');
    height.value = '128';
    height.dispatchEvent(new Event('input', { bubbles: true }));
    crepe.editor.action((ctx) =>
      ctx.update('imageBlockConfigCtx', (config: ImageBlockConfig) => ({
        ...config,
        maxHeight: 160,
      })),
    );
    height.value = '192';
    height.dispatchEvent(new Event('input', { bubbles: true }));
    expect(image.dataset['height']).toBe('160.00');
    const wrapper = image.closest<HTMLElement>('.milkdown-image-block')!;
    root.remove();
    height.dispatchEvent(new Event('input', { bubbles: true }));
    document.body.append(root);
    await Promise.resolve();
    await crepe.destroy();
    root.append(wrapper);
    applyMarkdownEditorAccessibility(root, undefined, crepe);
    height.disabled = false;
    height.dispatchEvent(new Event('input', { bubbles: true }));
    expect(image.dataset['height']).toBe('160.00');
  });

  test('table handles expose distinct names and deduplicated Enter and Space activation', () => {
    const container = document.createElement('div');
    container.innerHTML = `<div class="milkdown-table-block">
      <div data-role="x-line-drag-handle"><button class="add-button"></button></div>
      <div data-role="y-line-drag-handle"><button class="add-button"></button></div>
      <div data-role="col-drag-handle"><div class="button-group"><button></button><button></button><button></button><button></button></div></div>
      <div data-role="row-drag-handle"><div class="button-group"><button></button></div></div>
    </div>`;
    document.body.append(container);
    try {
      applyMarkdownEditorAccessibility(container);
      applyMarkdownEditorAccessibility(container);
      for (const name of ['Open column actions', 'Open row actions']) {
        const handle = container.querySelector<HTMLElement>(`[aria-label="${name}"]`)!;
        const click = vi.fn();
        handle.addEventListener('click', click);
        for (const key of ['Enter', ' ', 'ArrowDown'])
          handle.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
          );
        expect(click).toHaveBeenCalledTimes(2);
      }
      expect(container.querySelector('[aria-label="Add row"]')).not.toBeNull();
      expect(container.querySelector('[aria-label="Add column"]')).not.toBeNull();
      expect(container.querySelector('[aria-label="Delete column"]')).not.toBeNull();
      expect(container.querySelector('[aria-label="Delete row"]')).not.toBeNull();
    } finally {
      container.remove();
    }
  });
  test('keeps YouTube in the complete tool policy without changing constrained authoring', () => {
    expect(MARKDOWN_EDITOR_ALL_TOOLS).toContain(MARKDOWN_EDITOR_TOOLS.YouTube);
    expect(MARKDOWN_EDITOR_AUTHORING_TOOLS).not.toContain(MARKDOWN_EDITOR_TOOLS.YouTube);
    expect(
      getMarkdownEditorSupportedToolsKey([
        MARKDOWN_EDITOR_TOOLS.YouTube,
        MARKDOWN_EDITOR_TOOLS.Text,
      ]),
    ).toBe('text,youtube');
  });

  test(
    'getVisibleMarkdownEditorTurnIntoOptions exposes the authoring heading scale',
    { tags: ['full'] },
    () => {
      const visibleOptions = getVisibleMarkdownEditorTurnIntoOptions();

      expect(visibleOptions.map((option) => option.kind)).toStrictEqual([
        'paragraph',
        'heading-1',
        'heading-2',
        'heading-3',
        'quote',
        'variable',
        'bullet-list',
        'ordered-list',
        'code',
        'table',
      ]);
    },
  );

  test(
    'getVisibleMarkdownEditorTurnIntoOptions filters unsupported block tools',
    { tags: ['full'] },
    () => {
      const visibleOptions = getVisibleMarkdownEditorTurnIntoOptions([
        MARKDOWN_EDITOR_TOOLS.Text,
        MARKDOWN_EDITOR_TOOLS.Heading,
        MARKDOWN_EDITOR_TOOLS.CodeBlock,
      ]);

      expect(visibleOptions.map((option) => option.kind)).toStrictEqual([
        'paragraph',
        'heading-1',
        'heading-2',
        'heading-3',
        'code',
      ]);
    },
  );

  test(
    'getVisibleMarkdownEditorTurnIntoOptions includes variables when supported',
    { tags: ['full'] },
    () => {
      const visibleOptions = getVisibleMarkdownEditorTurnIntoOptions([
        MARKDOWN_EDITOR_TOOLS.Variable,
      ]);

      expect(visibleOptions.map((option) => option.kind)).toStrictEqual(['variable']);
    },
  );

  test('getMarkdownEditorSupportedToolsKey normalizes equivalent tool sets', () => {
    const supportedToolsKey = getMarkdownEditorSupportedToolsKey([
      MARKDOWN_EDITOR_TOOLS.Table,
      MARKDOWN_EDITOR_TOOLS.Bold,
    ]);
    const equivalentSupportedToolsKey = getMarkdownEditorSupportedToolsKey([
      MARKDOWN_EDITOR_TOOLS.Bold,
      MARKDOWN_EDITOR_TOOLS.Table,
    ]);

    expect(supportedToolsKey).toBe(equivalentSupportedToolsKey);
  });

  test('getMarkdownEditorCrepeConfig disables tools outside the moldea markdown policy', () => {
    const crepeConfig = getMarkdownEditorCrepeConfig({
      isDarkMode: false,
      placeholder: 'e.g. ## Test note',
      supportedTools: MARKDOWN_EDITOR_AUTHORING_TOOLS,
    });

    expect(crepeConfig.features).toMatchObject({
      [CrepeFeature.ImageBlock]: false,
      [CrepeFeature.Latex]: false,
      [CrepeFeature.Table]: true,
      [CrepeFeature.Toolbar]: true,
    });
    expect(crepeConfig.featureConfigs?.[CrepeFeature.BlockEdit]).toMatchObject({
      advancedGroup: {
        image: null,
        math: null,
      },
      listGroup: {
        taskList: null,
      },
      textGroup: {
        divider: null,
      },
    });
  });

  test('getMarkdownEditorCrepeConfig configures image insertion for links only', () => {
    const crepeConfig = getMarkdownEditorCrepeConfig({
      isDarkMode: false,
      placeholder: 'e.g. ## Test note',
      supportedTools: [MARKDOWN_EDITOR_TOOLS.Image],
    });

    const imageBlockConfig = crepeConfig.featureConfigs?.[CrepeFeature.ImageBlock];

    expect(imageBlockConfig).toMatchObject({
      blockUploadPlaceholderText: 'e.g. https://example.com/image.png',
      inlineUploadPlaceholderText: 'e.g. https://example.com/image.png',
    });
  });

  test(
    'getMarkdownEditorCrepeConfig enables the native toolbar for variables',
    { tags: ['full'] },
    () => {
      const crepeConfig = getMarkdownEditorCrepeConfig({
        isDarkMode: false,
        placeholder: 'e.g. Hello {{FIRST_NAME}}',
        supportedTools: [MARKDOWN_EDITOR_TOOLS.Variable],
      });
      const toolbarConfig = crepeConfig.featureConfigs?.[CrepeFeature.Toolbar];

      expect(crepeConfig.features?.[CrepeFeature.Toolbar]).toBe(true);
      expect(toolbarConfig?.buildToolbar).toBeTypeOf('function');
    },
  );

  test(
    "getMarkdownEditorCrepeConfig gives Crepe's toolbar buttons the names the editor applies",
    { tags: ['full'] },
    () => {
      const toolbarConfig = getMarkdownEditorCrepeConfig({
        isDarkMode: false,
        placeholder: 'e.g. Write here',
        supportedTools: [MARKDOWN_EDITOR_TOOLS.Bold, MARKDOWN_EDITOR_TOOLS.Link],
      }).featureConfigs?.[CrepeFeature.Toolbar];

      expect(toolbarConfig).toMatchObject({
        boldLabel: 'Bold',
        italicLabel: 'Italic',
        strikethroughLabel: 'Strikethrough',
        codeLabel: 'Inline code',
        latexLabel: 'Inline math',
        linkLabel: 'Insert link',
      });
    },
  );

  test(
    'getMarkdownEditorCrepeConfig enables the insert menu for variables',
    { tags: ['full'] },
    () => {
      const crepeConfig = getMarkdownEditorCrepeConfig({
        isDarkMode: false,
        placeholder: 'e.g. Hello {{FIRST_NAME}}',
        supportedTools: [MARKDOWN_EDITOR_TOOLS.Variable],
      });
      const blockEditConfig = crepeConfig.featureConfigs?.[CrepeFeature.BlockEdit];

      expect(crepeConfig.features?.[CrepeFeature.BlockEdit]).toBe(true);
      expect(blockEditConfig?.buildMenu).toBeTypeOf('function');
    },
  );

  test(
    'getMarkdownEditorCrepeConfig enables Advanced insertion for YouTube only when supported',
    { tags: ['full'] },
    () => {
      const supportedConfig = getMarkdownEditorCrepeConfig({
        isDarkMode: false,
        placeholder: 'e.g. /youtube',
        supportedTools: [MARKDOWN_EDITOR_TOOLS.YouTube],
      });
      const filteredConfig = getMarkdownEditorCrepeConfig({
        isDarkMode: false,
        placeholder: 'e.g. note',
        supportedTools: [MARKDOWN_EDITOR_TOOLS.Text],
      });

      expect(supportedConfig.features?.[CrepeFeature.BlockEdit]).toBe(true);
      expect(
        supportedConfig.featureConfigs?.[CrepeFeature.BlockEdit]?.advancedGroup,
      ).not.toBeNull();
      expect(supportedConfig.featureConfigs?.[CrepeFeature.BlockEdit]?.buildMenu).toBeTypeOf(
        'function',
      );
      expect(filteredConfig.featureConfigs?.[CrepeFeature.BlockEdit]?.buildMenu).toBeUndefined();
    },
  );

  test(
    'getMarkdownEditorCrepeConfig exposes only authoring headings in Crepe menus',
    { tags: ['full'] },
    () => {
      const crepeConfig = getMarkdownEditorCrepeConfig({
        isDarkMode: false,
        placeholder: 'e.g. ## Test note',
        supportedTools: MARKDOWN_EDITOR_AUTHORING_TOOLS,
      });
      const blockEditConfig = crepeConfig.featureConfigs?.[CrepeFeature.BlockEdit];
      const topBarConfig = crepeConfig.featureConfigs?.[CrepeFeature.TopBar];

      expect(blockEditConfig).toMatchObject({
        textGroup: {
          h4: null,
          h5: null,
          h6: null,
        },
      });
      for (const heading of ['h1', 'h2', 'h3'] as const) {
        expect(blockEditConfig?.textGroup?.[heading]?.icon).toContain('<svg');
      }
      expect(topBarConfig?.headingOptions).toStrictEqual([
        { label: 'Paragraph', level: null },
        { label: 'Heading 1', level: 1 },
        { label: 'Heading 2', level: 2 },
        { label: 'Heading 3', level: 3 },
      ]);
    },
  );

  test(
    'getMarkdownEditorCrepeConfig serializes table icons as outline SVGs',
    { tags: ['full'] },
    () => {
      const crepeConfig = getMarkdownEditorCrepeConfig({
        isDarkMode: false,
        placeholder: 'e.g. table notes',
        supportedTools: MARKDOWN_EDITOR_AUTHORING_TOOLS,
      });
      const blockEditConfig = crepeConfig.featureConfigs?.[CrepeFeature.BlockEdit];

      const icon = blockEditConfig?.advancedGroup?.table?.icon;
      expect(icon).toContain('data-editor-icon="outline"');
      expect(icon).toContain('<rect fill="none"');
    },
  );

  test('Crepe slash menu exposes only authoring heading levels', { tags: ['full'] }, async () => {
    const root = document.createElement('div');
    const crepeConfig = getMarkdownEditorCrepeConfig({
      isDarkMode: false,
      placeholder: 'e.g. ## Test note',
      supportedTools: MARKDOWN_EDITOR_AUTHORING_TOOLS,
    });
    const crepe = new Crepe({
      defaultValue: '/',
      ...crepeConfig,
      features: {
        ...crepeConfig.features,
        [CrepeFeature.Cursor]: false,
      },
      root,
    });

    document.body.append(root);
    configureMarkdownEditorTestSerialization(crepe);

    try {
      await crepe.create();
      crepe.editor.action((ctx) => {
        ctx.get(editorViewCtx).focus();
      });
      placeMarkdownEditorCursorInsideText(crepe, '/', 1);

      await vi.waitFor(() => {
        expect(root.querySelector('.milkdown-slash-menu')?.getAttribute('data-show')).toBe('true');
      });

      const slashMenu = document.querySelector<HTMLElement>('.milkdown-slash-menu');

      expect(slashMenu?.dataset['show']).toBe('true');
      expect(slashMenu ? root.contains(slashMenu) : false).toBe(true);
      expect(slashMenu?.textContent).toContain('Heading 1');
      expect(slashMenu?.textContent).toContain('Heading 2');
      expect(slashMenu?.textContent).toContain('Heading 3');
      expect(slashMenu?.textContent).not.toContain('Heading 4');
      expect(slashMenu?.textContent).not.toContain('Heading 5');
      expect(slashMenu?.textContent).not.toContain('Heading 6');
    } finally {
      await crepe.destroy();
      root.remove();
      document.querySelectorAll('.milkdown-slash-menu').forEach((slashMenu) => {
        slashMenu.remove();
      });
    }
  });

  test('Crepe slash menu composes Variable and YouTube without exposing filtered items', async () => {
    const root = document.createElement('div');
    const onYouTubeVideoInsertRequest = vi.fn();
    const crepeConfig = getMarkdownEditorCrepeConfig({
      isDarkMode: false,
      onYouTubeVideoInsertRequest,
      placeholder: 'e.g. /youtube',
      supportedTools: [MARKDOWN_EDITOR_TOOLS.Variable, MARKDOWN_EDITOR_TOOLS.YouTube],
    });
    const crepe = new Crepe({
      defaultValue: '/',
      ...crepeConfig,
      features: {
        ...crepeConfig.features,
        [CrepeFeature.Cursor]: false,
      },
      root,
    });

    document.body.append(root);
    configureMarkdownEditorTestSerialization(crepe);

    try {
      await crepe.create();
      crepe.editor.action((ctx) => {
        ctx.get(editorViewCtx).focus();
      });
      placeMarkdownEditorCursorInsideText(crepe, '/', 1);

      await vi.waitFor(() => {
        expect(root.querySelector('.milkdown-slash-menu')?.getAttribute('data-show')).toBe('true');
      });

      const slashMenu = root.querySelector<HTMLElement>('.milkdown-slash-menu');
      const menuItems = Array.from(
        slashMenu?.querySelectorAll<HTMLElement>('.menu-group li') ?? [],
      );
      const youTubeMenuItem = menuItems.find((menuItem) =>
        menuItem.textContent?.includes('YouTube video'),
      );

      expect(slashMenu?.textContent).toContain('Variable');
      expect(slashMenu?.textContent).toContain('YouTube video');
      expect(slashMenu?.textContent).not.toContain('Image');
      expect(slashMenu?.textContent).not.toContain('Table');
      expect(youTubeMenuItem).not.toBeUndefined();

      youTubeMenuItem?.dispatchEvent(new Event('pointerup', { bubbles: true }));

      expect(onYouTubeVideoInsertRequest).toHaveBeenCalledOnce();
      const request: unknown = onYouTubeVideoInsertRequest.mock.calls[0]?.[0];
      expect(request).toHaveProperty('blockText', '/');
      expect(request).toHaveProperty('editorElement', root.querySelector('.ProseMirror'));
    } finally {
      await crepe.destroy();
      root.remove();
      document.querySelectorAll('.milkdown-slash-menu').forEach((slashMenu) => {
        slashMenu.remove();
      });
    }
  });

  test('Crepe preserves the full heading scale while offering H1 through H3', async () => {
    const root = document.createElement('div');
    const markdown = [
      'Intro paragraph',
      '# Heading 1',
      '## Heading 2',
      '### Heading 3',
      '#### Heading 4',
      '##### Heading 5',
      '###### Heading 6',
    ].join('\n\n');
    const crepeConfig = getMarkdownEditorCrepeConfig({
      isDarkMode: false,
      placeholder: 'e.g. ## Test note',
      supportedTools: MARKDOWN_EDITOR_AUTHORING_TOOLS,
    });
    const crepe = new Crepe({
      defaultValue: markdown,
      ...crepeConfig,
      features: {
        ...crepeConfig.features,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.TopBar]: true,
      },
      root,
    });

    document.body.append(root);
    configureMarkdownEditorTestSerialization(crepe);

    try {
      await crepe.create();

      const serializedMarkdown = getMarkdownEditorMarkdown(crepe);

      expect(serializedMarkdown).toContain('# Heading 1');
      expect(serializedMarkdown).toContain('## Heading 2');
      expect(serializedMarkdown).toContain('### Heading 3');
      expect(serializedMarkdown).toContain('#### Heading 4');
      expect(serializedMarkdown).toContain('##### Heading 5');
      expect(serializedMarkdown).toContain('###### Heading 6');

      await vi.waitFor(() =>
        expect(root.querySelector('.top-bar-heading-button')?.textContent).toContain('Paragraph'),
      );
      placeMarkdownEditorCursorInsideText(crepe, 'Heading 4', 4);

      await vi.waitFor(() => {
        expect(root.querySelector('.top-bar-heading-button')?.textContent).toContain('Heading 4');
      });

      const headingButton = document.querySelector<HTMLButtonElement>('.top-bar-heading-button');

      expect(headingButton).not.toBeNull();
      expect(headingButton?.textContent).toContain('Heading 4');

      headingButton?.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(root.querySelectorAll('.top-bar-heading-option')).toHaveLength(4);
      });

      const headingOptions = Array.from(
        document.querySelectorAll<HTMLElement>('.top-bar-heading-option'),
      ).map((option) => option.textContent);

      expect(headingOptions).toStrictEqual(['Paragraph', 'Heading 1', 'Heading 2', 'Heading 3']);
      placeMarkdownEditorCursorInsideText(crepe, 'Intro paragraph', 4);
      await vi.waitFor(() =>
        expect(root.querySelector('.top-bar-heading-button')?.textContent).toContain('Paragraph'),
      );
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('Crepe preserves the serializer bullet marker configuration', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      defaultValue: '- First item\n- Second item',
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);
    crepe.editor.config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (previousOptions) => ({
        ...previousOptions,
        bullet: '+' as const,
      }));
    });
    configureMarkdownEditorTestSerialization(crepe);

    try {
      await crepe.create();

      expect(getMarkdownEditorMarkdown(crepe)).toContain('+ First item');
      expect(getMarkdownEditorMarkdown(crepe)).not.toContain('- First item');
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('syncEditorAttributes applies and clears validation semantics', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);

    try {
      await crepe.create();
      syncEditorAttributes(
        crepe,
        'Application statement',
        'application-help application-error',
        'grammar',
        true,
      );

      const editor = crepe.editor.action((ctx) => ctx.get(editorViewCtx).dom);
      expect(editor.getAttribute('aria-label')).toBe('Application statement');
      expect(editor.getAttribute('aria-describedby')).toBe('application-help application-error');
      expect(editor.getAttribute('aria-invalid')).toBe('grammar');
      expect(editor.getAttribute('aria-required')).toBe('true');
      expect(editor.getAttribute('aria-readonly')).toBe('false');

      crepe.setReadonly(true);
      syncEditorAttributes(
        crepe,
        'Application statement',
        'application-help application-error',
        'grammar',
        true,
      );
      expect(editor.getAttribute('contenteditable')).toBe('false');
      expect(editor.getAttribute('aria-readonly')).toBe('true');
      expect(editor.getAttribute('aria-describedby')).toBe('application-help application-error');
      expect(editor.getAttribute('aria-invalid')).toBe('grammar');
      expect(editor.getAttribute('aria-required')).toBe('true');

      crepe.setReadonly(false);
      syncEditorAttributes(crepe, 'Application statement');

      expect(editor.getAttribute('contenteditable')).toBe('true');
      expect(editor.getAttribute('aria-readonly')).toBe('false');
      expect(editor.getAttribute('aria-describedby')).toBeNull();
      expect(editor.getAttribute('aria-invalid')).toBeNull();
      expect(editor.getAttribute('aria-required')).toBeNull();
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('getVisibleMarkdownEditorToolbarActions filters the moldea markdown policy', () => {
    const toolbarActions = getVisibleMarkdownEditorToolbarActions(MARKDOWN_EDITOR_AUTHORING_TOOLS);

    expect(toolbarActions.map((action) => action.tool)).toStrictEqual([
      MARKDOWN_EDITOR_TOOLS.Bold,
      MARKDOWN_EDITOR_TOOLS.Italic,
      MARKDOWN_EDITOR_TOOLS.InlineCode,
      MARKDOWN_EDITOR_TOOLS.Link,
      MARKDOWN_EDITOR_TOOLS.Variable,
    ]);
  });

  test(
    'getVisibleMarkdownEditorToolbarActions exposes every inline toolbar option by default',
    { tags: ['full'] },
    () => {
      const toolbarActions = getVisibleMarkdownEditorToolbarActions();

      expect(toolbarActions.map((action) => action.tool)).toStrictEqual([
        MARKDOWN_EDITOR_TOOLS.Bold,
        MARKDOWN_EDITOR_TOOLS.Italic,
        MARKDOWN_EDITOR_TOOLS.Strikethrough,
        MARKDOWN_EDITOR_TOOLS.InlineCode,
        MARKDOWN_EDITOR_TOOLS.Math,
        MARKDOWN_EDITOR_TOOLS.Link,
        MARKDOWN_EDITOR_TOOLS.Variable,
      ]);
    },
  );

  test('ensureMarkdownEditorVueFragmentGlobal defines Crepe image input fragment compatibility', () => {
    const globalScope = globalThis as IMarkdownEditorGlobalScope;
    const previousFragment = globalScope.Fragment;

    Reflect.deleteProperty(globalScope, 'Fragment');

    try {
      ensureMarkdownEditorVueFragmentGlobal();

      expect(globalScope.Fragment).toBe(Symbol.for('v-fgt'));
    } finally {
      if (previousFragment === undefined) {
        Reflect.deleteProperty(globalScope, 'Fragment');
      } else {
        globalScope.Fragment = previousFragment;
      }
    }
  });

  test('applyMarkdownEditorAccessibility disables image upload controls', () => {
    const container = document.createElement('div');

    container.innerHTML = `
      <div class="image-edit">
        <div class="link-importer">
          <div class="placeholder">
            <input id="image-upload" type="file" />
            <label class="uploader" for="image-upload">Upload file</label>
            <span class="text">Paste image link</span>
          </div>
        </div>
      </div>
    `;

    document.body.append(container);

    try {
      applyMarkdownEditorAccessibility(container);

      const imageUploadInput = container.querySelector<HTMLInputElement>("input[type='file']");
      const imageUploadLabel = container.querySelector<HTMLLabelElement>('.uploader');

      expect(imageUploadInput?.disabled).toBe(true);
      expect(imageUploadInput?.hidden).toBe(true);
      expect(imageUploadInput?.getAttribute('aria-hidden')).toBe('true');
      expect(imageUploadLabel?.hidden).toBe(true);
      expect(imageUploadLabel?.getAttribute('aria-hidden')).toBe('true');
    } finally {
      container.remove();
    }
  });

  test.each([
    [null, null],
    ['button', 'Insert block'],
  ])(
    'applyMarkdownEditorAccessibility preserves insertion semantics owned by the empty state (%s)',
    (role, label) => {
      const container = document.createElement('div');
      container.innerHTML =
        '<div class="milkdown-block-handle"><div class="operation-item"></div><div class="operation-item"></div></div>';
      const insertionControl = container.querySelector<HTMLElement>('.operation-item')!;
      if (role !== null) insertionControl.setAttribute('role', role);
      if (label !== null) insertionControl.setAttribute('aria-label', label);
      document.body.append(container);

      try {
        applyMarkdownEditorAccessibility(container);
        applyMarkdownEditorAccessibility(container);
        expect(insertionControl.getAttribute('role')).toBe(role);
        expect(insertionControl.getAttribute('aria-label')).toBe(label);
      } finally {
        container.remove();
      }
    },
  );

  test(
    'applyMarkdownEditorAccessibility labels visible native toolbar items',
    { tags: ['full'] },
    () => {
      const container = document.createElement('div');

      container.innerHTML = `
      <div class="milkdown-toolbar">
        <button class="toolbar-item" type="button"></button>
        <button class="toolbar-item" type="button"></button>
        <button class="toolbar-item" type="button"></button>
        <button class="toolbar-item" type="button"></button>
        <button class="toolbar-item" type="button"></button>
      </div>
    `;

      document.body.append(container);

      try {
        applyMarkdownEditorAccessibility(container, MARKDOWN_EDITOR_AUTHORING_TOOLS);

        const toolbarButtons = Array.from(
          container.querySelectorAll<HTMLButtonElement>('.toolbar-item'),
        );

        expect(toolbarButtons.map((button) => button.getAttribute('aria-label'))).toStrictEqual([
          'Bold',
          'Italic',
          'Inline code',
          'Insert link',
          'Insert variable',
        ]);
        expect(toolbarButtons.some((button) => button.hidden)).toBe(false);
      } finally {
        container.remove();
      }
    },
  );

  test('applyMarkdownEditorAccessibility leaves toolbars outside the editor wrapper unchanged', () => {
    const container = document.createElement('div');
    const outsideToolbar = document.createElement('div');

    container.innerHTML = `
      <div class="milkdown-toolbar">
        <button class="toolbar-item" type="button"></button>
      </div>
    `;
    outsideToolbar.innerHTML = `
      <div class="milkdown-toolbar">
        <button class="toolbar-item" type="button"></button>
      </div>
    `;

    document.body.append(container, outsideToolbar);

    try {
      applyMarkdownEditorAccessibility(container, MARKDOWN_EDITOR_AUTHORING_TOOLS);

      const insideButton = container.querySelector<HTMLButtonElement>('.toolbar-item');
      const outsideButton = outsideToolbar.querySelector<HTMLButtonElement>('.toolbar-item');

      expect(insideButton?.getAttribute('aria-label')).toBe('Bold');
      expect(outsideButton?.getAttribute('aria-label')).toBeNull();
    } finally {
      container.remove();
      outsideToolbar.remove();
    }
  });

  test(
    'applyMarkdownEditorAccessibility labels enabled heading controls',
    { tags: ['full'] },
    () => {
      const container = document.createElement('div');

      container.innerHTML = `
      <div class="milkdown-top-bar">
        <button class="top-bar-heading-button" type="button">Paragraph</button>
      </div>
    `;

      document.body.append(container);

      try {
        applyMarkdownEditorAccessibility(container, MARKDOWN_EDITOR_AUTHORING_TOOLS);

        const headingButton = container.querySelector<HTMLButtonElement>('.top-bar-heading-button');

        expect(headingButton?.getAttribute('aria-label')).toBe('Text style');
        expect(headingButton?.hidden).toBe(false);
      } finally {
        container.remove();
      }
    },
  );

  test(
    'applyMarkdownEditorAccessibility resets menu scroll when menus open',
    { tags: ['full'] },
    async () => {
      const container = document.createElement('div');

      container.innerHTML = `
      <div class="milkdown-slash-menu" data-show="true">
        <div class="menu-groups" style="height: 16px; overflow: auto"><div style="height: 256px"></div></div>
      </div>
      <div class="milkdown-top-bar">
        <div class="top-bar-heading-selector">
          <div class="top-bar-heading-dropdown" style="height: 16px; overflow: auto"><div style="height: 256px"></div></div>
        </div>
      </div>
    `;

      document.body.append(container);

      try {
        const slashMenuGroups = container.querySelector<HTMLElement>('.menu-groups');
        const topBarDropdown = container.querySelector<HTMLElement>('.top-bar-heading-dropdown');

        expect(slashMenuGroups).toBeInstanceOf(HTMLElement);
        expect(topBarDropdown).toBeInstanceOf(HTMLElement);

        if (!slashMenuGroups || !topBarDropdown) {
          return;
        }

        slashMenuGroups.scrollTop = 48;
        topBarDropdown.scrollTop = 32;
        applyMarkdownEditorAccessibility(container);

        await vi.waitFor(() => {
          expect(slashMenuGroups.scrollTop).toBe(0);
          expect(topBarDropdown.scrollTop).toBe(0);
        });

        slashMenuGroups.scrollTop = 48;
        topBarDropdown.scrollTop = 32;
        applyMarkdownEditorAccessibility(container);

        expect(slashMenuGroups.scrollTop).toBe(48);
        expect(topBarDropdown.scrollTop).toBe(32);
      } finally {
        container.remove();
      }
    },
  );

  test('Crepe image input accepts pasted image links', async () => {
    const root = document.createElement('div');
    const imageUrl = 'https://example.com/image.png';
    const crepe = new Crepe({
      defaultValue: '![]()',
      ...getMarkdownEditorCrepeConfig({
        isDarkMode: false,
        placeholder: 'e.g. ## Test note',
        supportedTools: [MARKDOWN_EDITOR_TOOLS.Image],
      }),
      root,
    });

    document.body.append(root);
    ensureMarkdownEditorVueFragmentGlobal();
    crepe.editor.config(disableMarkdownEditorFileUploads);

    try {
      await crepe.create();

      const imageLinkInput = root.querySelector<HTMLInputElement>('.link-input-area');

      expect(imageLinkInput).toBeInstanceOf(HTMLInputElement);

      if (!imageLinkInput) {
        return;
      }

      applyMarkdownEditorAccessibility(root);

      imageLinkInput.value = imageUrl;
      imageLinkInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
      applyMarkdownEditorAccessibility(root);
      imageLinkInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));

      expect(crepe.getMarkdown()).toContain(imageUrl);
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('patchMarkdownEditorInlineMathSchemaPlugin allows inline math documents to mount', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      defaultValue: 'Use $E = mc^2$ inline math.',
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: true,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: true,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);
    crepe.editor.use(patchMarkdownEditorInlineMathSchemaPlugin);

    try {
      await expect(crepe.create()).resolves.toBeDefined();
      expect(root.querySelector('[data-type="math_inline"]')?.textContent).toBe('$E = mc^2$');
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const type = view.state.schema.nodes['math_inline']!;
        const dom = type.spec.toDOM!(type.create({ value: null }));
        expect(dom).toContain('$$');
      });
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('highlightMarkdownEditorVariablesPlugin decorates variables without changing markdown', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      defaultValue: 'Hello {{FIRST_NAME}}, keep `{{RAW_VARIABLE}}` as code.',
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);
    crepe.editor.use(highlightMarkdownEditorVariablesPlugin);
    configureMarkdownEditorTestSerialization(crepe);

    try {
      await crepe.create();

      const variables = Array.from(root.querySelectorAll('[data-slot="markdown-variable"]'));
      const markdown = crepe.getMarkdown();

      expect(variables.map((variable) => variable.textContent)).toStrictEqual(['{{FIRST_NAME}}']);
      expect(variables[0]?.className).toContain('bg-foreground/10');
      expect(variables[0]?.className).toContain('text-foreground');
      expect(root.querySelector('code')?.textContent).toBe('{{RAW_VARIABLE}}');
      expect(markdown).toContain('{{FIRST_NAME}}');
      expect(markdown).toContain('`{{RAW_VARIABLE}}`');
      expect(markdown).not.toContain('data-slot');
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('insertMarkdownEditorVariable inserts the fallback variable at the current cursor', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      defaultValue: '',
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);
    configureMarkdownEditorTestSerialization(crepe);

    try {
      await crepe.create();

      expect(insertMarkdownEditorVariable(crepe)).toBe(true);
      expect(root.textContent).toContain('{{VARIABLE_NAME}}');
      expect(crepe.getMarkdown()).toContain('{{VARIABLE_NAME}}');
      expect(getSelectedMarkdownEditorText(crepe)).toBe('VARIABLE_NAME');
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('insertMarkdownEditorVariable turns selected text into a normalized variable', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      defaultValue: 'Hello First name.',
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);
    configureMarkdownEditorTestSerialization(crepe);

    try {
      await crepe.create();
      selectMarkdownEditorText(crepe, 'First name');

      expect(insertMarkdownEditorVariable(crepe)).toBe(true);
      expect(root.textContent).toContain('Hello {{FIRST_NAME}}.');
      expect(crepe.getMarkdown()).toContain('Hello {{FIRST_NAME}}.');
      expect(getSelectedMarkdownEditorText(crepe)).toBe('FIRST_NAME');
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('insertMarkdownEditorVariable restores a selected variable token to readable text', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      defaultValue: 'Status: {{PROJECT_STATUS}}.',
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);
    configureMarkdownEditorTestSerialization(crepe);

    try {
      await crepe.create();
      selectMarkdownEditorText(crepe, '{{PROJECT_STATUS}}');

      expect(insertMarkdownEditorVariable(crepe)).toBe(true);
      expect(root.textContent).toContain('Status: project status.');
      expect(crepe.getMarkdown()).toContain('Status: project status.');
      expect(crepe.getMarkdown()).not.toContain('{{PROJECT');
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('insertMarkdownEditorVariable restores a variable when only its name is selected', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      defaultValue: 'Hello {{FIRST_NAME}}.',
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);

    try {
      await crepe.create();
      selectMarkdownEditorText(crepe, 'FIRST_NAME');

      expect(insertMarkdownEditorVariable(crepe)).toBe(true);
      expect(root.textContent).toContain('Hello first name.');
      expect(crepe.getMarkdown()).toContain('Hello first name.');
      expect(crepe.getMarkdown()).not.toContain('{{FIRST');
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('insertMarkdownEditorVariable restores a variable when the cursor is inside it', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      defaultValue: 'Due: {{DUE_DATE}}.',
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);

    try {
      await crepe.create();
      placeMarkdownEditorCursorInsideText(crepe, '{{DUE_DATE}}', 4);

      expect(insertMarkdownEditorVariable(crepe)).toBe(true);
      expect(root.textContent).toContain('Due: due date.');
      expect(crepe.getMarkdown()).toContain('Due: due date.');
      expect(crepe.getMarkdown()).not.toContain('{{DUE');
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test('turnMarkdownEditorBlockInto turns block text into a variable token', async () => {
    const root = document.createElement('div');
    const crepe = new Crepe({
      defaultValue: 'Project status',
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.ListItem]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.Table]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: false,
      },
      root,
    });

    document.body.append(root);

    try {
      await crepe.create();
      placeMarkdownEditorCursorInsideText(crepe, 'Project status', 3);

      const target = getMarkdownEditorBlockActionTarget(crepe);

      expect(target).not.toBeNull();

      if (!target) {
        return;
      }

      expect(
        turnMarkdownEditorBlockInto(crepe, target, getMarkdownEditorTurnIntoOption('variable')),
      ).toBe(true);
      expect(root.textContent).toContain('{{PROJECT_STATUS}}');
      expect(getMarkdownEditorMarkdown(crepe)).toContain('{{PROJECT_STATUS}}');

      const variableTarget = getMarkdownEditorBlockActionTarget(crepe);

      expect(variableTarget).not.toBeNull();

      if (!variableTarget) {
        return;
      }

      expect(getMarkdownEditorActiveTurnIntoOptionKind(variableTarget)).toBe('variable');
    } finally {
      await crepe.destroy();
      root.remove();
    }
  });

  test.each([
    ['paragraph', 'project status'],
    ['heading-2', '## project status'],
  ] satisfies Array<[IMarkdownEditorTurnIntoOptionKind, string]>)(
    'turnMarkdownEditorBlockInto restores variables when turning into %s',
    async (optionKind, expectedMarkdown) => {
      const root = document.createElement('div');
      const crepe = new Crepe({
        defaultValue: '{{PROJECT_STATUS}}',
        features: {
          [CrepeFeature.BlockEdit]: false,
          [CrepeFeature.CodeMirror]: false,
          [CrepeFeature.Cursor]: false,
          [CrepeFeature.ImageBlock]: false,
          [CrepeFeature.Latex]: false,
          [CrepeFeature.LinkTooltip]: false,
          [CrepeFeature.ListItem]: false,
          [CrepeFeature.Placeholder]: false,
          [CrepeFeature.Table]: false,
          [CrepeFeature.Toolbar]: false,
          [CrepeFeature.TopBar]: false,
        },
        root,
      });

      document.body.append(root);

      try {
        await crepe.create();
        placeMarkdownEditorCursorInsideText(crepe, '{{PROJECT_STATUS}}', 4);

        const target = getMarkdownEditorBlockActionTarget(crepe);

        expect(target).not.toBeNull();

        if (!target) {
          return;
        }

        expect(
          turnMarkdownEditorBlockInto(crepe, target, getMarkdownEditorTurnIntoOption(optionKind)),
        ).toBe(true);
        expect(root.textContent).toContain('project status');
        expect(crepe.getMarkdown()).toContain(expectedMarkdown);
        expect(crepe.getMarkdown()).not.toContain('{{PROJECT');
      } finally {
        await crepe.destroy();
        root.remove();
      }
    },
  );

  test.each([
    [
      {
        from: 0,
        headingLevel: null,
        isTextBlock: true,
        nodeTypeName: 'paragraph',
        plainTextContent: 'Text',
        to: 8,
      },
      'paragraph',
    ],
    [
      {
        from: 0,
        headingLevel: null,
        isTextBlock: true,
        nodeTypeName: 'paragraph',
        plainTextContent: '{{PROJECT_STATUS}}',
        to: 8,
      },
      'variable',
    ],
    [
      {
        from: 0,
        headingLevel: 3,
        isTextBlock: true,
        nodeTypeName: 'heading',
        plainTextContent: 'Heading',
        to: 8,
      },
      'heading-3',
    ],
    [
      {
        from: 0,
        headingLevel: 4,
        isTextBlock: true,
        nodeTypeName: 'heading',
        plainTextContent: 'Heading',
        to: 8,
      },
      null,
    ],
    [
      {
        from: 0,
        headingLevel: null,
        isTextBlock: false,
        nodeTypeName: 'bullet_list',
        plainTextContent: 'List',
        to: 8,
      },
      'bullet-list',
    ],
    [
      {
        from: 0,
        headingLevel: null,
        isTextBlock: false,
        nodeTypeName: 'blockquote',
        plainTextContent: 'Quote',
        to: 8,
      },
      'quote',
    ],
    [
      {
        from: 0,
        headingLevel: null,
        isTextBlock: false,
        nodeTypeName: 'ordered_list',
        plainTextContent: 'List',
        to: 8,
      },
      'ordered-list',
    ],
    [
      {
        from: 0,
        headingLevel: null,
        isTextBlock: true,
        nodeTypeName: 'code_block',
        plainTextContent: 'Code',
        to: 8,
      },
      'code',
    ],
    [
      {
        from: 0,
        headingLevel: null,
        isTextBlock: false,
        nodeTypeName: 'table',
        plainTextContent: '',
        to: 8,
      },
      'table',
    ],
    [
      {
        from: 0,
        headingLevel: null,
        isTextBlock: false,
        nodeTypeName: 'html',
        plainTextContent: '',
        to: 8,
      },
      null,
    ],
  ] satisfies Array<[IMarkdownEditorBlockActionTarget, string | null]>)(
    'getMarkdownEditorActiveTurnIntoOptionKind(%o) -> %s',
    (target, expectedKind) => {
      expect(getMarkdownEditorActiveTurnIntoOptionKind(target)).toBe(expectedKind);
    },
  );

  test(
    'getMarkdownEditorTurnIntoMenuPosition uses the shorter mobile menu height',
    { tags: ['full'] },
    () => {
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(240);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(300);

      const position = getMarkdownEditorTurnIntoMenuPosition(new DOMRect(220, -12, 32, 32));

      expect(position).toStrictEqual({
        left: 8,
        maxHeight: 192,
        top: 8,
      });
    },
  );

  test(
    'getMarkdownEditorTurnIntoMenuPosition shifts tall menus above the viewport edge',
    { tags: ['full'] },
    () => {
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(640);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(300);

      const position = getMarkdownEditorTurnIntoMenuPosition(new DOMRect(100, 280, 32, 32));

      expect(position).toStrictEqual({
        left: 140,
        maxHeight: 256,
        top: 36,
      });
    },
  );
});
