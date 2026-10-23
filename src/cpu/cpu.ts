// Pairs come first: setting registers in this order lets an 8-bit register override its pair.
export const WORD_REGISTERS = [
  "af",
  "bc",
  "de",
  "hl",
  "afPrime",
  "bcPrime",
  "dePrime",
  "hlPrime",
  "ix",
  "iy",
  "sp",
  "pc",
] as const;

export const BYTE_REGISTERS = [
  "a",
  "f",
  "b",
  "c",
  "d",
  "e",
  "h",
  "l",
  "ixh",
  "ixl",
  "iyh",
  "iyl",
  "i",
  "r",
] as const;

export type RegisterName =
  | (typeof WORD_REGISTERS)[number]
  | (typeof BYTE_REGISTERS)[number];

/** Every Z80 register a test can set or read. `afPrime`… are the shadow registers AF', BC', DE', HL'. */
export type Registers = { readonly [name in RegisterName]: number };

export interface Cpu {
  registers(): Registers;
  /** Sets the given registers; 16-bit pairs are applied before their 8-bit halves. */
  setRegisters(values: Partial<Registers>): void;
  step(): void;
}
