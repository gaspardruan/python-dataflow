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
BLOCK 1 (entry)
  0: x, y = 0, 0
  SUCC: 2
BLOCK 2 (while loop head)
  1: x < 10
  SUCC: 4,3
BLOCK 3 (while loop join)
  4: print(y)
  EXIT
BLOCK 4 (while body)
  2: y += x * 2
  3: x += 1
  SUCC: 2
=================================`;

const ifCode = `number = input()
if number > 0:
  print("Positive")
elif number < 0:
  print("Negative")
else:
  print("Zero")`;

const ifCFG = `============== CFG ==============
CFG ENTRY: 1 EXIT: 4
BLOCK 1 (entry)
  0: number = input()
  SUCC: 2
BLOCK 2 (if condition)
  1: number > 0
  SUCC: 3,5
BLOCK 3 (if body)
  2: print("Positive")
  SUCC: 4
BLOCK 4 (conditional joint)

  EXIT
BLOCK 5 (elif condition)
  3: number < 0
  SUCC: 6,7
BLOCK 6 (elif body)
  4: print("Negative")
  SUCC: 4
BLOCK 7 (else condition)
  5: else:
  print("Zero")
  SUCC: 8,4
BLOCK 8 (else body)
  6: print("Zero")
  SUCC: 4
=================================`;

const forCode = `n = input()
for i in range(n):
  print(i)`;

const forCFG = `============== CFG ==============
CFG ENTRY: 1 EXIT: 3
BLOCK 1 (entry)
  0: n = input()
  SUCC: 2
BLOCK 2 (for loop head)
  1: i =  range(n)
  SUCC: 4,3
BLOCK 3 (for loop join)

  EXIT
BLOCK 4 (for body)
  2: print(i)
  SUCC: 2
=================================`;

const withCode = `with open("file.txt", "r") as f:
  for line in f:
    print(line)`;

const withCFG = `============== CFG ==============
CFG ENTRY: 1 EXIT: 5
BLOCK 1 (entry)

  SUCC: 2
BLOCK 2 (with resource)
  0: f = open("file.txt", "r")
  SUCC: 3
BLOCK 3 (with body)

  SUCC: 4
BLOCK 4 (for loop head)
  1: line =  f
  SUCC: 6,5
BLOCK 5 (for loop join)

  EXIT
BLOCK 6 (for body)
  2: print(line)
  SUCC: 4
=================================`;

const tryCode = `x = 0
try:
  print(1 / x)
except ZeroDivisionError:
  print("Division by zero")
else:
  print("No exception")
finally:
  print("Finally block")
print("After try block")`;

const tryCFG = `============== CFG ==============
CFG ENTRY: 1 EXIT: 2
BLOCK 1 (entry)
  0: x = 0
  SUCC: 5
BLOCK 5 (try body)
  2: print(1 / x)
  SUCC: 3,6
BLOCK 3 (exception handler head)

  SUCC: 4
BLOCK 4 (exception handler body)
  4: print("Division by zero")
  SUCC: 7
BLOCK 6 (try else body)
  6: print("No exception")
  SUCC: 7
BLOCK 7 (finally body)
  8: print("Finally block")
  SUCC: 2
BLOCK 2 (try join)
  9: print("After try block")
  EXIT
=================================`;

const jumpCode = `n = input()
for i in range(n):
  for j in range(n):
    if i == j:
      continue
    elif j > 6:
      break`;

const jumpCFG = `============== CFG ==============
CFG ENTRY: 1 EXIT: 3
BLOCK 1 (entry)
  0: n = input()
  SUCC: 2
BLOCK 2 (for loop head)
  1: i =  range(n)
  SUCC: 4,3
BLOCK 3 (for loop join)

  EXIT
BLOCK 4 (for body)

  SUCC: 5
BLOCK 5 (for loop head)
  2: j =  range(n)
  SUCC: 7,6
BLOCK 6 (for loop join)

  SUCC: 2
BLOCK 7 (for body)

  SUCC: 8
BLOCK 8 (if condition)
  3: i == j
  SUCC: 9,11
BLOCK 9 (if body)

  SUCC: 5,10
BLOCK 10 (conditional joint)

  SUCC: 5
BLOCK 11 (elif condition)
  5: j > 6
  SUCC: 12,10
BLOCK 12 (elif body)

  SUCC: 6,10
=================================`;

const dfCode = `ans = input()
while ans != "yes":
  if ans.startswith("y"):
    print("You mean yes?")
  elif ans.startswith("n"):
    print("You mean no?")
  else:
    print("I don't understand")
  ans = input()
print("Goodbye")`;

const dfCFG = `============== CFG ==============
CFG ENTRY: 1 EXIT: 3
BLOCK 1 (entry)
  0: ans = input()
  SUCC: 2
BLOCK 2 (while loop head)
  1: ans != "yes"
  SUCC: 4,3
BLOCK 3 (while loop join)
  9: print("Goodbye")
  EXIT
BLOCK 4 (while body)

  SUCC: 5
BLOCK 5 (if condition)
  2: ans.startswith("y")
  SUCC: 6,8
BLOCK 6 (if body)
  3: print("You mean yes?")
  SUCC: 7
BLOCK 7 (conditional joint)
  8: ans = input()
  SUCC: 2
BLOCK 8 (elif condition)
  4: ans.startswith("n")
  SUCC: 9,10
BLOCK 9 (elif body)
  5: print("You mean no?")
  SUCC: 7
BLOCK 10 (else condition)
  6: else:
    print("I don't understand")
  SUCC: 11,7
BLOCK 11 (else body)
  7: print("I don't understand")
  SUCC: 7
=================================`;

describe('control-flow', () => {
  describe('while', () => {
    it('parse while statement', () => {
      const tree = parse(whileCode);
      const cfg = new ControlFlowGraph(tree.rootNode);
      expect(cfg.toString()).toBe(whileCFG);
    });
  });

  describe('if', () => {
    it('parse if statement', () => {
      const tree = parse(ifCode);
      const cfg = new ControlFlowGraph(tree.rootNode);
      expect(cfg.toString()).toBe(ifCFG);
    });
  });

  describe('for', () => {
    it('parse for statement', () => {
      const tree = parse(forCode);
      const cfg = new ControlFlowGraph(tree.rootNode);
      expect(cfg.toString()).toBe(forCFG);
    });
  });

  describe('with', () => {
    it('parse with statement', () => {
      const tree = parse(withCode);
      const cfg = new ControlFlowGraph(tree.rootNode);
      expect(cfg.toString()).toBe(withCFG);
    });
  });

  describe('try', () => {
    it('parse try statement', () => {
      const tree = parse(tryCode);
      const cfg = new ControlFlowGraph(tree.rootNode);
      expect(cfg.toString()).toBe(tryCFG);
    });
  });

  describe('jump', () => {
    it('parse jump statement', () => {
      const tree = parse(jumpCode);
      const cfg = new ControlFlowGraph(tree.rootNode);
      expect(cfg.toString()).toBe(jumpCFG);
    });
  });

  describe('dominance frontiers', () => {
    it('compute dominance frontiers', () => {
      const tree = parse(dfCode);
      const cfg = new ControlFlowGraph(tree.rootNode);
      const frontiers = cfg.getDominanceFrontiers();
      expect(cfg.toString()).toBe(dfCFG);
      expect(frontiers).toEqual({
        4: [2],
        5: [2],
        6: [2, 5],
        7: [2],
        8: [2, 5],
        9: [2, 5, 8],
        10: [2, 5, 8],
        11: [2, 5, 8, 10],
      });
    });
  });
});
