import { Button, useUiPreferences } from 'jg-personal-react-ui';

/** Exposes optimistic remote state and deterministic save completion controls. */
export const RemoteControls = ({
  confirm,
  reject,
}: {
  confirm: () => void;
  reject: () => void;
}) => {
  const { preferences, isPreferencesUpdatePending, updatePreferences } = useUiPreferences();
  return (
    <div>
      <p
        role="status"
        aria-label="Remote wrapping"
      >
        Remote wrapping: {preferences.prefersWrappedCode ? 'enabled' : 'disabled'}
      </p>
      <p
        role="status"
        aria-label="Remote save"
      >
        {isPreferencesUpdatePending ? 'Save pending' : 'Ready'}
      </p>
      <div className="actions">
        <Button
          size="touch"
          onClick={() =>
            updatePreferences(
              { prefersWrappedCode: !preferences.prefersWrappedCode },
              { successNotification: { title: 'Remote preferences saved' } },
            )
          }
        >
          Change remote wrapping
        </Button>
        <Button
          size="touch"
          variant="secondary"
          disabled={!isPreferencesUpdatePending}
          onClick={confirm}
        >
          Confirm remote save
        </Button>
        <Button
          size="touch"
          variant="secondary"
          disabled={!isPreferencesUpdatePending}
          onClick={reject}
        >
          Reject remote save
        </Button>
      </div>
    </div>
  );
};
