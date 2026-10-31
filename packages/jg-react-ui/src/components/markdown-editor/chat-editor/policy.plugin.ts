import { parserCtx, prosePluginsCtx, serializerCtx } from '@milkdown/kit/core';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import { Slice } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

import type { IChatMarkdownPolicyOptions } from './types.js';
import {
  canParseChatMarkdown,
  doesChatMarkdownDocumentNeedNormalization,
  normalizeChatMarkdownDocument,
} from './policy.js';

// stable key identifies the policy plugin within one editor state.
export const CHAT_MARKDOWN_POLICY_PLUGIN_KEY = new PluginKey('app-ui-chat-markdown-policy');
const CHAT_MARKDOWN_POLICY_TRANSACTION_META = 'app-ui-chat-markdown-policy-normalized';

/** Rejects raw clipboard input before parsing while preserving the current draft. */
const rejectOversizedChatPaste = (
  event: ClipboardEvent,
  options: IChatMarkdownPolicyOptions,
): boolean => {
  const source =
    event.clipboardData?.getData('text/html') || event.clipboardData?.getData('text/plain') || '';
  if (canParseChatMarkdown(source, options.getMaxLength())) return false;
  event.preventDefault();
  options.onPasteRejected();
  return true;
};

/**
 * Creates the ProseMirror policy that normalizes every chat editor document boundary.
 * @param options Live length and feedback callbacks owned by the mounted editor.
 * @returns A Milkdown plugin scoped to one chat editor instance.
 */
export const createChatMarkdownPolicyPlugin = (
  options: IChatMarkdownPolicyOptions,
): MilkdownPlugin => {
  const policyPlugin = $prose(
    (ctx) =>
      new Plugin({
        key: CHAT_MARKDOWN_POLICY_PLUGIN_KEY,
        filterTransaction: (transaction) => {
          if (transaction.getMeta('uiEvent') !== 'paste') {
            return true;
          }

          if (ctx.get(serializerCtx)(transaction.doc).length <= options.getMaxLength()) {
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
            !doesChatMarkdownDocumentNeedNormalization(nextState.doc)
          ) {
            return null;
          }

          const normalizedDocument = normalizeChatMarkdownDocument(nextState.doc);
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
            paste: (_view, event) => rejectOversizedChatPaste(event, options),
          },
          handlePaste: (view, event, pastedSlice) => {
            const html = event.clipboardData?.getData('text/html') ?? '';
            const markdown = event.clipboardData?.getData('text/plain') ?? '';

            if (!html && !markdown) return false;
            if (rejectOversizedChatPaste(event, options)) return true;
            event.preventDefault();

            const parsedDocument = html
              ? view.state.schema.topNodeType.create(null, pastedSlice.content)
              : ctx.get(parserCtx)(markdown);
            const needsNormalization = doesChatMarkdownDocumentNeedNormalization(parsedDocument);
            const normalizedDocument = normalizeChatMarkdownDocument(parsedDocument);
            const transaction = view.state.tr.replaceSelection(
              new Slice(normalizedDocument.content, 0, 0),
            );

            if (ctx.get(serializerCtx)(transaction.doc).length > options.getMaxLength()) {
              options.onPasteRejected();
              return true;
            }

            view.dispatch(transaction.setMeta('uiEvent', 'paste').scrollIntoView());

            if (needsNormalization) {
              options.onNormalization();
            }

            return true;
          },
        },
        view: (view) => {
          queueMicrotask(() => {
            if (!view.isDestroyed && doesChatMarkdownDocumentNeedNormalization(view.state.doc)) {
              const normalizedDocument = normalizeChatMarkdownDocument(view.state.doc);

              view.dispatch(
                view.state.tr
                  .replaceWith(0, view.state.doc.content.size, normalizedDocument.content)
                  .setMeta(CHAT_MARKDOWN_POLICY_TRANSACTION_META, true),
              );
            }
          });

          return {};
        },
      }),
  );

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
