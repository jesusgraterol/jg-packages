/*
 * The page-transition opt-in and its reduced-motion opt-out, as contract.css declares them.
 * document-head repeats them inline, because Chromium settles an incoming page's opt-in when its
 * body starts: when the stylesheet arrives later, it skips the crossfade and leaves the
 * transition's rejected promise unhandled.
 */
export const PAGE_TRANSITION_STYLE = `@view-transition {
  navigation: auto;
}
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: none;
  }
}`;
