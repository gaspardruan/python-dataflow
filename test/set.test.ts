import { describe, expect, it } from 'vitest';
import { Set } from '../src/set';

interface Person {
  name: string;
  age: number;
}

describe('set', () => {
  const getIdentifier = (person: Person) => `${person.name}-${person.age}`;
  const person1 = { name: 'Alice', age: 20 };
  const person2 = { name: 'Bob', age: 30 };
  const set = new Set<Person>(getIdentifier, person1, person2);

  it('has', () => {
    expect(set.has({ name: 'Alice', age: 20 })).toBe(true);
    expect(set.has({ name: 'Bob', age: 40 })).toBe(false);
  });

  it('items', () => {
    expect(set.items).toEqual([{ name: 'Alice', age: 20 }, { name: 'Bob', age: 30 }]);
  });

  it('equals', () => {
    const set1 = new Set<Person>(getIdentifier, person2, person1);
    const set2 = new Set<Person>(getIdentifier, person1, person2);
    const set3 = new Set<Person>(getIdentifier, { name: 'Alice', age: 20 }, { name: 'Bob', age: 30 });
    const set4 = new Set<Person>(getIdentifier, { name: 'Alice', age: 20 }, { name: 'Bob', age: 40 });
    expect(set.equals(set1)).toBe(true);
    expect(set.equals(set2)).toBe(true);
    expect(set.equals(set3)).toBe(true);
    expect(set.equals(set4)).toBe(false);
  });

  it('empty', () => {
    const set1 = new Set<Person>(getIdentifier);
    expect(set1.empty).toBe(true);
  });

  it('union', () => {
    const set1 = new Set<Person>(getIdentifier, { name: 'Daniel', age: 30 });
    const set2 = set.union(set1);
    const set3 = new Set<Person>(
      getIdentifier,
      { name: 'Alice', age: 20 },
      { name: 'Bob', age: 30 },
      { name: 'Daniel', age: 30 },
    );
    expect(set2).toEqual(set3);
  });

  it('intersect', () => {
    const set1 = new Set<Person>(getIdentifier, person1, { name: 'Daniel', age: 30 });
    const set2 = set.intersect(set1);
    expect(set2.items).toEqual([person1]);

    set1.take();
    const set3 = set.intersect(set1);
    expect(set3.empty).toBe(true);
  });

  it('filter', () => {
    const set1 = set.filter(p => p.age === 30);
    expect(set1.items).toEqual([person2]);
  });

  it('map', () => {
    const names = set.map<string>(name => name, p => p.name);
    expect(names.items).toEqual([person1.name, person2.name]);
  });

  it('size', () => {
    expect(set.size).toBe(2);
  });

  it('add', () => {
    set.add({ name: 'Alice', age: 20 });
    expect(set.size).toBe(2);

    set.add({ name: 'Daniel', age: 40 });
    expect(set.size).toBe(3);
  });

  it('remove', () => {
    set.remove({ name: 'Daniel', age: 40 });
    expect(set.size).toBe(2);
  });

  it('pop', () => {
    const set1 = new Set<Person>(getIdentifier).union(set);
    const p = set1.pop();
    expect(set1.size).toBe(1);
    expect(p).toEqual(person2);
  });

  it('take', () => {
    const set1 = new Set<Person>(getIdentifier).union(set);
    const p = set1.take();
    expect(set1.size).toBe(1);
    expect(p).toEqual({ name: 'Alice', age: 20 });
  });

  it('mapSame', () => {
    const set1 = new Set<Person>(getIdentifier, { name: 'Alice', age: 20 }, { name: 'Bob', age: 30 });
    const set2 = set1.mapSame((p) => {
      p.age += 1;
      return p;
    });
    expect(set2.items).toEqual([{ name: 'Alice', age: 21 }, { name: 'Bob', age: 31 }]);
  });

  it('minus', () => {
    const set1 = new Set<Person>(getIdentifier, person1, { name: 'Daniel', age: 40 });
    const set2 = set.minus(set1);
    expect(set2.items).toEqual([person2]);
  });
});
