import {
  BYTE_REGISTERS,
  createCpu,
  disassemble,
  type Registers,
  WORD_REGISTERS,
} from "./cpu/index.ts";
import { CALL_NOPS, nopsOf } from "./nops.ts";

const DEFAULT_SP = 0xc000;
const DEFAULT_NOP_LIMIT = 1_000_000;
// How many of the last instructions executed a failure report shows.
const HISTORY_LENGTH = 16;
// The most bytes a Z80 instruction spans.
const LONGEST_INSTRUCTION = 4;
// The return address pushed for the Routine. The Routine has returned when PC is back here
// with the stack back where it was, so a jump to this address alone does not end the Run.
const SENTINEL = 0xffff;

/** The bits of F. `y` and `x` are the undocumented bits 5 and 3. */
export interface Flags {
  readonly s: boolean;
  readonly z: boolean;
  readonly y: boolean;
  readonly h: boolean;
  readonly x: boolean;
  readonly pv: boolean;
  readonly n: boolean;
  readonly c: boolean;
}

const FLAG_BITS: Readonly<Record<keyof Flags, number>> = {
  s: 0x80,
  z: 0x40,
  y: 0x20,
  h: 0x10,
  x: 0x08,
  pv: 0x04,
  n: 0x02,
  c: 0x01,
};

/** The registers a test may set before a Run: all but PC, which starts at the entry label. */
export type StartRegisters = Partial<Omit<Registers, "pc">>;

export interface RunOptions {
  readonly registers?: StartRegisters;
  /** Applied after `registers`, so they override the matching bits of F. */
  readonly flags?: Partial<Flags>;
  /** The longest the Run may last, in NOPs; 1,000,000 by default. */
  readonly nopLimit?: number;
  /** Bytes written into memory before the Run, at a label or an address. */
  readonly memory?: readonly MemoryWrite[];
}

/** A label of the Program, or an address. */
export type LabelOrAddress = string | number;

export interface MemoryWrite {
  readonly at: LabelOrAddress;
  readonly bytes: readonly number[];
}

export interface Run {
  readonly registers: Registers;
  readonly flags: Flags;
  /** From the Routine's first instruction to its final `RET` included. */
  readonly nops: number;
  /** `nops` plus the `CALL` that enters the Routine. */
  readonly nopsWithCall: number;
  /** Each byte the Run changed, by address, except the stack the Routine used (ADR 0005). */
  readonly memoryChanges: readonly MemoryChange[];
  /** The `length` bytes at a label or an address once the Routine has returned. */
  memory(at: LabelOrAddress, length?: number): readonly number[];
}

/** A Memory change: `before` is the value once the test has written its bytes. */
export interface MemoryChange {
  readonly address: number;
  readonly before: number;
  readonly after: number;
}

/** What a Run needs from a Program: the 64 KB it was loaded into, and its labels. */
export interface LoadedProgram {
  readonly bytes: Uint8Array;
  /** The address of `label`; fails if the Program has no such label. */
  address(label: string): number;
  /** Whether the Program put a byte at `address`. */
  occupies(address: number): boolean;
  /** The label at or nearest below `address`, as `label` or `label+offset`; empty if none. */
  labelNear(address: number): string;
}

/** Runs the Routine at `entry` on a fresh copy of `loaded` until it returns. */
export function run(
  loaded: LoadedProgram,
  entry: number,
  options: RunOptions = {},
): Run {
  checkWidths(options.registers ?? {});
  const nopLimit = options.nopLimit ?? DEFAULT_NOP_LIMIT;
  if (!(Number.isInteger(nopLimit) && nopLimit >= 0)) {
    throw new Error(
      `The NOP limit cannot be ${nopLimit}: it takes a whole number of NOPs, 0 or more`,
    );
  }
  const toAddress = (at: LabelOrAddress) =>
    typeof at === "string" ? loaded.address(at) : at;
  const cpu = createCpu();
  const memory = cpu.memory;
  memory.set(loaded.bytes);

  const callerSp = options.registers?.sp ?? DEFAULT_SP;
  const sp = (callerSp - 2) & 0xffff;
  for (const [address, byte] of [
    [sp, SENTINEL & 0xff],
    [(sp + 1) & 0xffff, SENTINEL >> 8],
  ] as const) {
    if (loaded.occupies(address)) {
      throw new Error(
        `The return address pushed at ${hex(address)} would overwrite the Program; set another SP`,
      );
    }
    memory[address] = byte;
  }
  for (const { at, bytes } of options.memory ?? []) {
    const start = toAddress(at);
    for (const [i, byte] of bytes.entries()) {
      const address = (start + i) & 0xffff;
      if (!(Number.isInteger(byte) && byte >= 0 && byte <= 0xff)) {
        throw new Error(
          `The byte at ${hex(address)} cannot be ${byte}: it takes 0 to 255`,
        );
      }
      if (address === sp || address === ((sp + 1) & 0xffff)) {
        throw new Error(
          `The bytes written at ${hex(start)} would overwrite the return address pushed at ${hex(sp)}; set another SP`,
        );
      }
      memory[address] = byte;
    }
  }
  cpu.setRegisters({ ...options.registers, sp, pc: entry });
  cpu.setRegisters({ f: withFlags(cpu.registers().f, options.flags ?? {}) });

  const initial = memory.slice();
  const stack = new Stack(callerSp);
  const history = new History();
  const failure = (reason: string, registers: Registers) =>
    new Error(report(reason, history.lines(loaded), registers));
  let nops = 0;
  for (
    let before = cpu.registers();
    !hasReturned(before, callerSp);
    before = cpu.registers()
  ) {
    const halted = cpu.internals().halted;
    const cost = nopsOf(memory, before, halted);
    if (cost === undefined) {
      throw failure(
        `No NOP count for the instruction ${hex(memory[before.pc] ?? 0, 2)} at ${hex(before.pc)}`,
        before,
      );
    }
    if (nops + cost > nopLimit) {
      throw failure(
        `The Run reached its NOP limit of ${nopLimit.toLocaleString("en-US")} NOPs`,
        before,
      );
    }
    nops += cost;
    stack.reach(before.sp);
    // Halted, PC is already past the HALT, and the CPU executes no instruction of the Routine.
    if (!halted) {
      history.record(memory, before.pc);
    }
    cpu.step();
  }

  const registers = Object.freeze(cpu.registers());
  // The CPU's memory lives on in its WebAssembly instance; the result keeps a copy.
  const final = memory.slice();
  return Object.freeze({
    registers,
    flags: Object.freeze(flagsOf(registers.f)),
    nops,
    nopsWithCall: nops + CALL_NOPS,
    memoryChanges: Object.freeze(
      changes(initial, final).filter(({ address }) => !stack.holds(address)),
    ),
    memory: (at: LabelOrAddress, length = 1) => {
      const address = toAddress(at);
      return Object.freeze(
        Array.from({ length }, (_, i) => final[(address + i) & 0xffff] ?? 0),
      );
    },
  });
}

/** The stack the Routine used, which Memory changes leave out (ADR 0005). */
class Stack {
  // Depths count bytes below the caller's SP; the sentinel return address is the first 2.
  private deepest = 2;
  // The depth of the last SP seen, or undefined if SP had left the stack.
  private last: number | undefined = 2;

  constructor(private readonly callerSp: number) {}

  reach(sp: number): void {
    const depth = this.depthOf(sp);
    if (
      this.last !== undefined &&
      depth > this.deepest &&
      depth <= this.last + 2
    ) {
      this.deepest = depth;
    }
    this.last = depth <= this.deepest ? depth : undefined;
  }

  holds(address: number): boolean {
    const depth = this.depthOf(address);
    return depth >= 1 && depth <= this.deepest;
  }

  private depthOf(address: number): number {
    return (this.callerSp - address) & 0xffff;
  }
}

function changes(initial: Uint8Array, final: Uint8Array): MemoryChange[] {
  const result: MemoryChange[] = [];
  for (const [address, after] of final.entries()) {
    const before = initial[address] ?? 0;
    if (after !== before) {
      result.push(Object.freeze({ address, before, after }));
    }
  }
  return result;
}

const REPORTED_REGISTERS: readonly (readonly [string, keyof Registers])[][] = [
  [
    ["AF", "af"],
    ["BC", "bc"],
    ["DE", "de"],
    ["HL", "hl"],
  ],
  [
    ["AF'", "afPrime"],
    ["BC'", "bcPrime"],
    ["DE'", "dePrime"],
    ["HL'", "hlPrime"],
  ],
  [
    ["IX", "ix"],
    ["IY", "iy"],
    ["SP", "sp"],
    ["PC", "pc"],
  ],
];

/** The last instructions executed, with the bytes they had when they ran. */
class History {
  private readonly entries: { address: number; bytes: number[] }[] = [];
  private next = 0;

  record(memory: Uint8Array, address: number): void {
    const bytes = Array.from(
      { length: LONGEST_INSTRUCTION },
      (_, i) => memory[(address + i) & 0xffff] ?? 0,
    );
    this.entries[this.next] = { address, bytes };
    this.next = (this.next + 1) % HISTORY_LENGTH;
  }

  /** One line per instruction, oldest first: address, nearest label, mnemonic. */
  lines(loaded: LoadedProgram): string[] {
    const oldestFirst = [
      ...this.entries.slice(this.next),
      ...this.entries.slice(0, this.next),
    ];
    const rows = oldestFirst.map(({ address, bytes }) => ({
      address,
      label: loaded.labelNear(address),
      text: disassemble(address, bytes).text,
    }));
    const width = Math.max(0, ...rows.map(({ label }) => label.length));
    return rows.map(
      ({ address, label, text }) =>
        `  ${hex(address)}  ${label.padEnd(width)}  ${text}`,
    );
  }
}

/** The message of a failed Run: why it failed, where it went, and the state it left. */
function report(
  reason: string,
  history: readonly string[],
  registers: Registers,
): string {
  const lines = REPORTED_REGISTERS.map(
    (row) =>
      `  ${row.map(([label, name]) => `${label} ${hex(registers[name])}`).join("  ")}`,
  );
  const iAndR = `  I ${hex(registers.i, 2)}  R ${hex(registers.r, 2)}`;
  return [
    reason,
    "",
    `Last ${history.length} instructions executed:`,
    ...history,
    "",
    "Registers:",
    ...lines,
    iAndR,
  ].join("\n");
}

function checkWidths(registers: StartRegisters): void {
  if ("pc" in registers) {
    throw new Error(
      "Register pc cannot be set: the Run starts at the entry label",
    );
  }
  for (const [names, max] of [
    [WORD_REGISTERS, 0xffff],
    [BYTE_REGISTERS, 0xff],
  ] as const) {
    for (const name of names) {
      const value = (registers as Partial<Registers>)[name];
      if (
        value !== undefined &&
        !(Number.isInteger(value) && value >= 0 && value <= max)
      ) {
        throw new Error(
          `Register ${name} cannot hold ${value}: it takes 0 to ${max}`,
        );
      }
    }
  }
}

function hasReturned({ pc, sp }: Registers, callerSp: number): boolean {
  return pc === SENTINEL && sp === callerSp;
}

function withFlags(f: number, flags: Partial<Flags>): number {
  let result = f;
  for (const [name, set] of Object.entries(flags) as [keyof Flags, boolean][]) {
    result = set ? result | FLAG_BITS[name] : result & ~FLAG_BITS[name];
  }
  return result;
}

function flagsOf(f: number): Flags {
  const entries = Object.entries(FLAG_BITS).map(([name, bit]) => [
    name,
    (f & bit) !== 0,
  ]);
  return Object.fromEntries(entries) as Flags;
}

/** `value` in CPC hexadecimal, as `#C000`. */
export function hex(value: number, digits = 4): string {
  return `#${value.toString(16).toUpperCase().padStart(digits, "0")}`;
}
