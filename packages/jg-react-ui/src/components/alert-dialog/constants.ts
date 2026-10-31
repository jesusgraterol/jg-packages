// alert dialogs use one intentionally compact decision surface on every viewport.
/** Shared alert-dialog styling contract.
 * @see ALERT_DIALOG_CONTENT_CLASS_NAME
 */
export const ALERT_DIALOG_CONTENT_CLASS_NAME =
  'fixed top-1/2 left-1/2 z-[60] grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-80 -translate-x-1/2 -translate-y-1/2 gap-5 overflow-hidden rounded-xl border border-border bg-background p-5 text-foreground shadow-raised outline-none will-change-[opacity,transform] data-open:animate-in data-closed:animate-out data-open:duration-300 data-closed:duration-200 data-open:ease-out data-closed:ease-in data-closed:fade-out-0 data-open:fade-in-0 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-2 data-closed:zoom-out-95 data-open:zoom-in-95 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none';
