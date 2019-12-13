declare module 'xspans' {
  /* `xspans` also accepts number[], for convenience -- but Flow has some
     (largely unwarranted) difficulty distinguishing between arguments of type
     number[] and number[][], so we omit the former. */
  declare type xspanArg = number[][] | xspans;
  declare class xspans {
    constructor(src: xspanArg): xspans;

    shift(offset: number): xspans;

    intersect(xspanArg): xspans;
    union(xspanArg): xspans;
    subtract(xspanArg): xspans;

    /**
     * Checks if a `xspans` instance `a` contains a scalar `value` or another `xspans`.
     *
     * The function can return the following values:
     *   - `kTestNone` - No match.
     *   - `kTestFull` - Full match.
     *   - `kTestPart` - Partial match.
     *
     * @param {*} a First source parameter, `xspans` or compatible.
     * @param {*} value Value or `xspans` to hit-test.
     * @return {number} Returns `kTestNone`, `kTestFull`, or `kTestPart`.
     */
    test(value: number | xspanArg): 0 | 1 | 2;
    static +kTestNone: 0;
    static +kTestFull: 1;
    static +kTestPart: 2;

    equals(value: xspanArg): boolean;

    isEmpty(): boolean;

    toArrays(): [number, number][];
  }

  declare export default typeof xspans;
}
