/* eslint-disable no-console */
import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';

export function parse(code: string): Parser.Tree {
  const parser = new Parser();
  parser.setLanguage(Python);
  const tree = parser.parse(code);
  return tree;
}

console.log(parse('print("Hello, World!")\n').rootNode.text);
