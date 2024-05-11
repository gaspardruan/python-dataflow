import { describe, expect, it } from 'vitest';
import { parse, walk } from '../src';

describe('parser', () => {
  describe('parse', () => {
    it('parse code string', () => {
      const code = 'print("Hello, World!")\n';
      const tree = parse(code);
      expect(tree.rootNode.toString()).toBe(
        '(module (expression_statement (call function: (identifier) arguments: '
        + '(argument_list (string (string_start) (string_content) (string_end))))))',
      );
    });
  });

  describe('walk', () => {
    it('onEnterNode', () => {
      const code = 'print("Hello, World!")\n';
      const tree = parse(code);
      const nodes: string[] = [];
      const walkListener = {
        onEnterNode: (node: any) => {
          nodes.push(node.type);
        },
      };
      walk(tree, walkListener);
      expect(nodes).toEqual([
        'module',
        'expression_statement',
        'call',
        'identifier',
        'argument_list',
        '(',
        'string',
        'string_start',
        'string_content',
        'string_end',
        ')',
      ]);
    });

    it('onExitNode', () => {
      const code = 'print("Hello, World!")\n';
      const tree = parse(code);
      const nodes: string[] = [];
      const walkListener = {
        onExitNode: (node: any) => {
          nodes.push(node.type);
        },
      };
      walk(tree, walkListener);
      expect(nodes).toEqual([
        'identifier',
        '(',
        'string_start',
        'string_content',
        'string_end',
        'string',
        ')',
        'argument_list',
        'call',
        'expression_statement',
        'module',
      ]);
    });
  });
});
