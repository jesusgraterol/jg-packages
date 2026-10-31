import { useState } from 'react';

import {
  Button,
  ThemeToggleButton,
  toastr,
  useTheme,
  useUiPreferences,
} from 'jg-personal-react-ui';

/** Renders persisted settings and the shared notification host's interaction states. */
export const PreferencesDemo = () => {
  const [reviewedCount, setReviewedCount] = useState(0);
  const { preferences, updatePreferences } = useUiPreferences();
  const { resolvedTheme } = useTheme();
  return (
    <section aria-labelledby="preferences-title">
      <h2 id="preferences-title">Preferences and notifications</h2>
      <p>Settings stay in this gallery’s namespace. Theme changes apply to the whole document.</p>
      <div className="actions">
        <ThemeToggleButton size="icon-touch" />
        <Button
          size="touch"
          aria-pressed={preferences.prefersWrappedCode}
          onClick={() => updatePreferences({ prefersWrappedCode: !preferences.prefersWrappedCode })}
        >
          Wrap code
        </Button>
        <Button
          size="touch"
          onClick={() =>
            toastr.success('Your changes are saved', {
              description:
                'Preferences remain available on your next visit, including longer messages that wrap within narrow viewports.',
              action: {
                label: 'Review settings',
                onClick: () => setReviewedCount((count) => count + 1),
              },
            })
          }
        >
          Show saved notification
        </Button>
        <Button
          size="touch"
          variant="secondary"
          onClick={() =>
            toastr.error('Unable to sync changes', {
              description: 'Reconnect and try again. Your work remains here.',
            })
          }
        >
          Show error notification
        </Button>
        <Button
          size="touch"
          variant="secondary"
          onClick={() => toastr.loading('Syncing changes')}
        >
          Show loading notification
        </Button>
      </div>
      <output aria-label="Current theme">{resolvedTheme}</output>
      <p
        role="status"
        aria-label="Reviewed preferences"
      >
        Settings reviewed: {reviewedCount}
      </p>
      <p>Code wrapping: {preferences.prefersWrappedCode ? 'enabled' : 'disabled'}</p>
    </section>
  );
};
