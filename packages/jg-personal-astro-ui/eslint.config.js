import { createEslintConfig } from '@jg-packages/eslint-config';

export default createEslintConfig({ rootDirectory: import.meta.dirname, isAstro: true });
