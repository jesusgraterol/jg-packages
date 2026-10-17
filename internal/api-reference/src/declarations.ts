import ts from 'typescript';

// what the reference needs to know about a symbol's own declarations
export type IDeclarationFacts = {
  // whether a declaration carries its own comment, rather than inheriting a re-export's comment
  hasOwnComment: boolean;
  // the declaration as code without comments, for types and interfaces
  declarationText: string | undefined;
};

// tool directives that sit in comments but don't document anything
const DIRECTIVE_COMMENT = /^\/[/*]\s*(?:@ts-|eslint|prettier-ignore|istanbul|c8\b)/;

// prints declarations without their comments or `export` keyword
const printer = ts.createPrinter({ removeComments: true });

/**
 * Finds the statement whose leading comments document a declaration: the variable statement of a
 * `const`, or the declaration itself.
 * @param declaration One of the symbol's declarations.
 * @returns The documented statement.
 */
const getDocumentedNode = (declaration: ts.Declaration): ts.Node =>
  ts.isVariableDeclaration(declaration) && ts.isVariableStatement(declaration.parent.parent)
    ? declaration.parent.parent
    : declaration;

/**
 * Checks whether a node is preceded by a comment that isn't a tool directive.
 * @param node The statement to check.
 * @returns Whether the statement has its own documentation comment.
 */
const hasLeadingComment = (node: ts.Node): boolean => {
  const sourceText = node.getSourceFile().text;
  return (ts.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? []).some(
    (range) => !DIRECTIVE_COMMENT.test(sourceText.slice(range.pos, range.end)),
  );
};

/**
 * Prints a type alias or interface as code, without comments and modifiers.
 * @param declaration The declaration to print.
 * @returns The declaration text, or `undefined` for other declarations.
 */
const printTypeDeclaration = (declaration: ts.Declaration): string | undefined => {
  if (!ts.isTypeAliasDeclaration(declaration) && !ts.isInterfaceDeclaration(declaration)) {
    return undefined;
  }
  return printer
    .printNode(ts.EmitHint.Unspecified, declaration, declaration.getSourceFile())
    .replace(/^export\s+(?:declare\s+)?/, '');
};

/**
 * Collects the facts the reference needs from a symbol's declarations. A re-exported symbol is
 * followed to its original declaration first.
 * @param symbol The symbol TypeDoc converted.
 * @param checker The program's type checker.
 * @returns Whether it has its own comment, and its declaration text when it's a type.
 */
export const getDeclarationFacts = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): IDeclarationFacts => {
  const resolved =
    (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
  const declarations = resolved.declarations ?? [];
  return {
    hasOwnComment: declarations.some((declaration) =>
      hasLeadingComment(getDocumentedNode(declaration)),
    ),
    declarationText: declarations.map(printTypeDeclaration).find((text) => text !== undefined),
  };
};
