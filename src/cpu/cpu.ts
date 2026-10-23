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

/** State a Routine cannot read as a register but that shapes what it observes. */
export interface Internals {
  /** The hidden WZ (MEMPTR) register, which leaks into bits 3 and 5 of F after `BIT n,(HL)`. */
  readonly wz: number;
  readonly iff1: boolean;
  readonly iff2: boolean;
  readonly im: number;
  /** The Q latch: F if the last instruction wrote the flags, else 0; `SCF` and `CCF` read it for bits 3 and 5. */
  readonly q: number;
  /** Set by `HALT`: the CPU then executes `NOP`s internally until an interrupt, which never comes in a Run. */
  readonly halted: boolean;
}

/** The I/O ports the CPU reads with `IN` and writes with `OUT`, by full 16-bit address. */
export interface Ports {
  read(address: number): number;
  write(address: number, value: number): void;
}

/** One instruction, disassembled. */
export interface Instruction {
  /** The mnemonic, numbers in hexadecimal as CPC assemblers write them, such as `LD A,#05`. */
  readonly text: string;
  /** How many bytes the instruction spans, 1 to 4. */
  readonly length: number;
}

export interface Cpu {
  /** The 64 KB the CPU executes from and into; writing to it changes what the CPU sees. */
  readonly memory: Uint8Array;
  registers(): Registers;
  /** Sets the given registers; 16-bit pairs are applied before their 8-bit halves. */
  setRegisters(values: Partial<Registers>): void;
  internals(): Internals;
  setInternals(values: Partial<Internals>): void;
  /** Executes one instruction; a repeated block instruction such as `LDIR` executes one iteration. */
  step(): void;
}
