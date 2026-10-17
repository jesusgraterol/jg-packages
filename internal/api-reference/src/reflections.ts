import {
  type Comment,
  type CommentDisplayPart,
  type DeclarationReflection,
  type ParameterReflection,
  ReflectionKind,
  type SignatureReflection,
} from 'typedoc';

import type { IDeclarationFacts } from './declarations.ts';
import type {
  IApiMember,
  IApiParameter,
  IApiSignature,
  IApiSymbol,
  IApiSymbolKind,
} from './types.ts';

// facts about each converted reflection, keyed by reflection id
export type IDeclarationFactsById = Map<number, IDeclarationFacts>;

/**
 * Joins comment parts into Markdown text.
 * @param parts The comment parts.
 * @returns The trimmed text, or an empty string.
 */
const toText = (parts: readonly CommentDisplayPart[] | undefined): string =>
  (parts ?? [])
    .map((part) => part.text)
    .join('')
    .trim();

/**
 * Reads the text of every block tag with a name, such as each `@example`.
 * @param comment The comment to read.
 * @param tag The tag name, including `@`.
 * @returns The text of each matching tag.
 */
const getTagTexts = (comment: Comment | undefined, tag: `@${string}`): string[] =>
  (comment?.blockTags ?? [])
    .filter((block) => block.tag === tag)
    .map((block) => toText(block.content));

/**
 * Reads the `@deprecated` message, which may be empty.
 * @param comment The comment to read.
 * @returns The message, or `undefined` when the symbol isn't deprecated.
 */
const getDeprecation = (comment: Comment | undefined): string | undefined =>
  getTagTexts(comment, '@deprecated')[0];

/**
 * Splits a `@throws` list into its items, such as `INVALID_POINT: The point is not valid.`.
 * @param comment The comment to read.
 * @returns One entry per list item.
 */
const getThrows = (comment: Comment | undefined): string[] =>
  getTagTexts(comment, '@throws')
    .flatMap((text) => text.split('\n'))
    .map((line) => line.trim().replace(/^-\s*/, ''))
    .filter((line) => line !== '');

/**
 * Describes one parameter of a signature.
 * @param parameter The parameter reflection.
 * @returns The parameter.
 */
const toParameter = (parameter: ParameterReflection): IApiParameter => ({
  name: parameter.name,
  type: parameter.type?.toString() ?? 'unknown',
  isOptional: parameter.flags.isOptional || parameter.defaultValue !== undefined,
  isRest: parameter.flags.isRest,
  defaultValue: parameter.defaultValue,
  description: toText(parameter.comment?.summary),
});

/**
 * Describes one signature, with its code text and TSDoc.
 * @param signature The signature reflection.
 * @param prefix What precedes the parameter list, such as the function name or `new Shape`.
 * @returns The signature.
 */
const toSignature = (signature: SignatureReflection, prefix: string): IApiSignature => {
  const typeParameters = (signature.typeParameters ?? []).map((typeParameter) =>
    [
      typeParameter.name,
      typeParameter.type === undefined ? '' : ` extends ${typeParameter.type.toString()}`,
      typeParameter.default === undefined ? '' : ` = ${typeParameter.default.toString()}`,
    ].join(''),
  );
  const parameters = (signature.parameters ?? []).map(toParameter);
  const parameterText = parameters
    .map(
      (parameter) =>
        `${parameter.isRest ? '...' : ''}${parameter.name}${parameter.isOptional && !parameter.isRest ? '?' : ''}: ${parameter.type}`,
    )
    .join(', ');
  const returnType = signature.type?.toString() ?? 'void';
  const typeParameterText = typeParameters.length === 0 ? '' : `<${typeParameters.join(', ')}>`;
  const isConstructor = signature.kind === ReflectionKind.ConstructorSignature;
  return {
    text: `${prefix}${typeParameterText}(${parameterText})${isConstructor ? '' : `: ${returnType}`}`,
    summary: toText(signature.comment?.summary),
    typeParameters,
    parameters,
    returnType,
    returns: toText(signature.comment?.getTag('@returns')?.content),
    throws: getThrows(signature.comment),
    examples: getTagTexts(signature.comment, '@example'),
    deprecated: getDeprecation(signature.comment),
  };
};

/**
 * Describes the public constructors, methods, and properties of a class or object type.
 * @param reflection The class or type reflection.
 * @param className The class name, used for constructor signatures.
 * @returns The members in source order.
 */
const toMembers = (reflection: DeclarationReflection, className: string): IApiMember[] =>
  (reflection.children ?? [])
    .filter((child) => !child.flags.isPrivate && !child.flags.isProtected)
    .flatMap((child): IApiMember[] => {
      if (child.kind === ReflectionKind.Constructor) {
        const signatures = (child.signatures ?? []).map((signature) =>
          toSignature(signature, `new ${className}`),
        );
        return [
          {
            name: 'constructor',
            kind: 'constructor',
            summary: signatures[0]?.summary ?? '',
            type: undefined,
            signatures,
          },
        ];
      }
      if (child.kind === ReflectionKind.Method) {
        const signatures = (child.signatures ?? []).map((signature) =>
          toSignature(signature, child.name),
        );
        return [
          {
            name: child.name,
            kind: 'method',
            summary: signatures[0]?.summary ?? '',
            type: undefined,
            signatures,
          },
        ];
      }
      if (child.kind === ReflectionKind.Property || child.kind === ReflectionKind.Accessor) {
        return [
          {
            name: child.name,
            kind: 'property',
            summary: toText(child.comment?.summary),
            type: child.type?.toString(),
            signatures: [],
          },
        ];
      }
      return [];
    });

/**
 * Maps a TypeDoc reflection kind to the reference's symbol kind.
 * @param reflection The top-level reflection.
 * @returns The symbol kind, or `undefined` for kinds the reference doesn't describe.
 */
const toSymbolKind = (reflection: DeclarationReflection): IApiSymbolKind | undefined => {
  switch (reflection.kind) {
    case ReflectionKind.Function:
      return 'function';
    case ReflectionKind.Class:
      return 'class';
    case ReflectionKind.TypeAlias:
      return 'type';
    case ReflectionKind.Interface:
      return 'interface';
    case ReflectionKind.Enum:
      return 'enum';
    case ReflectionKind.Variable:
      return reflection.flags.isConst ? 'constant' : 'variable';
    default:
      return undefined;
  }
};

/**
 * Describes one exported symbol. A symbol whose declarations have no comment of their own gets
 * no summary, examples, or deprecation, even when TypeDoc attached a re-export's section comment.
 * @param reflection The top-level reflection, after following re-export references.
 * @param facts The facts collected from the symbol's declarations.
 * @returns The symbol, or `undefined` for kinds the reference doesn't describe.
 */
export const toApiSymbol = (
  reflection: DeclarationReflection,
  facts: IDeclarationFacts | undefined,
): IApiSymbol | undefined => {
  const kind = toSymbolKind(reflection);
  if (kind === undefined) {
    return undefined;
  }
  const hasOwnComment = facts?.hasOwnComment ?? false;
  const comment = hasOwnComment ? reflection.comment : undefined;
  const signatures = (reflection.signatures ?? [])
    .map((signature) => toSignature(signature, reflection.name))
    .map((signature) =>
      hasOwnComment
        ? signature
        : {
            ...signature,
            summary: '',
            returns: '',
            throws: [],
            examples: [],
            deprecated: undefined,
          },
    );
  const isCallable = kind === 'function';
  return {
    name: reflection.name,
    kind,
    summary: isCallable ? (signatures[0]?.summary ?? '') : toText(comment?.summary),
    examples: isCallable
      ? signatures.flatMap((signature) => signature.examples)
      : getTagTexts(comment, '@example'),
    deprecated: isCallable
      ? signatures.find((signature) => signature.deprecated !== undefined)?.deprecated
      : getDeprecation(comment),
    signatures,
    type:
      kind === 'type' || kind === 'interface'
        ? facts?.declarationText
        : kind === 'constant' || kind === 'variable'
          ? reflection.type?.toString()
          : undefined,
    members:
      kind === 'class' || kind === 'type' || kind === 'interface'
        ? toMembers(reflection, reflection.name)
        : [],
  };
};
