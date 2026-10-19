import type { IEventBus, IEventBusOptions } from './types.js';

/**
 * Creates an in-process event bus that decouples the code that emits an event from the handlers
 * that react to it, such as sending a welcome email after a sign-up. `emit` returns at once, and
 * each event is delivered later, in the order it was emitted. Each handler runs on its own, so one
 * that throws or rejects doesn't stop the others: its error goes to `onError`. A handler
 * unsubscribed before it's called isn't called, and subscribing the same handler twice to one
 * event registers it once. Declare the event map with `type`, because an interface has no index
 * signature.
 * @param options The `onError` that receives each handler's error.
 * @returns The bus.
 * @example
 * import { createEventBus } from 'jg-utilities';
 *
 * type IAppEvents = { userSignedUp: { userId: string } };
 *
 * const events = createEventBus<IAppEvents>({
 *   onError: (error, { name }) => console.error(`A ${String(name)} handler failed`, error),
 * });
 * const welcomedUserIds: string[] = [];
 * const unsubscribe = events.subscribe('userSignedUp', ({ userId }) => {
 *   welcomedUserIds.push(userId);
 * });
 *
 * // emit returns at once, and the handler runs later
 * events.emit('userSignedUp', { userId: '42' });
 * welcomedUserIds; // => []
 *
 * // once the handler is no longer needed
 * setTimeout(unsubscribe, 1_000);
 */
export const createEventBus = <TEvents extends Record<string, unknown>>({
  onError,
}: IEventBusOptions<TEvents>): IEventBus<TEvents> => {
  const handlers = new Map<keyof TEvents, Set<(event: unknown) => unknown>>();
  const pendingDispatches = new Set<ReturnType<typeof setTimeout>>();
  let isClosed = false;

  /**
   * Calls one handler on its own, after the dispatch has started every other one, and sends what
   * it throws or rejects with to onError.
   * @param name The event's name.
   * @param event The event.
   * @param handler The handler.
   * @returns A promise that resolves once the handler settles, and never rejects.
   */
  const deliver = async (
    name: keyof TEvents,
    event: TEvents[keyof TEvents],
    handler: (event: unknown) => unknown,
  ): Promise<void> => {
    await Promise.resolve();
    // a handler unsubscribed, or a bus closed, since the dispatch started isn't called
    if (handlers.get(name)?.has(handler) !== true) {
      return;
    }
    try {
      await handler(event);
    } catch (error) {
      try {
        onError(error, { name, event });
      } catch {
        // an onError that throws has nowhere else to report to
      }
    }
  };

  return {
    emit: (name, event) => {
      if (isClosed) {
        return;
      }
      const dispatch = setTimeout(() => {
        pendingDispatches.delete(dispatch);
        for (const handler of [...(handlers.get(name) ?? [])]) {
          void deliver(name, event, handler);
        }
      }, 0);
      pendingDispatches.add(dispatch);
    },
    subscribe: (name, handler) => {
      if (isClosed) {
        return () => {};
      }
      // stored without its event type, which emit guarantees for every handler of the name
      const storedHandler = handler as (event: unknown) => unknown;
      const nameHandlers = handlers.get(name) ?? new Set();
      nameHandlers.add(storedHandler);
      handlers.set(name, nameHandlers);
      return () => {
        nameHandlers.delete(storedHandler);
      };
    },
    close: () => {
      isClosed = true;
      for (const dispatch of pendingDispatches) {
        clearTimeout(dispatch);
      }
      pendingDispatches.clear();
      handlers.clear();
    },
  };
};
