import { useState } from 'react';

import { Button, useConfirmationDialogStore } from 'jg-personal-react-ui';

/** Keeps confirmation feedback local so sibling examples do not re-render for a decision. */
export const ConfirmationExample = () => {
  const [result, setResult] = useState('No decision yet');
  return (
    <>
      <Button
        size="touch"
        variant="destructive"
        onClick={() =>
          useConfirmationDialogStore.getState().openConfirmationDialog({
            destructive: true,
            onConfirmationDialogClose: (isConfirmed) =>
              setResult(isConfirmed ? 'Deletion confirmed' : 'Deletion cancelled'),
          })
        }
      >
        Request destructive confirmation
      </Button>
      <p
        role="status"
        aria-label="Confirmation result"
      >
        {result}
      </p>
    </>
  );
};
