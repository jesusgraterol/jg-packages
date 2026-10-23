import type { ICopyButtonDisplay } from '../code-window/index.ts';

// presentation of copy controls generated for Markdown code fences
export interface ICodeWindowPluginOptions {
  copyDisplay?: ICopyButtonDisplay | undefined;
}
