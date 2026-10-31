/** Returns a fixture that the scenario must have created before it can continue. */
export const requireFixture = <TResult>(fixture: TResult | undefined): TResult => {
  if (fixture === undefined) throw new Error('The expected test fixture was not created.');
  return fixture;
};
