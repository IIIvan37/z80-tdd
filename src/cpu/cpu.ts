/** Every Z80 register a test can set or read. `afPrime`… are the shadow registers AF', BC', DE', HL'. */
export interface Registers {
  readonly a: number;
  readonly f: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly h: number;
  readonly l: number;
  readonly af: number;
  readonly bc: number;
  readonly de: number;
  readonly hl: number;
  readonly afPrime: number;
  readonly bcPrime: number;
  readonly dePrime: number;
  readonly hlPrime: number;
  readonly ix: number;
  readonly iy: number;
  readonly ixh: number;
  readonly ixl: number;
  readonly iyh: number;
  readonly iyl: number;
  readonly sp: number;
  readonly pc: number;
  readonly i: number;
  readonly r: number;
}

export interface Cpu {
  registers(): Registers;
  /** Sets the given registers; 16-bit pairs are applied before their 8-bit halves. */
  setRegisters(values: Partial<Registers>): void;
  step(): void;
}
