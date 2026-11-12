import {
  useRef,
  useState,
  useMemo,
  useId,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import type * as React from 'react';
import { Crepe } from '@milkdown/crepe';
import {
  commandsCtx,
  EditorStatus,
  editorViewCtx,
  editorViewOptionsCtx,
  parserCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import {
  turnIntoTextCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { Milkdown, MilkdownProvider, useEditor, type GetEditor } from '@milkdown/react';
import { createPortal } from 'react-dom';
import { cn } from 'cnfast';

import type { IYouTubeVideoDescriptor } from '../../shared/youtube-video/index.js';

import { MARKDOWN_EDITOR_ALL_TOOLS, MARKDOWN_EDITOR_TOOLS } from './constants.js';
import {
  openEmptyMarkdownEditorInsertMenu,
  syncMarkdownEditorEmptyState,
} from './empty-state.utilities.js';
import { createChatMarkdownPolicyPlugin } from './chat-editor/policy.plugin.js';
import { CHAT_MARKDOWN_EDITOR_TOOLS } from './chat-editor/constants.js';
import { buildChatMarkdownLiteralAppend, measureChatMarkdown } from './chat-editor/policy.js';
import type {
  IChatMarkdownBlockFormat,
  IChatMarkdownEditorInternalControls,
} from './chat-editor/types.js';
import {
  isMarkdownEditorSelectionInListItem,
  moveFocusFromMarkdownEditor,
} from './keyboard.utilities.js';
import { MarkdownEditorBlockActionMenu } from './markdown-editor-block-action-menu.component.js';
import { useMarkdownEditorBlockHandleInteractions } from './markdown-editor-block-handle-interactions.hook.js';
import { mountMarkdownEditorSlashMenuPortal } from './slash-menu.utilities.js';
import { getMarkdownEditorSupportedToolsKey } from './tool-policy.utilities.js';
import type {
  IMarkdownEditorBlockActionMenuState,
  IMarkdownEditorContentProps,
  IMarkdownEditorTurnIntoOption,
} from './types.js';
import {
  MarkdownEditorYouTubeVideoDialog,
  configureMarkdownEditorYouTubeVideoAuthoring,
  createMarkdownEditorYouTubeVideoAuthoringController,
  insertMarkdownEditorYouTubeVideo,
  markdownEditorYouTubeVideoPlugin,
  updateMarkdownEditorYouTubeVideo,
  type IMarkdownEditorYouTubeVideoDialogState,
  type IMarkdownEditorYouTubeVideoEditRequest,
  type IMarkdownEditorYouTubeVideoInsertionRequest,
} from './youtube-video/index.js';
import {
  applyMarkdownEditorAccessibility,
  configureMarkdownEditorSerialization,
  deleteMarkdownEditorBlock,
  disableMarkdownEditorFileUploads,
  ensureMarkdownEditorVueFragmentGlobal,
  getMarkdownEditorCrepeConfig,
  getMarkdownEditorActiveTurnIntoOptionKind,
  getMarkdownEditorBlockActionTarget,
  getMarkdownEditorMarkdown,
  getMarkdownEditorTurnIntoMenuPosition,
  highlightMarkdownEditorVariablesPlugin,
  patchMarkdownEditorInlineMathSchemaPlugin,
  replaceMarkdownEditorMarkdown,
  syncEditorAttributes,
  syncEditorPlaceholder,
  syncEditorValue,
  turnMarkdownEditorBlockInto,
} from './utilities.js';

/**
 * Renders the controlled editor instance inside an active Milkdown provider.
 * @param props The controlled editor props.
 * @returns A React element that renders the editor instance.
 */
const MarkdownEditorInstance = ({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
  'aria-required': ariaRequired,
  chatOptions,
  className,
  disabled = false,
  editorMode = 'document',
  isDarkMode,
  onChange,
  placeholder = 'e.g. Write your project notes',
  supportedTools = MARKDOWN_EDITOR_ALL_TOOLS,
  value,
}: IMarkdownEditorContentProps): React.ReactElement => {
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const blockActionMenuRef = useRef<HTMLDivElement | null>(null);
  const blockActionMenuTriggerRef = useRef<HTMLElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const currentMarkdownRef = useRef(value);
  const disabledRef = useRef(disabled);
  const latestValueRef = useRef(value);
  const previousControlledValueRef = useRef(value);
  const hasPendingLiteralAppendRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const supportedToolsRef = useRef(supportedTools);
  const chatOptionsRef = useRef(chatOptions);
  const accessibilityObserverRef = useRef<MutationObserver | null>(null);
  const accessibilitySyncIdRef = useRef<number | null>(null);
  const blockActionMenuStateRef = useRef<IMarkdownEditorBlockActionMenuState | null>(null);
  const [blockActionMenuState, setBlockActionMenuState] =
    useState<IMarkdownEditorBlockActionMenuState | null>(null);
  const [blockActionPortalContainer, setBlockActionPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const [mountedEditorWrapper, setMountedEditorWrapper] = useState<HTMLDivElement | null>(null);
  const [youTubeVideoDialogState, setYouTubeVideoDialogState] =
    useState<IMarkdownEditorYouTubeVideoDialogState | null>(null);
  const [isYouTubeVideoDialogOpen, setIsYouTubeVideoDialogOpen] = useState(false);
  const supportedToolsKey = useMemo(
    () => getMarkdownEditorSupportedToolsKey(supportedTools),
    [supportedTools],
  );
  const slashMenuOwnerId = useId();
  const isBlockActionMenuOpen = blockActionMenuState !== null;
  const isYouTubeVideoAuthoringEnabled =
    !disabled && supportedTools.includes(MARKDOWN_EDITOR_TOOLS.YouTube);

  /**
   * Opens an add dialog only while the latest editor policy permits YouTube mutations.
   * @param request The safe insertion selection captured by the Crepe slash menu.
   */
  const openYouTubeVideoAddDialog = useCallback(
    (request: IMarkdownEditorYouTubeVideoInsertionRequest): void => {
      if (
        !disabledRef.current &&
        supportedToolsRef.current.includes(MARKDOWN_EDITOR_TOOLS.YouTube)
      ) {
        setYouTubeVideoDialogState({
          insertionRequest: request,
          mode: 'add',
          resolveReturnFocusElement: () =>
            request.editorElement.isConnected ? request.editorElement : null,
        });
        setIsYouTubeVideoDialogOpen(true);
      }
    },
    [],
  );

  /**
   * Opens an edit dialog only while the latest editor policy permits YouTube mutations.
   * @param request The live node-view edit request.
   */
  const openYouTubeVideoEditDialog = useCallback(
    (request: IMarkdownEditorYouTubeVideoEditRequest): void => {
      if (
        !disabledRef.current &&
        supportedToolsRef.current.includes(MARKDOWN_EDITOR_TOOLS.YouTube)
      ) {
        setYouTubeVideoDialogState({
          descriptor: request.descriptor,
          editRequest: request,
          mode: 'edit',
          resolveReturnFocusElement: request.resolveTriggerElement,
        });
        setIsYouTubeVideoDialogOpen(true);
      }
    },
    [],
  );
  const [youTubeVideoAuthoringController] = useState(() =>
    createMarkdownEditorYouTubeVideoAuthoringController({
      isAuthoringEnabled: false,
      onEditRequest: openYouTubeVideoEditDialog,
    }),
  );

  /**
   * Stores the editor wrapper and the document body used by portal menus.
   * @param element The mounted editor wrapper element.
   */
  const setEditorWrapperElement = useCallback((element: HTMLDivElement | null): void => {
    accessibilityObserverRef.current?.disconnect();
    accessibilityObserverRef.current = null;
    editorWrapperRef.current = element;
    setMountedEditorWrapper(element);
    setBlockActionPortalContainer(element?.ownerDocument.body ?? null);

    if (!element) {
      return;
    }

    const ownerWindow = element.ownerDocument.defaultView ?? window;

    /**
     * Schedules menu and accessibility sync for the current wrapper element.
     */
    const scheduleElementAccessibility = (): void => {
      if (accessibilitySyncIdRef.current !== null) {
        ownerWindow.clearTimeout(accessibilitySyncIdRef.current);
      }

      accessibilitySyncIdRef.current = ownerWindow.setTimeout(() => {
        accessibilitySyncIdRef.current = null;
        applyMarkdownEditorAccessibility(
          element,
          supportedToolsRef.current,
          crepeRef.current ?? undefined,
        );

        const crepe = crepeRef.current;

        if (crepe) {
          syncMarkdownEditorEmptyState(crepe, element);
        }
      }, 16);
    };

    const observer = new MutationObserver(scheduleElementAccessibility);

    observer.observe(element, {
      attributeFilter: ['data-show', 'style'],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });

    accessibilityObserverRef.current = observer;
  }, []);

  /**
   * Emits editor document updates through the latest controlled change handler.
   * @param nextValue The next markdown value emitted by Milkdown.
   */
  const emitChange = useCallback((nextValue: string): void => {
    // destruction is asynchronous; detached editors must not restore a previous draft
    if (!editorWrapperRef.current?.isConnected) return;
    onChangeRef.current(nextValue);
  }, []);

  /**
   * Reapplies editor accessibility fixes against the latest mounted wrapper.
   */
  const applyAccessibility = useCallback((): void => {
    const editorWrapper = editorWrapperRef.current;

    if (!editorWrapper) {
      return;
    }

    applyMarkdownEditorAccessibility(
      editorWrapper,
      supportedToolsRef.current,
      crepeRef.current ?? undefined,
    );

    const crepe = crepeRef.current;

    if (crepe) {
      syncMarkdownEditorEmptyState(crepe, editorWrapper);
    }
  }, []);

  /**
   * Queues one accessibility pass for the next animation frame.
   */
  const scheduleAccessibility = useCallback((): void => {
    const ownerWindow = editorWrapperRef.current?.ownerDocument.defaultView ?? window;

    if (accessibilitySyncIdRef.current !== null) {
      ownerWindow.clearTimeout(accessibilitySyncIdRef.current);
    }

    accessibilitySyncIdRef.current = ownerWindow.setTimeout(() => {
      accessibilitySyncIdRef.current = null;
      applyAccessibility();
    }, 16);
  }, [applyAccessibility]);

  useEffect(() => {
    if (!mountedEditorWrapper || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(scheduleAccessibility);
    observer.observe(mountedEditorWrapper);

    return () => observer.disconnect();
  }, [mountedEditorWrapper, scheduleAccessibility]);

  /**
   * Closes the floating block action menu.
   * @param shouldRestoreFocus Whether keyboard dismissal returns to the retained trigger.
   */
  const closeBlockActionMenu = useCallback((shouldRestoreFocus = false): void => {
    const trigger = blockActionMenuTriggerRef.current;
    blockActionMenuTriggerRef.current = null;
    setBlockActionMenuState(null);
    if (shouldRestoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, []);

  /**
   * Opens the block action menu for the currently selected block handle row.
   * @param triggerElement The second block handle button that triggered the menu.
   */
  const openBlockActionMenu = useCallback(
    (triggerElement: HTMLElement): void => {
      const crepe = crepeRef.current;

      if (!crepe) {
        return;
      }

      const target = getMarkdownEditorBlockActionTarget(crepe);

      if (!target) {
        closeBlockActionMenu();
        return;
      }

      blockActionMenuTriggerRef.current = triggerElement;
      setBlockActionMenuState({
        ...getMarkdownEditorTurnIntoMenuPosition(triggerElement.getBoundingClientRect()),
        target,
      });
    },
    [closeBlockActionMenu],
  );

  /**
   * Repositions the open block action menu against its live trigger.
   */
  const syncBlockActionMenuPosition = useCallback((): void => {
    const triggerElement = blockActionMenuTriggerRef.current;

    if (!triggerElement?.isConnected) {
      closeBlockActionMenu();
      return;
    }

    const nextPosition = getMarkdownEditorTurnIntoMenuPosition(
      triggerElement.getBoundingClientRect(),
    );

    setBlockActionMenuState((currentState) => {
      if (
        currentState &&
        (currentState.left !== nextPosition.left ||
          currentState.maxHeight !== nextPosition.maxHeight ||
          currentState.top !== nextPosition.top)
      ) {
        return { ...currentState, ...nextPosition };
      }
      return currentState;
    });
  }, [closeBlockActionMenu]);

  const handleEmptyAddElementInteraction = useCallback((): boolean => {
    const crepe = crepeRef.current;
    const container = editorWrapperRef.current;

    return Boolean(crepe && container && openEmptyMarkdownEditorInsertMenu(crepe, container));
  }, []);

  useMarkdownEditorBlockHandleInteractions({
    container: mountedEditorWrapper,
    onAddElementInteraction: closeBlockActionMenu,
    onBlockActions: openBlockActionMenu,
    onEmptyAddElementInteraction: handleEmptyAddElementInteraction,
  });

  useEffect(() => {
    if (!mountedEditorWrapper) {
      return;
    }

    return mountMarkdownEditorSlashMenuPortal({
      editorWrapper: mountedEditorWrapper,
      ownerId: slashMenuOwnerId,
    });
  }, [mountedEditorWrapper, slashMenuOwnerId]);

  /**
   * Applies a turn-into command to the selected block menu target.
   * @param option The markdown block type option selected by the user.
   */
  const handleTurnInto = useCallback(
    (option: IMarkdownEditorTurnIntoOption): void => {
      const crepe = crepeRef.current;
      const target = blockActionMenuStateRef.current?.target;

      if (crepe && target) {
        turnMarkdownEditorBlockInto(crepe, target, option);
      }

      closeBlockActionMenu();
    },
    [closeBlockActionMenu],
  );

  /**
   * Deletes the selected block menu target from the editor document.
   */
  const handleDeleteBlock = useCallback((): void => {
    const crepe = crepeRef.current;
    const target = blockActionMenuStateRef.current?.target;

    if (crepe && target) {
      deleteMarkdownEditorBlock(crepe, target);
    }

    closeBlockActionMenu();
  }, [closeBlockActionMenu]);

  /** Submits one live chat snapshot while preserving composition and readonly boundaries. */
  const requestKeyboardSubmission = useCallback(
    (event: KeyboardEvent): boolean => {
      const crepe = crepeRef.current;
      const options = chatOptionsRef.current;
      const hasSubmitModifier =
        event.ctrlKey ||
        event.metaKey ||
        (options?.isShiftEnterSubmit === true && event.shiftKey && !event.altKey);
      if (
        !crepe ||
        crepe.editor.status !== EditorStatus.Created ||
        !options?.onSubmitRequest ||
        disabledRef.current ||
        event.key !== 'Enter' ||
        !hasSubmitModifier ||
        event.isComposing
      ) {
        return false;
      }
      if (!crepe.editor.action((ctx) => ctx.get(editorViewCtx).editable)) return false;

      event.preventDefault();
      const markdown = getMarkdownEditorMarkdown(crepe);
      // flush the debounced edit before a consumer can clear or replace the submitted draft.
      if (markdown !== currentMarkdownRef.current) {
        currentMarkdownRef.current = markdown;
        if (markdown !== latestValueRef.current) emitChange(markdown);
      }
      options.onSubmitRequest(markdown);
      return true;
    },
    [emitChange],
  );

  // CodeMirror consumes its own keymap before ProseMirror sees the event
  const handleCodeKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (
        event.target instanceof Element &&
        event.target.closest('.cm-editor') &&
        requestKeyboardSubmission(event.nativeEvent)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [requestKeyboardSubmission],
  );

  /**
   * Creates or reuses the Crepe editor mounted into the Milkdown root element.
   * @param root The DOM element provided by Milkdown for editor mounting.
   * @returns The Crepe editor instance managed by Milkdown.
   */
  const createEditor: GetEditor = (root) => {
    const existingEditor = crepeRef.current;

    if (existingEditor) {
      return existingEditor;
    }

    ensureMarkdownEditorVueFragmentGlobal();

    const crepe = new Crepe({
      defaultValue: latestValueRef.current,
      ...getMarkdownEditorCrepeConfig({
        isChat: editorMode === 'chat',
        isDarkMode,
        onYouTubeVideoInsertRequest: openYouTubeVideoAddDialog,
        placeholder,
        supportedTools,
      }),
      root,
    });

    crepeRef.current = crepe;
    crepe.setReadonly(true);
    if (chatOptionsRef.current) {
      crepe.editor.use(
        createChatMarkdownPolicyPlugin({
          getMaxLength: () => chatOptionsRef.current?.getMaxLength() ?? Number.MAX_SAFE_INTEGER,
          getSupportedTools: () =>
            chatOptionsRef.current?.getSupportedTools?.() ?? CHAT_MARKDOWN_EDITOR_TOOLS,
          onNormalization: () => chatOptionsRef.current?.onNormalization(),
          onPasteRejected: () => chatOptionsRef.current?.onPasteRejected(),
        }),
      );
    }
    crepe.editor.use(highlightMarkdownEditorVariablesPlugin);
    crepe.editor.use(patchMarkdownEditorInlineMathSchemaPlugin);
    if (editorMode !== 'chat') crepe.editor.use(markdownEditorYouTubeVideoPlugin);
    crepe.editor.config((ctx) => {
      disableMarkdownEditorFileUploads(ctx);
      configureMarkdownEditorSerialization(ctx);
      if (editorMode !== 'chat')
        configureMarkdownEditorYouTubeVideoAuthoring(ctx, youTubeVideoAuthoringController);
      ctx.update(editorViewOptionsCtx, (previousOptions) => ({
        ...previousOptions,
        attributes: {
          ...(typeof previousOptions.attributes === 'object'
            ? previousOptions.attributes
            : undefined),
          'aria-label': ariaLabel ?? 'Markdown editor',
          role: 'textbox',
        },
        handleKeyDown: (view, event) => {
          /*
           * a chat message isn't a document to indent, so Tab and Shift+Tab leave it, as they
           * leave a text field, except in a list item, which they nest and lift
           */
          if (
            chatOptionsRef.current &&
            event.key === 'Tab' &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !isMarkdownEditorSelectionInListItem(view.state) &&
            moveFocusFromMarkdownEditor(root, event.shiftKey ? -1 : 1)
          )
            return true;

          if (requestKeyboardSubmission(event)) return true;

          return previousOptions.handleKeyDown?.(view, event) ?? false;
        },
      }));
    });

    crepe.on((listenerApi) => {
      listenerApi.mounted(() => {
        const markdown = getMarkdownEditorMarkdown(crepe);

        currentMarkdownRef.current = markdown;
        crepe.setReadonly(true);
        syncEditorAttributes(crepe, ariaLabel, ariaDescribedBy, ariaInvalid, ariaRequired);
        syncEditorPlaceholder(crepe, placeholder);
        syncEditorValue(crepe, latestValueRef.current, currentMarkdownRef);
        applyAccessibility();
      });

      listenerApi.updated((ctx, doc) => {
        // Milkdown's debounced listener can run after its editor view is destroyed.
        if (crepe.editor.status !== EditorStatus.Created) {
          return;
        }

        // controlled replacements bypass Milkdown's pending edit, whose delayed report is stale
        if (!doc.eq(ctx.get(editorViewCtx).state.doc)) return;

        const markdown = ctx.get(serializerCtx)(doc);
        // a document the editor already recorded, such as a controlled value it took, isn't an edit
        const isEdited = markdown !== currentMarkdownRef.current;

        currentMarkdownRef.current = markdown;
        scheduleAccessibility();

        if (isEdited && markdown !== latestValueRef.current) {
          emitChange(markdown);
        }
      });

      // a reader can leave right after typing, such as to submit, while the update is still debounced
      listenerApi.blur((ctx) => {
        if (crepe.editor.status !== EditorStatus.Created) {
          return;
        }

        const markdown = ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc);
        const isEdited = markdown !== currentMarkdownRef.current;

        currentMarkdownRef.current = markdown;

        if (isEdited && markdown !== latestValueRef.current) {
          emitChange(markdown);
        }
      });
    });

    return crepe;
  };

  const { loading: isEditorLoading } = useEditor(createEditor, []);

  useEffect(() => {
    if (previousControlledValueRef.current !== value) {
      previousControlledValueRef.current = value;
      latestValueRef.current = value;
      const crepe = crepeRef.current;
      if (crepe) syncEditorValue(crepe, value, currentMarkdownRef);
    }
  }, [value]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    blockActionMenuStateRef.current = blockActionMenuState;
  }, [blockActionMenuState]);

  useEffect(() => {
    supportedToolsRef.current = supportedTools;
  }, [supportedTools]);

  useEffect(() => {
    chatOptionsRef.current = chatOptions;
  }, [chatOptions]);

  useEffect(() => {
    youTubeVideoAuthoringController.update({
      isAuthoringEnabled: isYouTubeVideoAuthoringEnabled,
      onEditRequest: openYouTubeVideoEditDialog,
    });
  }, [isYouTubeVideoAuthoringEnabled, openYouTubeVideoEditDialog, youTubeVideoAuthoringController]);

  useEffect(() => {
    scheduleAccessibility();
  }, [scheduleAccessibility, supportedToolsKey]);

  useEffect(() => {
    if (!isBlockActionMenuOpen) {
      return;
    }

    const ownerDocument = editorWrapperRef.current?.ownerDocument ?? document;

    /**
     * Closes the block action menu when users click outside it.
     * @param event The pointer event emitted by the document.
     */
    const handleOutsidePointerDown = (event: PointerEvent): void => {
      const eventTarget = event.target;

      if (eventTarget instanceof Node && !blockActionMenuRef.current?.contains(eventTarget)) {
        closeBlockActionMenu();
      }
    };

    /**
     * Repositions the block action menu when editor geometry changes under it.
     * @param event The scroll event emitted by the document tree.
     */
    const handleDocumentScroll = (event: Event): void => {
      const eventTarget = event.target;

      if (!(eventTarget instanceof Node && blockActionMenuRef.current?.contains(eventTarget))) {
        syncBlockActionMenuPosition();
      }
    };

    /**
     * Repositions the block action menu when viewport size changes.
     */
    const handleViewportResize = (): void => {
      syncBlockActionMenuPosition();
    };

    /**
     * Closes the block action menu when keyboard work returns to the editor.
     * @param event The keyboard event emitted by the document.
     */
    const handleDocumentKeyDown = (event: KeyboardEvent): void => {
      const eventTarget = event.target;

      if (eventTarget instanceof Node && blockActionMenuRef.current?.contains(eventTarget)) {
        return;
      }

      closeBlockActionMenu();
    };

    const ownerWindow = ownerDocument.defaultView ?? window;

    ownerDocument.addEventListener('pointerdown', handleOutsidePointerDown, true);
    ownerDocument.addEventListener('scroll', handleDocumentScroll, true);
    ownerDocument.addEventListener('keydown', handleDocumentKeyDown, true);
    ownerWindow.addEventListener('resize', handleViewportResize);

    return () => {
      ownerDocument.removeEventListener('pointerdown', handleOutsidePointerDown, true);
      ownerDocument.removeEventListener('scroll', handleDocumentScroll, true);
      ownerDocument.removeEventListener('keydown', handleDocumentKeyDown, true);
      ownerWindow.removeEventListener('resize', handleViewportResize);
    };
  }, [closeBlockActionMenu, isBlockActionMenuOpen, syncBlockActionMenuPosition]);

  useEffect(() => {
    const crepe = crepeRef.current;
    if (!crepe || isEditorLoading) return;
    syncEditorValue(crepe, latestValueRef.current, currentMarkdownRef);
    if (hasPendingLiteralAppendRef.current) {
      hasPendingLiteralAppendRef.current = false;
      const acceptedMarkdown = getMarkdownEditorMarkdown(crepe);
      latestValueRef.current = acceptedMarkdown;
      currentMarkdownRef.current = acceptedMarkdown;
      onChangeRef.current(acceptedMarkdown);
    }
  }, [isEditorLoading]);

  useEffect(() => {
    const crepe = crepeRef.current;

    if (!crepe || isEditorLoading) {
      return;
    }

    crepe.setReadonly(disabled);
    syncEditorAttributes(crepe, ariaLabel, ariaDescribedBy, ariaInvalid, ariaRequired);
    applyAccessibility();
  }, [
    applyAccessibility,
    ariaDescribedBy,
    ariaInvalid,
    ariaLabel,
    ariaRequired,
    disabled,
    isEditorLoading,
  ]);

  useEffect(() => {
    if (disabled) {
      closeBlockActionMenu();
    }

    if (!isYouTubeVideoAuthoringEnabled) {
      setIsYouTubeVideoDialogOpen(false);
    }
  }, [closeBlockActionMenu, disabled, isYouTubeVideoAuthoringEnabled]);

  /**
   * Closes the controlled YouTube dialog when the dialog primitive dismisses it.
   * @param nextOpen Whether the dialog should remain open.
   */
  const handleYouTubeVideoDialogOpenChange = useCallback((nextOpen: boolean): void => {
    if (!nextOpen) {
      setIsYouTubeVideoDialogOpen(false);
    }
  }, []);

  /**
   * Clears the retained dialog request after focus restoration and close completion.
   */
  const handleYouTubeVideoDialogClosed = useCallback((): void => {
    setYouTubeVideoDialogState(null);
  }, []);

  /**
   * Applies a validated dialog result through the guarded add or edit path.
   * @param descriptor The canonical descriptor submitted by the dialog.
   */
  const handleYouTubeVideoDialogSubmit = useCallback(
    (descriptor: IYouTubeVideoDescriptor): void => {
      const crepe = crepeRef.current;
      const dialogState = youTubeVideoDialogState;
      const canMutate =
        !disabledRef.current && supportedToolsRef.current.includes(MARKDOWN_EDITOR_TOOLS.YouTube);

      if (crepe && dialogState && canMutate) {
        if (dialogState.mode === 'add') {
          insertMarkdownEditorYouTubeVideo(crepe, dialogState.insertionRequest, descriptor);
        } else {
          updateMarkdownEditorYouTubeVideo(crepe, dialogState.editRequest, descriptor);
        }
      }

      setIsYouTubeVideoDialogOpen(false);
    },
    [youTubeVideoDialogState],
  );

  useEffect(() => {
    const crepe = crepeRef.current;

    if (crepe) syncEditorPlaceholder(crepe, placeholder);
  }, [placeholder]);

  const getChatMarkdown = useCallback((): string => {
    const crepe = crepeRef.current;

    return crepe?.editor.status === EditorStatus.Created
      ? getMarkdownEditorMarkdown(crepe)
      : latestValueRef.current;
  }, []);

  const focusChatEditor = useCallback((): void => {
    const crepe = crepeRef.current;
    if (crepe?.editor.status === EditorStatus.Created)
      crepe.editor.action((ctx) => ctx.get(editorViewCtx).focus());
  }, []);

  const applyChatBlockFormat = useCallback((format: IChatMarkdownBlockFormat): void => {
    const crepe = crepeRef.current;
    if (crepe?.editor.status !== EditorStatus.Created) return;
    crepe.editor.action((ctx) => {
      const commands = ctx.get(commandsCtx);

      if (format === 'paragraph') {
        commands.call(turnIntoTextCommand.key);
      } else if (format === 'bullet-list') {
        commands.call(wrapInBulletListCommand.key);
      } else if (format === 'ordered-list') {
        commands.call(wrapInOrderedListCommand.key);
      } else {
        commands.call(wrapInHeadingCommand.key, Number(format.slice(-1)));
      }

      ctx.get(editorViewCtx).focus();
    });
  }, []);

  /** Retains opted-in overflow before readiness and reports the accepted editor snapshot. */
  const appendChatLiteralText = useCallback<
    IChatMarkdownEditorInternalControls['appendLiteralText']
  >((text, insertionOptions): boolean => {
    const crepe = crepeRef.current;
    const options = chatOptionsRef.current;
    if (!options || disabledRef.current) return false;
    const isEditorReady = crepe?.editor.status === EditorStatus.Created;
    if (!isEditorReady && !insertionOptions?.allowOverLimit) return false;
    const currentMarkdown = isEditorReady
      ? getMarkdownEditorMarkdown(crepe)
      : latestValueRef.current;
    const nextMarkdown = buildChatMarkdownLiteralAppend(
      currentMarkdown,
      text,
      options.getMaxLength(),
      insertionOptions?.allowOverLimit,
    );
    if (nextMarkdown === null) return false;
    if (nextMarkdown === currentMarkdown) return true;
    let acceptedMarkdown = nextMarkdown;
    if (isEditorReady) {
      if (!insertionOptions?.allowOverLimit) {
        const serialized = crepe.editor.action((ctx) =>
          ctx.get(serializerCtx)(ctx.get(parserCtx)(nextMarkdown)),
        );
        if (measureChatMarkdown(serialized) > options.getMaxLength()) return false;
      }
      replaceMarkdownEditorMarkdown(crepe, nextMarkdown);
      acceptedMarkdown = getMarkdownEditorMarkdown(crepe);
    } else {
      hasPendingLiteralAppendRef.current = true;
    }
    latestValueRef.current = acceptedMarkdown;
    currentMarkdownRef.current = acceptedMarkdown;
    onChangeRef.current(insertionOptions?.allowOverLimit ? acceptedMarkdown : nextMarkdown);
    return true;
  }, []);

  useImperativeHandle<IChatMarkdownEditorInternalControls, IChatMarkdownEditorInternalControls>(
    chatOptions?.controlsRef,
    () => ({
      appendLiteralText: appendChatLiteralText,
      applyBlockFormat: applyChatBlockFormat,
      focus: focusChatEditor,
      getMarkdown: getChatMarkdown,
    }),
    [appendChatLiteralText, applyChatBlockFormat, focusChatEditor, getChatMarkdown],
  );

  useEffect(() => {
    return () => {
      const accessibilitySyncId = accessibilitySyncIdRef.current;

      if (accessibilitySyncId !== null) {
        const ownerWindow = editorWrapperRef.current?.ownerDocument.defaultView ?? window;

        ownerWindow.clearTimeout(accessibilitySyncId);
      }

      accessibilityObserverRef.current?.disconnect();
      accessibilityObserverRef.current = null;
      youTubeVideoAuthoringController.dispose();
      crepeRef.current = null;
    };
  }, [youTubeVideoAuthoringController]);

  const blockActionMenuPortal =
    blockActionMenuState && blockActionPortalContainer
      ? createPortal(
          <MarkdownEditorBlockActionMenu
            activeKind={getMarkdownEditorActiveTurnIntoOptionKind(blockActionMenuState.target)}
            left={blockActionMenuState.left}
            maxHeight={blockActionMenuState.maxHeight}
            menuRef={blockActionMenuRef}
            onClose={closeBlockActionMenu}
            onDelete={handleDeleteBlock}
            onTurnInto={handleTurnInto}
            supportedTools={supportedTools}
            target={blockActionMenuState.target}
            top={blockActionMenuState.top}
          />,
          blockActionPortalContainer,
        )
      : null;

  return (
    <>
      <div
        ref={setEditorWrapperElement}
        aria-busy={isEditorLoading || undefined}
        data-disabled={disabled ? 'true' : undefined}
        data-editor-mode={editorMode}
        data-slot="markdown-editor"
        className={cn('w-full max-w-full min-w-0', className)}
        onKeyDownCapture={handleCodeKeyDownCapture}
      >
        <Milkdown />
      </div>
      {blockActionMenuPortal}
      {youTubeVideoDialogState ? (
        <MarkdownEditorYouTubeVideoDialog
          initialDescriptor={
            youTubeVideoDialogState.mode === 'edit' ? youTubeVideoDialogState.descriptor : undefined
          }
          mode={youTubeVideoDialogState.mode}
          open={isYouTubeVideoDialogOpen}
          resolveReturnFocusElement={youTubeVideoDialogState.resolveReturnFocusElement}
          onClosed={handleYouTubeVideoDialogClosed}
          onOpenChange={handleYouTubeVideoDialogOpenChange}
          onSubmit={handleYouTubeVideoDialogSubmit}
        />
      ) : null}
    </>
  );
};

/**
 * Renders the lazily loaded markdown editor with its Milkdown provider.
 * @param props The controlled editor props plus the active document theme.
 * @returns A React element that renders the editor provider and instance.
 */
export const MarkdownEditorContent = (props: IMarkdownEditorContentProps): React.ReactElement => {
  const supportedToolsKey = getMarkdownEditorSupportedToolsKey(props.supportedTools);
  const themeKey = props.editorMode === 'chat' ? 'chat' : props.isDarkMode ? 'dark' : 'light';

  return (
    <MilkdownProvider key={`${themeKey}:${supportedToolsKey}`}>
      <MarkdownEditorInstance {...props} />
    </MilkdownProvider>
  );
};
