import { describe, expect, it } from 'vitest';
import { parse } from '../src/parser';
import { ControlFlowGraph } from '../src/control-flow';

const whileCode = `x, y = 0, 0
while x < 10:
  y += x * 2
  x += 1
print(y)`;

const whileCFG = `============== CFG ==============
CFG ENTRY: 1 EXIT: 3
Block 1 (entry)
  0: x, y = 0, 0
  SUCC: 2
Block 2 (while loop head)
  1: x < 10
  SUCC: 4, 3
Block 3 (while loop join)
  4: print(y)
  EXIT
Block 4 (while body)
  2: y += x * 2
  3: x += 1
  SUCC: 2
=================================`;

describe('control-flow', () => {
  describe('while', () => {
    it('parse while statement', () => {
      const tree = parse(whileCode);
      const cfg = new ControlFlowGraph(tree.rootNode);
      expect(cfg.toString()).toBe(whileCFG);
    });
  });
});
