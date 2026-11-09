import { parserCtx, prosePluginsCtx, serializerCtx } from '@milkdown/kit/core';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import type { Slice } from '@milkdown/kit/prose/model';
import { closeHistory } from '@milkdown/kit/prose/history';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

import type { IChatMarkdownPolicyOptions, IPreparedChatMarkdownPaste } from './types.js';
import {
  createChatMarkdownPasteDocument,
  createChatMarkdownPasteSlice,
  createLiteralChatMarkdownPaste,
  isChatPasteTextRetained,
  prepareChatMarkdownPaste,
  readChatPasteHtmlText,
} from './paste.js';
import {
  canParseChatMarkdown,
  doesChatMarkdownDocumentNeedNormalization,
  measureChatMarkdown,
  normalizeChatMarkdownDocument,
} from './policy.js';

// stable key identifies the policy plugin within one editor state.
export const CHAT_MARKDOWN_POLICY_PLUGIN_KEY = new PluginKey('app-ui-chat-markdown-policy');
const CHAT_MARKDOWN_POLICY_TRANSACTION_META = 'app-ui-chat-markdown-policy-normalized';

/**
 * Creates the ProseMirror policy that normalizes every chat editor document boundary.
 * @param options Live length and feedback callbacks owned by the mounted editor.
 * @returns A Milkdown plugin scoped to one chat editor instance.
 */
export const createChatMarkdownPolicyPlugin = (
  options: IChatMarkdownPolicyOptions,
): MilkdownPlugin => {
  const policyPlugin = $prose((ctx) => {
    /** Applies one admitted source, recovering lost fragments before replacing the selection. */
    const applyPaste = (
      view: EditorView,
      event: ClipboardEvent,
      plain: string,
      html: string,
      pastedSlice?: Slice,
    ): boolean => {
      if (!view.editable || view.composing || (!plain && !html)) return false;
      const maximum = options.getMaxLength();
      const hasBoundedPlain = Boolean(plain) && canParseChatMarkdown(plain, maximum);
      if (!canParseChatMarkdown(html || plain, maximum)) {
        if (html && hasBoundedPlain) html = '';
        else {
          event.preventDefault();
          options.onPasteRejected();
          return true;
        }
      }
      event.preventDefault();
      const schema = view.state.schema;
      const tools = options.getSupportedTools?.();
      const parsePlain = () => {
        const marks = view.state.storedMarks ?? view.state.selection.$from.marks();
        if (view.state.selection.$from.parent.type.spec.code)
          return schema.topNodeType.create(
            null,
            schema.nodes['paragraph']!.create(null, schema.text(plain.replace(/\r\n?/g, '\n'))),
          );
        if (marks.some((mark) => mark.type.spec.code))
          return createLiteralChatMarkdownPaste(schema, plain, marks);
        try {
          return ctx.get(parserCtx)(plain);
        } catch (error) {
          if (!(error instanceof RangeError)) throw error;
          return createLiteralChatMarkdownPaste(schema, plain);
        }
      };
      let prepared: IPreparedChatMarkdownPaste;
      let plainSource: string | undefined;
      if (html && pastedSlice) {
        const expected = readChatPasteHtmlText(view.dom.ownerDocument, html);
        prepared = prepareChatMarkdownPaste(
          createChatMarkdownPasteDocument(schema, pastedSlice.content),
          tools,
        );
        if (
          prepared.hasLostContent ||
          !prepared.document.textContent.trim() ||
          !isChatPasteTextRetained(expected, prepared.document.textContent)
        ) {
          prepared = hasBoundedPlain
            ? prepareChatMarkdownPaste(parsePlain(), tools)
            : prepareChatMarkdownPaste(createLiteralChatMarkdownPaste(schema, expected), tools);
          plainSource = hasBoundedPlain ? plain : undefined;
          prepared.wasSimplified = true;
        }
      } else {
        prepared = prepareChatMarkdownPaste(parsePlain(), tools);
        plainSource = plain;
      }
      if (prepared.hasLostContent) {
        prepared = prepareChatMarkdownPaste(createLiteralChatMarkdownPaste(schema, plain), tools);
        prepared.wasSimplified = true;
      }
      if (!prepared.document.textContent.trim()) return true;
      const slice = createChatMarkdownPasteSlice(prepared.document, plainSource);
      const transaction = closeHistory(view.state.tr.replaceSelection(slice));
      if (measureChatMarkdown(ctx.get(serializerCtx)(transaction.doc)) > maximum) {
        options.onPasteRejected();
        return true;
      }
      view.dispatch(
        transaction.setMeta('uiEvent', 'paste').setMeta('paste', true).scrollIntoView(),
      );
      if (prepared.wasSimplified) options.onNormalization();
      return true;
    };

    return new Plugin({
      key: CHAT_MARKDOWN_POLICY_PLUGIN_KEY,
      filterTransaction: (transaction) => {
        if (transaction.getMeta('uiEvent') !== 'paste') {
          return true;
        }

        if (
          measureChatMarkdown(ctx.get(serializerCtx)(transaction.doc)) <= options.getMaxLength()
        ) {
          return true;
        }

        options.onPasteRejected();
        return false;
      },
      appendTransaction: (transactions, _previousState, nextState) => {
        if (
          transactions.some(
            (transaction) => transaction.getMeta(CHAT_MARKDOWN_POLICY_TRANSACTION_META) === true,
          ) ||
          !doesChatMarkdownDocumentNeedNormalization(nextState.doc, options.getSupportedTools?.())
        ) {
          return null;
        }

        const normalizedDocument = normalizeChatMarkdownDocument(
          nextState.doc,
          options.getSupportedTools?.(),
        );
        const transaction = nextState.tr
          .replaceWith(0, nextState.doc.content.size, normalizedDocument.content)
          .setMeta(CHAT_MARKDOWN_POLICY_TRANSACTION_META, true);

        if (transactions.some((candidate) => candidate.getMeta('uiEvent') === 'paste')) {
          options.onNormalization();
        }

        return transaction;
      },
      props: {
        // reject raw clipboard input before ProseMirror parses an HTML slice.
        handleDOMEvents: {
          paste: (view, event) => {
            if (!view.editable || view.composing) return false;
            const plain = event.clipboardData?.getData('text/plain') ?? '';
            const html = event.clipboardData?.getData('text/html') ?? '';
            const marks = view.state.storedMarks ?? view.state.selection.$from.marks();
            if (
              plain &&
              (view.state.selection.$from.parent.type.spec.code ||
                marks.some((mark) => mark.type.spec.code))
            )
              return applyPaste(view, event, plain, '');
            if (!html || !canParseChatMarkdown(html, options.getMaxLength()))
              return applyPaste(view, event, plain, html);
            return false;
          },
        },
        handlePaste: (view, event, pastedSlice) => {
          const html = event.clipboardData?.getData('text/html') ?? '';
          const plain = event.clipboardData?.getData('text/plain') ?? '';
          return applyPaste(view, event, plain, html, pastedSlice);
        },
      },
      view: (view) => {
        queueMicrotask(() => {
          if (
            !view.isDestroyed &&
            doesChatMarkdownDocumentNeedNormalization(view.state.doc, options.getSupportedTools?.())
          ) {
            const normalizedDocument = normalizeChatMarkdownDocument(
              view.state.doc,
              options.getSupportedTools?.(),
            );

            view.dispatch(
              view.state.tr
                .replaceWith(0, view.state.doc.content.size, normalizedDocument.content)
                .setMeta(CHAT_MARKDOWN_POLICY_TRANSACTION_META, true),
            );
          }
        });

        return {};
      },
    });
  });

  return (ctx) => {
    const lifecycle = policyPlugin(ctx);
    return async () => {
      const dispose = await lifecycle();
      const policy = policyPlugin.plugin();
      // Milkdown's clipboard handler otherwise consumes paste without uiEvent metadata.
      ctx.update(prosePluginsCtx, (plugins) => [
        policy,
        ...plugins.filter((plugin) => plugin !== policy),
      ]);
      return async () => {
        if (typeof dispose === 'function') await dispose();
      };
    };
  };
};
