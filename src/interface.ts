import type { SyntaxNode } from 'tree-sitter';

export interface WalkListener {
  onEnterNode?: (node: SyntaxNode) => void;
  onExitNode?: (node: SyntaxNode) => void;
}
