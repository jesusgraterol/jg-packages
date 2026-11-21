/**
 * Enhances the exported guide using only its rendered controls and literal field values.
 * This function is serialized into the offline page; keep it self-contained.
 * Clipboard rejection stays local, preserves selectable copy, and exposes no raw error.
 * @returns {void}
 */
export const initializeDeliveryControls = (): void => {
  const channels = [...document.querySelectorAll('details.channel')].filter(
    (node) => node instanceof HTMLDetailsElement,
  );
  const networkNav = document.querySelector('[data-network-nav]');
  const stepNav = document.querySelector('[data-step-nav]');
  document.documentElement.dataset['guideControls'] = '';

  /** @returns {void} Fits the navigation offset and visible copy to the current layout. */
  const fitGuideLayout = () => {
    const toolbar = networkNav?.closest('.toolbar');
    if (toolbar instanceof HTMLElement)
      document.documentElement.style.setProperty(
        '--guide-nav-height',
        `${toolbar.getBoundingClientRect().height}px`,
      );
    for (const field of document.querySelectorAll('textarea[readonly]')) {
      if (!(field instanceof HTMLTextAreaElement) || field.getClientRects().length === 0) continue;
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
    }
  };

  /**
   * Keeps the persistent shortcuts aligned with the currently open network.
   * @param {string | undefined} channel The open network identifier.
   * @returns {void}
   */
  const updateNavigation = (channel: string | undefined) => {
    if (!(networkNav instanceof HTMLElement) || !(stepNav instanceof HTMLElement)) return;
    for (const link of networkNav.querySelectorAll('a[data-channel]')) {
      if (!(link instanceof HTMLAnchorElement)) continue;
      if (link.dataset['channel'] === channel) {
        link.setAttribute('aria-current', 'location');
        const bounds = link.getBoundingClientRect(),
          container = networkNav.getBoundingClientRect();
        if (bounds.left < container.left || bounds.right > container.right)
          link.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      } else link.removeAttribute('aria-current');
    }
    stepNav.hidden = !channel;
    for (const link of stepNav.querySelectorAll('a[data-step]')) {
      if (link instanceof HTMLAnchorElement && channel)
        link.href = `#${channel}-${link.dataset['step']}`;
    }
  };

  /**
   * Opens one network without relying on exclusive-details support in the browser.
   * @param {HTMLDetailsElement} selected The requested network section.
   * @returns {void}
   */
  const openChannel = (selected: HTMLDetailsElement) => {
    for (const channel of channels) {
      channel.hidden = channel !== selected;
      channel.open = channel === selected;
    }
    updateNavigation(selected.id);
    fitGuideLayout();
  };

  /**
   * Repositions after changing section heights, including repeat selections.
   * @param {HTMLDetailsElement} selected The requested network section.
   * @returns {void}
   */
  const navigateToStart = (selected: HTMLDetailsElement) => {
    openChannel(selected);
    const heading = document.getElementById(`${selected.id}-start`);
    if (!(heading instanceof HTMLElement)) return;
    location.hash = heading.id;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'instant' });
  };

  /**
   * Opens a known section for direct links and browser Back/Forward.
   * @param {boolean} [restoreStart] Restore focus for history returning to the initial network.
   * @returns {void}
   */
  const followFragment = (restoreStart = false) => {
    const fragment = location.hash.slice(1);
    const target = document.getElementById(fragment || `${channels[0]?.id}-start`);
    const channel = target?.closest('details.channel');
    if (channel instanceof HTMLDetailsElement && target instanceof HTMLElement) {
      // Native in-panel links already move focus; do not race the user's next Tab.
      const needsFocus = channel.hidden || !channel.open || (!fragment && restoreStart);
      openChannel(channel);
      if (needsFocus) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }
  };

  for (const link of document.querySelectorAll('a[data-channel]')) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    link.addEventListener('click', (event) => {
      if (
        event instanceof MouseEvent &&
        (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      )
        return;
      const selected = channels.find((channel) => channel.id === link.dataset['channel']);
      if (!selected) return;
      event.preventDefault();
      navigateToStart(selected);
    });
  }
  for (const channel of channels) {
    channel.querySelector('summary')?.addEventListener('click', (event) => {
      if (channel.open) return;
      event.preventDefault();
      navigateToStart(channel);
    });
    channel.addEventListener('toggle', () => {
      if (channel.open) openChannel(channel);
      else updateNavigation(channels.find((node) => node.open)?.id);
    });
  }
  window.addEventListener('hashchange', () => followFragment(true));
  window.addEventListener('resize', fitGuideLayout);
  document.addEventListener('toggle', fitGuideLayout, true);
  followFragment();
  updateNavigation(channels.find((channel) => channel.open)?.id);

  for (const button of document.querySelectorAll('[data-copy-target]')) {
    if (!(button instanceof HTMLButtonElement)) continue;
    const field = document.getElementById(button.dataset['copyTarget'] ?? '');
    const status = document.getElementById(button.dataset['copyStatus'] ?? '');
    const block = button.closest('.copy-block');
    if (
      !(field instanceof HTMLTextAreaElement) ||
      !(status instanceof HTMLElement) ||
      !(block instanceof HTMLElement)
    )
      continue;

    /** @returns {void} Keeps manual copy available when clipboard access is unavailable. */
    const selectForManualCopy = () => {
      field.focus({ preventScroll: true });
      field.select();
      status.textContent =
        button.dataset['copyFallback'] ?? "Text selected. Use your device's Copy command.";
    };

    const writeCopy = async (): Promise<void> => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      button.setAttribute('aria-disabled', 'true');
      block.setAttribute('aria-busy', 'true');
      try {
        if (typeof navigator.clipboard?.writeText !== 'function') {
          selectForManualCopy();
          return;
        }
        // Start inside the activation handler, before the first await.
        const writing = navigator.clipboard.writeText(field.value);
        status.textContent = button.dataset['copyPending'] ?? 'Copying...';
        await writing;
        status.textContent = button.dataset['copySuccess'] ?? 'Copied.';
      } catch {
        selectForManualCopy();
      } finally {
        button.removeAttribute('aria-disabled');
        block.removeAttribute('aria-busy');
      }
    };
    button.addEventListener('click', () => {
      void writeCopy();
    });
    button.hidden = false;
  }
  fitGuideLayout();
};
