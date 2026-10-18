import { verifyBuild } from '../src/utilities/verify-build/index.ts';

/*
 * Verifies the build `astro build` just wrote, as the last step of `build`. A failure exits
 * non-zero with its message; docs/website.md says how to fix each one.
 */

await verifyBuild();
