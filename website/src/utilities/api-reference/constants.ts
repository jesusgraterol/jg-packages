import type { IApiSymbolKind } from '@jg-packages/api-reference';

// the order the reference lists each kind of symbol in, with its heading
export const KIND_GROUPS: readonly { kind: IApiSymbolKind; heading: string }[] = [
  { kind: 'function', heading: 'Functions' },
  { kind: 'class', heading: 'Classes' },
  { kind: 'constant', heading: 'Constants' },
  { kind: 'variable', heading: 'Variables' },
  { kind: 'enum', heading: 'Enums' },
  { kind: 'interface', heading: 'Interfaces' },
  { kind: 'type', heading: 'Types' },
];

// a signature longer than this puts each parameter on its own line
export const MAX_SIGNATURE_LINE_LENGTH = 80;
