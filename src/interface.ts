import type { Point, SyntaxNode } from 'tree-sitter';
import type { FunctionSpec, TypeSpec } from './specs';

export interface WalkListener {
  onEnterNode?: (node: SyntaxNode) => void;
  onExitNode?: (node: SyntaxNode) => void;
}

export enum SymbolType {
  VARIABLE,
  CLASS,
  FUNCTION,
  IMPORT,
  MUTATION,
  MAGIC,
}

export enum ReferenceType {
  DEFINITION = 'DEFINITION',
  UPDATE = 'UPDATE',
  USE = 'USE',
}

export interface Ref {
  type: SymbolType;
  level: ReferenceType;
  name: string;
  inferredType?: TypeSpec<FunctionSpec>;
  startPosition: Point;
  endPosition: Point;
  node: SyntaxNode;
}

export interface Dataflow {
  fromNode: SyntaxNode;
  toNode: SyntaxNode;
  fromRef?: Ref;
  toRef?: Ref;
}
