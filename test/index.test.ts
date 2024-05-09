import { describe, expect, it } from 'vitest';
import { parse } from '../src/index';

describe('parse', () => {
  it('parses Python code', () => {
    const code = 'print("Hello, World!")\n';
    const tree = parse(code);
    expect(tree.rootNode.toString()).toBe(
      '(module (expression_statement (call function: (identifier) arguments: '
      + '(argument_list (string (string_start) (string_content) (string_end))))))',
    );
  });
});
