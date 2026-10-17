// kinds of exported symbols the reference describes
export type IApiSymbolKind =
  'class' | 'constant' | 'enum' | 'function' | 'interface' | 'type' | 'variable';

// one parameter of a function, method, or constructor signature
export type IApiParameter = {
  name: string;
  type: string;
  isOptional: boolean;
  isRest: boolean;
  defaultValue: string | undefined;
  description: string;
};

// one callable signature with its TSDoc
export type IApiSignature = {
  // the signature as code, such as `movePoint(point: IPoint, offset?: number): IPoint`
  text: string;
  summary: string;
  typeParameters: string[];
  parameters: IApiParameter[];
  returnType: string;
  returns: string;
  // one entry per `@throws` list item, such as `INVALID_POINT: The point is not valid.`
  throws: string[];
  // each `@example` as Markdown, usually a fenced code block
  examples: string[];
  deprecated: string | undefined;
};

// a property or method of a class, or a property of an object type
export type IApiMember = {
  name: string;
  kind: 'constructor' | 'method' | 'property';
  summary: string;
  // the property's type, or each signature of a method or constructor
  type: string | undefined;
  signatures: IApiSignature[];
};

// one exported symbol of an entry point
export type IApiSymbol = {
  name: string;
  kind: IApiSymbolKind;
  summary: string;
  examples: string[];
  deprecated: string | undefined;
  signatures: IApiSignature[];
  // the declaration as code for types and interfaces, or the value's type for constants and variables
  type: string | undefined;
  members: IApiMember[];
};

// the symbols one `exports` subpath exposes
export type IApiEntryPoint = {
  subpath: string;
  symbols: IApiSymbol[];
};

// a package's documented public API, entry point by entry point
export type IApiReference = {
  packageName: string;
  version: string;
  entryPoints: IApiEntryPoint[];
};

// documentation an exported symbol is missing
export type IUndocumentedSymbol = {
  subpath: string;
  name: string;
  kind: IApiSymbolKind;
  missing: ('example' | 'summary')[];
};
