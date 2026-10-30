import type {
  ExternalToast as SonnerExternalToast,
  ToastClassnames as SonnerToastClassnames,
  ToasterProps as SonnerToasterProps,
} from 'sonner';

/** Exported toastr aliases keep Sonner implementation types behind the shared package API.
 * @see Toastr
 */
export type IExternalToastr = SonnerExternalToast;
/** Per-slot notification classes merged with the shared defaults.
 * @see Toastr
 */
export type IToastrClassNames = SonnerToastClassnames;
/** Notification host props retaining Sonner configuration and overrides.
 * @see Toastr
 */
export type IToastrProps = SonnerToasterProps;
