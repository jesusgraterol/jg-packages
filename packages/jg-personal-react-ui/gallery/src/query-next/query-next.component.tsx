import { useNavigate } from 'react-router';

import { Button, PageShell, PageTitle } from 'jg-personal-react-ui';

/** Provides an in-app history return from the deferred navigation example. */
export const QueryNext = () => {
  const navigate = useNavigate();
  return (
    <PageShell>
      <PageTitle>Next query screen</PageTitle>
      <Button
        size="touch"
        onClick={() => void navigate(-1)}
      >
        Back to query recovery
      </Button>
    </PageShell>
  );
};
