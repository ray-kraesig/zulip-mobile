// @flow

import XSpan from 'xspans';

type ImplType = XSpan;

// eslint-disable-next-line no-use-before-define
type ArgType = number[][] | IntervalSet;

/** Type describing unions of sets of intervals of `number`. */

// NPM has half a dozen different interval-tree libraries, none of which seem to
// have anything in particular to recommend or disrecommend any of them over any
// others. This class presently wraps one of them. In the unforeseeable future,
// it may wrap a different one.
//
// More immediately and practically, it provides a slightly more straightforward
// API than that of its underlying implementation.

class IntervalSet {
  // (`this._value` passes, but `that._value` causes warnings.)
  /* eslint-disable no-underscore-dangle */

  _value: ImplType;

  constructor(intervals: number[][] | ImplType | IntervalSet) {
    if (intervals instanceof XSpan) {
      this._value = intervals;
      return;
    }

    if (intervals instanceof IntervalSet) {
      this._value = intervals._value;
      return;
    }

    this._value = new XSpan(intervals);
  }

  static _asImplType(value: number[][] | ImplType | IntervalSet): ImplType {
    if (value instanceof IntervalSet) {
      return value._value;
    }
    if (value instanceof XSpan) {
      return value;
    }
    return new XSpan(value);
  }

  static _universe = new IntervalSet([[-Infinity, Infinity]]);

  _do<R>(action: (ImplType, ImplType) => R, value: ArgType): R {
    return action(this._value, IntervalSet._asImplType(value));
  }

  union(that: ArgType): IntervalSet {
    return new IntervalSet(this._do((a, b) => a.union(b), that));
  }
  intersection(that: ArgType): IntervalSet {
    return new IntervalSet(this._do((a, b) => a.intersect(b), that));
  }
  except(that: ArgType): IntervalSet {
    return new IntervalSet(this._do((a, b) => a.subtract(b), that));
  }

  equals(that: ArgType): boolean {
    return this._do((a, b) => a.equals(b), that);
  }

  complement(): IntervalSet {
    return new IntervalSet(IntervalSet._universe._value.subtract(this._value));
  }

  isEmpty(): boolean {
    return this._value.isEmpty();
  }

  // equivalent to (A ∩ B = B)
  contains(that: ArgType): boolean {
    return this._do((a, b) => a.test(b), that) === XSpan.kTestFull;
  }
  // equivalent to (A ∪ B ≠ ∅)
  overlaps(that: ArgType): boolean {
    return this._do((a, b) => a.test(b), that) !== XSpan.kTestNone;
  }

  containsValue(n: number): boolean {
    return this._value.test(n) === XSpan.kTestFull;
  }

  getSpans(): [number, number][] {
    return this._value.toArrays();
  }
}

export default IntervalSet;
