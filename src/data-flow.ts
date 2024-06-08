import type { Dataflow, Ref } from './interface';
import { ReferenceType } from './interface';
import { Set } from './set';
import { pointString } from './parser';

export class RefSet extends Set<Ref> {
  constructor(...items: Ref[]) {
    super(
      r => `${r.name}${r.level}${pointString(r.startPosition)}-${pointString(r.endPosition)}`,
      ...items,
    );
  }
}

function getDataflowId(df: Dataflow) {
  // if (!df.fromNode.location) { console.log('*** FROM', df.fromNode, df.fromNode.location); }
  // if (!df.toNode.location) { console.log('*** TO', df.toNode, df.toNode.location); }
  return `${df.fromNode.id}->${df.toNode.id}`;
}

// eslint-disable-next-line unused-imports/no-unused-vars
class DefUse {
  constructor(
    public DEFINITION = new RefSet(),
    public UPDATE = new RefSet(),
    public USE = new RefSet(),
  ) {}

  public get defs() {
    return this.DEFINITION.union(this.UPDATE);
  }

  public get uses() {
    return this.UPDATE.union(this.USE);
  }

  public union(that: DefUse) {
    return new DefUse(
      this.DEFINITION.union(that.DEFINITION),
      this.UPDATE.union(that.UPDATE),
      this.USE.union(that.USE),
    );
  }

  public update(newRefs: DefUse) {
    const GEN_RULES: { [ k: string]: ReferenceType[] } = {
      USE: [ReferenceType.UPDATE, ReferenceType.DEFINITION],
      UPDATE: [ReferenceType.DEFINITION],
      DEFINITION: [],
    };

    const KILL_RULES: { [k: string]: ReferenceType[] } = {
      DEFINITION: [ReferenceType.DEFINITION, ReferenceType.UPDATE],
      UPDATE: [ReferenceType.DEFINITION, ReferenceType.UPDATE],
      USE: [],
    };

    for (const _level of Object.keys(ReferenceType)) {
      const level = _level as keyof typeof ReferenceType;
      let genSet = new RefSet();
      for (const genLevel of GEN_RULES[level])
        genSet = genSet.union(newRefs[genLevel]);
      const killSet = this[level].filter(def =>
        genSet.items.some(gen =>
          gen.name === def.name && KILL_RULES[gen.level].includes(def.level)));

      this[level] = this[level].minus(killSet).union(genSet);
    }
  }

  public equals(that: DefUse) {
    return this.DEFINITION.equals(that.DEFINITION)
      && this.UPDATE.equals(that.UPDATE)
      && this.USE.equals(that.USE);
  }

  public createFlowsFrom(fromSet: DefUse): [Set<Dataflow>, Set<Ref>] {
    const toSet = this;
    const refsDefined = new RefSet();
    const newFlows = new Set<Dataflow>(getDataflowId);
    for (const _level of Object.keys(ReferenceType)) {
      const level = _level as keyof typeof ReferenceType;
      for (const to of toSet[level].items) {
        for (const from of fromSet[level].items) {
          if (from.name === to.name) {
            refsDefined.add(to);
            newFlows.add({ fromNode: from.node, toNode: to.node, fromRef: from, toRef: to });
          }
        }
      }
    }
    return [newFlows, refsDefined];
  }
}
