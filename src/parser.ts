import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';

import type { WalkListener } from './interface';

export function parse(code: string): Parser.Tree {
  const parser = new Parser();
  parser.setLanguage(Python);
  const tree = parser.parse(code);
  return tree;
}

export function walk(tree: Parser.Tree, walkListener: WalkListener) {
  const walkNode = (node: Parser.SyntaxNode) => {
    if (walkListener.onEnterNode)
      walkListener.onEnterNode(node);

    node.children.forEach(walkNode);

    if (walkListener.onExitNode)
      walkListener.onExitNode(node);
  };
  walkNode(tree.rootNode);
}
