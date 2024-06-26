import type { SyntaxNode } from 'tree-sitter';
import {
  AS_PATTERN,
  BLOCK,
  BREAK_STATEMENT,
  CLASS_DEFINITION,
  CONTINUE_STATEMENT,
  ELIF_CLAUSE,
  ELSE_CLAUSE,
  EXCEPT_CLAUSE,
  FINALLY_CLAUSE,
  FOR_STATEMENT,
  FUNCTION_DEFINITION,
  IF_STATEMENT,
  RAISE_STATEMENT,
  TRY_STATEMENT,
  WHILE_STATEMENT,
  WITH_CLAUSE,
  WITH_ITEM,
  WITH_STATEMENT,
} from './type';
import { Set } from './set';
import { parse } from './parser';

export class Block {
  constructor(
    public id: number,
    public readonly hint: string,
    public statements: SyntaxNode[] = [],
    public loopVariable?: SyntaxNode,
  ) {}

  public toString(): string {
    return (
      `BLOCK ${this.id} (${this.hint})\n${
      this.statements.map(s => `  ${s.startPosition.row}: ${s.text}`).join('\n')}`
    );
  }
}

class BlockSet extends Set<Block> {
  constructor(...items: Block[]) {
    super(b => b.id.toString(), ...items);
  }
}

class Context {
  constructor(
    public loopHead: Block | null,
    public loopExit: Block | null,
    public exceptionBlock: Block,
  ) {}

  public forLoop(loopHead: Block, loopExit: Block): Context {
    return new Context(loopHead, loopExit, this.exceptionBlock);
  }

  public forExcepts(exceptionBlock: Block): Context {
    return new Context(this.loopHead, this.loopExit, exceptionBlock);
  }
}

export class ControlFlowGraph {
  private _blocks: Block[] = [];
  private _globalId = 0;
  private _entry!: Block;
  private _exit!: Block;
  private _successors = new Set<[Block, Block]>(
    ([b1, b2]) => `${b1.id}-${b2.id}`,
  );

  private _loopVariables: SyntaxNode[] = [];

  constructor(node: SyntaxNode) {
    if (!node)
      throw new Error('node undefined');

    [this._entry, this._exit] = this.makeCFG(
      'entry',
      node.children,
      new Context(null, null, this.makeBlock('exceptional exit')),
    );
  }

  private makeBlock(hint: string, statements: SyntaxNode[] = []): Block {
    const b = new Block(this._globalId++, hint, statements);
    if (this._loopVariables.length)
      b.loopVariable = this._loopVariables[this._loopVariables.length - 1];
    this._blocks.push(b);
    return b;
  }

  private link(...blocks: Block[]): void {
    for (let i = 1; i < blocks.length; i++)
      this._successors.add([blocks[i - 1], blocks[i]]);
  }

  private getConsequence(statement: SyntaxNode): SyntaxNode[] {
    const consequence = statement.childForFieldName('consequence');
    if (!consequence)
      throw new Error('statement missing consequence');
    return consequence.children;
  }

  private getBody(statement: SyntaxNode): SyntaxNode[] {
    const body = statement.childForFieldName('body');
    if (!body)
      throw new Error('statement missing body');
    return body.children;
  }

  private getCondition(statement: SyntaxNode): SyntaxNode {
    const condition = statement.childForFieldName('condition');
    if (!condition)
      throw new Error('statement missing condition');
    return condition;
  }

  private getGrammarBlock(statement: SyntaxNode): SyntaxNode[] {
    const grammarBlock = statement.descendantsOfType(BLOCK);
    if (grammarBlock.length !== 1)
      throw new Error(`${statement.type} has wrong quantity of block`);
    return grammarBlock[0].children;
  }

  private getElseClause(statement: SyntaxNode): SyntaxNode | null {
    const elseClause = statement.descendantsOfType(ELSE_CLAUSE);
    if (elseClause.length > 1)
      throw new Error(`${statement.type} has wrong quantity of else clause`);
    return elseClause.length > 0 ? elseClause[0] : null;
  }

  private getFinallyClause(statement: SyntaxNode): SyntaxNode | null {
    const finallyClause = statement.descendantsOfType(FINALLY_CLAUSE);
    if (finallyClause.length > 1)
      throw new Error(`${statement.type} has wrong quantity of finally clause`);
    return finallyClause.length > 0 ? finallyClause[0] : null;
  }

  private handleIf(statement: SyntaxNode, last: Block, context: Context): Block {
    // handle if
    const ifCondBlock = this.makeBlock('if condition', [this.getCondition(statement)]);
    const [bodyEntry, bodyExit] = this.makeCFG(
      'if body',
      this.getConsequence(statement),
      context,
    );
    this.link(last, ifCondBlock, bodyEntry);

    const jointBlock = this.makeBlock('conditional joint');
    this.link(bodyExit, jointBlock);

    let lastCondBlock = ifCondBlock;
    // handle elif
    statement.descendantsOfType(ELIF_CLAUSE).forEach((child) => {
      const elifCondBlock = this.makeBlock('elif condition', [this.getCondition(child)]);
      const [elifBodyEntry, elifBodyExit] = this.makeCFG(
        'elif body',
        this.getConsequence(child),
        context,
      );
      this.link(lastCondBlock, elifCondBlock, elifBodyEntry);
      this.link(elifBodyExit, jointBlock);
      lastCondBlock = elifCondBlock;
    });

    // handle else
    const elseClause = this.getElseClause(statement);
    if (elseClause) {
      const elseCondBlock = this.makeBlock('else condition', [elseClause]);
      const [elseBodyEntry, elseBodyExit] = this.makeCFG(
        'else body',
        this.getBody(elseClause),
        context,
      );
      this.link(lastCondBlock, elseCondBlock, elseBodyEntry);
      this.link(elseBodyExit, jointBlock);
      lastCondBlock = elseCondBlock;
    }

    this.link(lastCondBlock, jointBlock);
    return jointBlock;
  }

  private handleWhile(statement: SyntaxNode, last: Block, context: Context): Block {
    const condition = this.getCondition(statement);
    const loopHead = this.makeBlock('while loop head', [condition]);
    const afterLoop = this.makeBlock('while loop join');
    this._loopVariables.push(condition);
    const [bodyEntry, bodyExit] = this.makeCFG(
      'while body',
      this.getBody(statement),
      context.forLoop(loopHead, afterLoop),
    );
    this._loopVariables.pop();
    this.link(last, loopHead, bodyEntry);
    this.link(bodyExit, loopHead);
    this.link(loopHead, afterLoop);
    return afterLoop;
  }

  // ugly but useful
  private buildAssignFromFor(left: SyntaxNode, right: SyntaxNode): SyntaxNode {
    let str = '';
    for (let i = 0; i < left.startPosition.row; i++)
      str += '\n';
    for (let i = 0; i < left.startPosition.column; i++)
      str += ' ';
    str += left.text;
    str += ' = ';
    for (let i = 0; i < right.startPosition.column - 3 - left.endPosition.column; i++)
      str += ' ';
    str += right.text;
    // Module -> expression_statement -> assignment
    const assign = parse(str).rootNode.firstChild!.firstChild!;
    return assign;
  }

  private handleFor(statement: SyntaxNode, last: Block, context: Context): Block {
    const left = statement.childForFieldName('left');
    if (!left)
      throw new Error('for statement missing left');
    const right = statement.childForFieldName('right');
    if (!right)
      throw new Error('for statement missing right');
    const loopHead = this.makeBlock('for loop head', [this.buildAssignFromFor(left, right)]);

    const afterLoop = this.makeBlock('for loop join');
    this._loopVariables.push(left);
    const [bodyEntry, bodyExit] = this.makeCFG(
      'for body',
      this.getBody(statement),
      context.forLoop(loopHead, afterLoop),
    );
    this._loopVariables.pop();
    this.link(last, loopHead, bodyEntry);
    this.link(bodyExit, loopHead);
    this.link(loopHead, afterLoop);
    return afterLoop;
  }

  // ugly but useful
  private buildAssignFromWith(asPatterns: SyntaxNode[]): SyntaxNode[] {
    return asPatterns.map((a) => {
      const obj = a.firstChild!;
      const name = a.lastChild!;
      let str = '';
      for (let i = 0; i < name.startPosition.row; i++)
        str += '\n';
      for (let i = 0; i < name.startPosition.column; i++)
        str += ' ';
      str += `${name.text} = ${obj.text}`;
      const tree = parse(str);
      const assign = tree.rootNode.firstChild!.firstChild!;
      return assign;
    });
  }

  private extractAsPatterns(statement: SyntaxNode): SyntaxNode[] {
    const withClause = statement.descendantsOfType(WITH_CLAUSE);
    if (withClause.length !== 1)
      throw new Error('with statement has wrong quantity of with clause');
    const asPatterns = withClause[0].descendantsOfType(WITH_ITEM).map(
      w => w.firstChild!,
    );
    asPatterns.forEach((a) => {
      if (a.type !== AS_PATTERN)
        throw new Error('with statement has wrong with item');
    });
    return asPatterns;
  }

  private handleWith(statement: SyntaxNode, last: Block, context: Context): Block {
    const asPatterns = this.extractAsPatterns(statement);
    const resourceBlock = this.makeBlock('with resource', this.buildAssignFromWith(asPatterns));
    const [bodyEntry, bodyExit] = this.makeCFG(
      'with body',
      this.getBody(statement),
      context,
    );
    this.link(last, resourceBlock, bodyEntry);
    return bodyExit;
  }

  private handleTry(statement: SyntaxNode, last: Block, context: Context): Block {
    const afterTry = this.makeBlock('try join');
    let exnContext = context;
    let handlerExits: Block[] = [];
    let handlerHead: Block | undefined;
    const excepts = statement.descendantsOfType(EXCEPT_CLAUSE);
    // TODO:dealing with as patterns
    if (excepts.length > 0) {
      handlerHead = this.makeBlock('exception handler head');
      const handlerCfgs = excepts.map(e =>
        this.makeCFG('exception handler body', this.getGrammarBlock(e), context),
      );
      handlerCfgs.forEach(([exceptEntry]) => {
        this.link(handlerHead!, exceptEntry);
      });
      exnContext = context.forExcepts(handlerHead);
      handlerExits = handlerCfgs.map(([, exceptExit]) => exceptExit);
    }

    const [tryBodyEntry, tryBodyExit] = this.makeCFG(
      'try body',
      this.getBody(statement),
      exnContext,
    );
    this.link(last, tryBodyEntry);

    let normalExit = tryBodyExit;
    if (handlerHead)
      this.link(tryBodyExit, handlerHead);

    const elseClause = this.getElseClause(statement);
    if (elseClause) {
      const [elseEntry, elseExit] = this.makeCFG(
        'try else body',
        this.getBody(elseClause),
        context,
      );
      this.link(normalExit, elseEntry);
      normalExit = elseExit;
    }

    const finallyClause = this.getFinallyClause(statement);
    if (finallyClause) {
      const [finallyEntry, finallyExit] = this.makeCFG(
        'finally body',
        this.getGrammarBlock(finallyClause),
        context,
      );
      this.link(normalExit, finallyEntry);
      this.link(finallyExit, afterTry);
      handlerExits.forEach(handlerExit => this.link(handlerExit, finallyEntry));
    }
    else {
      handlerExits.forEach(handlerExit => this.link(handlerExit, afterTry));
      this.link(normalExit, afterTry);
    }
    return afterTry;
  }

  // TODO: break and continue are not handled correctly
  private makeCFG(hint: string, statements: SyntaxNode[], context: Context): [Block, Block] {
    if (!hint)
      throw new Error('hint undefined');
    if (!statements)
      throw new Error('statements undefined');
    if (!context)
      throw new Error('context undefined');

    const entry = this.makeBlock(hint);
    let last = entry;
    statements.forEach((statement) => {
      switch (statement.type) {
        case IF_STATEMENT:
          last = this.handleIf(statement, last, context);
          break;
        case WHILE_STATEMENT:
          last = this.handleWhile(statement, last, context);
          break;
        case FOR_STATEMENT:
          last = this.handleFor(statement, last, context);
          break;
        case WITH_STATEMENT:
          last = this.handleWith(statement, last, context);
          break;
        case TRY_STATEMENT:
          last = this.handleTry(statement, last, context);
          break;
        case RAISE_STATEMENT:
          this.link(last, context.exceptionBlock);
          return;
        case BREAK_STATEMENT:
          this.link(last, context.loopExit!);
          return;
        case CONTINUE_STATEMENT:
          this.link(last, context.loopHead!);
          return;
        case FUNCTION_DEFINITION:
        case CLASS_DEFINITION:
        default:
          last.statements.push(statement);
          break;
      }
    });
    return [entry, last];
  }

  public get blocks(): Block[] {
    const visited: Block[] = [];
    const toVisit = new BlockSet(this._entry);
    while (toVisit.size) {
      const block = toVisit.take();
      visited.push(block);
      this._successors.items.forEach(([pred, succ]) => {
        if (pred === block && !visited.includes(succ))
          toVisit.add(succ);
      });
    }
    return visited;
  }

  public getSuccessors(block: Block): Block[] {
    return this._successors.items
      .filter(([pred]) => pred === block)
      .map(([, succ]) => succ);
  }

  public getPredecessors(block: Block): Block[] {
    return this._successors.items
      .filter(([, succ]) => succ === block)
      .map(([pred]) => pred);
  }

  public toString() {
    const str: string[] = [];
    str.push('============== CFG ==============');
    str.push(`CFG ENTRY: ${this._entry.id} EXIT: ${this._exit.id}`);
    this.blocks.forEach((block) => {
      str.push(block.toString());
      if (block === this._exit)
        str.push('  EXIT');
      else
        str.push(`  SUCC: ${this.getSuccessors(block).map(b => b.id.toString()).join(',')}`);
    });
    str.push('=================================');
    return str.join('\n');
  }

  private postdominators = new PostdominatorSet();
  private immediatePostdominators: PostdominatorSet = new PostdominatorSet();
  private reverseDominanceFrontiers: { [blockId: string]: BlockSet } = {};

  private initDominaceFrontiers() {
    if (Object.keys(this.reverseDominanceFrontiers).length > 0)
      return;

    const blocks = this.blocks;
    this.postdominators = this.findPostdominators(blocks);
    this.immediatePostdominators = this.getImmediatePostdominators(
      this.postdominators.items,
    );
    this.reverseDominanceFrontiers = this.buildReverseDominanceFrontiers(blocks);
  }

  public visitControlDependencies(visit: (controlStmt: SyntaxNode, stmt: SyntaxNode) => void) {
    this.initDominaceFrontiers();

    for (const block of this.blocks) {
      if (Object.prototype.hasOwnProperty.call(this.reverseDominanceFrontiers, block.id)) {
        const frontiers = this.reverseDominanceFrontiers[block.id];
        for (const frontierBlock of frontiers.items) {
          for (const controlStmt of frontierBlock.statements) {
            for (const stmt of block.statements)
              visit(controlStmt, stmt);
          }
        }
      }
    }
  }

  public getDominanceFrontiers(): { [blockId: string]: number[] } {
    this.initDominaceFrontiers();
    const result: { [blockId: string]: number[] } = {};
    Object.keys(this.reverseDominanceFrontiers).forEach((blockId) => {
      result[blockId] = this.reverseDominanceFrontiers[blockId].items.map(b => b.id);
    });
    return result;
  }

  private postdominatorExists(block: Block, postdominator: Block): boolean {
    return (
      this.postdominators.filter(
        p => p.block === block && p.postdominator === postdominator,
      ).size > 0
    );
  }

  private getImmediatePostdominator(block: Block): Postdominator {
    const immediatePostdominators = this.immediatePostdominators.items.filter(
      p => p.block === block,
    );
    return immediatePostdominators[0];
  }

  /**
   * Merge postdominators that appear in all of a block's successors.
   */
  private produceNewPostdominators(
    successors: Block[],
    postdominators: { [blockId: number]: PostdominatorSet },
    block: Block,
  ) {
    const arr: Postdominator[] = [];
    return new PostdominatorSet(
      ...arr
        .concat(...successors.map(s => postdominators[s.id].items))
        .reduce((pCounts: { p: Postdominator; count: number }[], p) => {
          const countIndex = pCounts.findIndex((record) => {
            return record.p.postdominator === p.postdominator;
          });
          let countRecord;
          if (countIndex === -1) {
            countRecord = {
              p: new Postdominator(p.distance + 1, block, p.postdominator),
              count: 0,
            };
            pCounts.push(countRecord);
          }
          else {
            countRecord = pCounts[countIndex];
            pCounts[countIndex].p.distance = Math.min(
              pCounts[countIndex].p.distance,
              p.distance + 1,
            );
          }
          countRecord.count++;
          return pCounts;
        }, [])
        .filter((p: { p: Postdominator; count: number }) => {
          return p.count === successors.length;
        })
        .map((p: { p: Postdominator; count: number }) => {
          return p.p;
        }),
    );
  }

  private findPostdominators(blocks: Block[]) {
    // Initially, every block has every other block as a postdominator, except for the last block.
    const postdominators: { [blockId: number]: PostdominatorSet } = {};
    for (const block of blocks) {
      postdominators[block.id] = new PostdominatorSet();
      for (const otherBlock of blocks) {
        const distance = block === otherBlock ? 0 : Number.POSITIVE_INFINITY;
        postdominators[block.id].add(new Postdominator(distance, block, otherBlock));
      }
    }
    const lastBlock = blocks.filter(b => this.getSuccessors(b).length === 0)[0];
    postdominators[lastBlock.id] = new PostdominatorSet(
      new Postdominator(0, lastBlock, lastBlock),
    );

    let changed = true;
    while (changed) {
      changed = false;
      for (const block of blocks) {
        if (block === lastBlock)
          continue;

        const oldPostdominators = postdominators[block.id];
        const successors = this.getSuccessors(block);
        const newPostdominators = this.produceNewPostdominators(successors, postdominators, block);
        // A block always postdominates itself.
        newPostdominators.add(new Postdominator(0, block, block));

        if (!oldPostdominators.equals(newPostdominators)) {
          postdominators[block.id] = newPostdominators;
          changed = true;
        }
      }
    }

    let result = new PostdominatorSet();
    Object.keys(postdominators).forEach((blockId) => {
      result = result.union(postdominators[Number.parseInt(blockId)]);
    });
    return result;
  }

  private getImmediatePostdominators(postdominators: Postdominator[]) {
    const postdominatorsByBlock: { [blockId: number]: Postdominator[] }
      = postdominators.filter(p => p.block !== p.postdominator)
        .reduce((dict: { [blockId: number]: Postdominator[] }, postdominator) => {
          if (!Object.prototype.hasOwnProperty.call(dict, postdominator.block.id))
            dict[postdominator.block.id] = [];
          dict[postdominator.block.id].push(postdominator);
          return dict;
        }, {});
    const immediatePostdominators: Postdominator[] = [];
    Object.keys(postdominatorsByBlock).forEach((blockId) => {
      immediatePostdominators.push(
        postdominatorsByBlock[Number.parseInt(blockId)].sort((a, b) => {
          return a.distance - b.distance;
        })[0],
      );
    });
    return new PostdominatorSet(...immediatePostdominators);
  }

  private buildReverseDominanceFrontiers(blocks: Block[]) {
    const frontiers: { [blockId: string]: BlockSet } = {};
    for (const block of blocks) {
      const successors = this.getSuccessors(block);
      if (successors.length > 1) {
        const workQueue = successors;
        const scheduled: Block[] = [];
        const blockImmediatePostdominator = this.getImmediatePostdominator(block);
        while (workQueue.length > 0) {
          const item = workQueue.pop()!;
          if (this.postdominatorExists(block, item))
            continue;
          if (!Object.prototype.hasOwnProperty.call(frontiers, item.id))
            frontiers[item.id] = new BlockSet();
          frontiers[item.id].add(block);
          const immediatePostdominator = this.getImmediatePostdominator(item);
          if (immediatePostdominator.postdominator !== blockImmediatePostdominator.block) {
            this.getSuccessors(item).forEach((b) => {
              if (!scheduled.includes(b)) {
                scheduled.push(b);
                workQueue.push(b);
              }
            });
          }
        }
      }
    }
    return frontiers;
  }
}

/**
 * A block and another block that postdominates it. Distance is the length of the longest path
 * from the block to its postdominator.
 */
class Postdominator {
  constructor(distance: number, block: Block, postdominator: Block) {
    this.distance = distance;
    this.block = block;
    this.postdominator = postdominator;
  }

  distance: number;
  block: Block;
  postdominator: Block;
}

/**
 * A set of postdominators
 */
class PostdominatorSet extends Set<Postdominator> {
  constructor(...items: Postdominator[]) {
    super(p => `${p.block.id},${p.postdominator.id}`, ...items);
  }
}
