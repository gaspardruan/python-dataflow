import type { Point } from 'tree-sitter';
import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';

import type { WalkListener } from './interface';
import { ATTRIBUTE } from './type';

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

export function pointString(loc: Point) {
  return `(${loc.row}:${loc.column})`;
}

// walk(parse(`
// c, d = 1, 2
// def add(a, b):
//   if not a > 0 and True:
//     return a + b
//   elif a < 0:
//     return a * b
//   elif a == 0:
//     return a / b
//   else:
//     return a - b
// add(1,2)
// d = {'a': 1, 'b': 2, 'c': 3}
// for k in d.keys():
//   print(k, d[k])`), { onEnterNode: (node) => {
//   if (node.type === 'if_statement') {
//     node.children.forEach((child) => {
//       console.log('CHILDREN', child.type);
//     });
//     console.log('BLOCK:', node.descendantsOfType(ELSE_CLAUSE).length);
//   }
//   console.log('Enter node:', node.type);
// } });

// walk(parse(`
// d = {}
// for k, v in d.items():
//   print(k, v)`), { onEnterNode: (node) => {
//   if (node.type === FOR_STATEMENT) {
//     const left = node.childForFieldName('left')!;
//     const right = node.childForFieldName('right')!;
//     console.log('LEFT:', left.text);
//     console.log('RIGHT:', right.text);
//     const string = `${left.text} = ${right.text}`;
//     const tree = parse(string);
//     const assign = tree.rootNode.firstChild!.firstChild!;
//     console.log('ASSIGN:', assign.text);
//   }
// } });

// walk(parse(`
// with open('file.txt', 'r') as f, open('file2.txt', 'w') as f2:
//   print(f.read())
//     print(f2.read())`), { onEnterNode: (node) => {
//   if (node.type === WITH_ITEM) {
//     node.descendantsOfType(AS_PATTERN).forEach((a) => {
//       const obj = a.firstChild!;
//       const name = a.lastChild!;
//       const str = `${name.text} = ${obj.text}`;
//       const tree = parse(str);
//       const assign = tree.rootNode.firstChild!.firstChild!;
//       console.log('ASSIGN:', assign.text);
//     });
//   }
// },
// });

// walk(parse(`
// try:
//   print('try')
// except Exception:
//   print('except')
// except ValueError as v, TypeError as t:
//   print('except 2')
// except (ValueError, ZeroDivisionError):
//   print('except 3')
// finally:
//   print('finally')`), { onEnterNode: (node) => {
//   console.log('Enter node:', node.id, node.type);
// } });

// walk(parse(`
// import random
// random_num = random.ha.randint(1, 100)
// print(random_num)
// `), { onEnterNode: (node) => {
//   console.log('Enter node:', node.type, node.text);
//   if (node.type === ATTRIBUTE) {
//     const obj = node.childForFieldName('object')!;
//     const name = node.childForFieldName('attribute')!;
//     console.log('OBJ:', obj.text);
//     console.log('NAME:', name.text);
//   }
// } });
