import {
  BYTE_REGISTERS,
  type Cpu,
  createCpu,
  disassemble,
  type Ports,
  type RegisterName,
  type Registers,
  WORD_REGISTERS,
} from "./cpu/index.ts";
import { CALL_NOPS, nopsOf, RET_NOPS } from "./nops.ts";

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
  /** The longest the Run may last, in NOPs; the Program's NOP limit by default. */
  readonly nopLimit?: number;
  /** Bytes written into memory before the Run, at a label or an address. */
  readonly memory?: readonly MemoryWrite[];
  /** What each `IN` returns, by port: a Port read looks up its address under the port mask. */
  readonly ports?: Readonly<Record<number, PortValues>>;
  /** The bits of a port address a Port read matches on; the Program's port mask by default. */
  readonly portMask?: number;
  /** Code the Routine calls that the test does not run: each returns at once. */
  readonly stubs?: readonly Stub[];
}

/** A label or an address where the Run returns to the caller instead of running the code there. */
export interface Stub {
  readonly at: LabelOrAddress;
  /** Set as the Stub returns, as the code at `at` would have left them. */
  readonly registers?: StubRegisters;
  /** Applied after `registers`, so they override the matching bits of F. */
  readonly flags?: Partial<Flags>;
  /** What a call to the Stub costs, in NOPs, on top of the `CALL`; 3, the cost of a `RET`, by default. */
  readonly nops?: number;
}

/** The registers a Stub may set: all but SP and PC, which its return sets. */
export type StubRegisters = Omit<StartRegisters, "sp">;

/** The values an `IN` from a port returns in order, or a function that computes each. */
export type PortValues = readonly number[] | PortFunction;

/** Computes the value of a Port read from the port address read and the Port writes made before it. */
export type PortFunction = (read: {
  readonly address: number;
  readonly writes: readonly PortWrite[];
}) => number;

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
  /** Each `OUT`, in order, with its full 16-bit port address. */
  readonly portWrites: readonly PortWrite[];
  /** Each call to a Stub, in order. */
  readonly stubCalls: readonly StubCall[];
  /** The `length` bytes at a label or an address once the Routine has returned. */
  memory(at: LabelOrAddress, length?: number): readonly number[];
}

/** A Memory change: `before` is the value once the test has written its bytes. */
export interface MemoryChange {
  readonly address: number;
  readonly before: number;
  readonly after: number;
}

export interface StubCall {
  /** The `at` of the Stub, as the test declared it. */
  readonly at: LabelOrAddress;
  /** The registers as PC reached the Stub, before the Stub sets its own. */
  readonly registers: Registers;
}

export interface PortWrite {
  readonly address: number;
  readonly value: number;
}

/** What a Run needs from a Program: the 64 KB it was loaded into, its labels, and its settings. */
export interface LoadedProgram {
  readonly bytes: Uint8Array;
  /** The SP a Run starts with unless its registers set one. */
  readonly sp: number;
  /** The NOP limit of a Run that sets none. */
  readonly nopLimit: number;
  /** The port mask of a Run that sets none. */
  readonly portMask: number;
  /** The address of `label`; fails if the Program has no such label. */
  address(label: string): number;
  /** Whether the Program put a byte at `address`. */
  occupies(address: number): boolean;
  /** The label at or nearest below `address`, as `label` or `label+offset`; empty if none. */
  labelNear(address: number): string;
}

export const NOP_LIMIT_TAKES = "a whole number of NOPs, 0 or more";

/** Whether `value` can be a NOP limit; one that is not would never stop a Run. */
export function isNopLimit(value: unknown): value is number {
  return isWholeIn(value, 0, Number.POSITIVE_INFINITY);
}

export const ADDRESS_TAKES = "#0000 to #FFFF";

/** Whether `value` is a 16-bit address, or a value as wide, such as a port mask. */
export function isAddress(value: unknown): value is number {
  return isWholeIn(value, 0, 0xffff);
}

const BYTE_TAKES = "0 to 255";

function isByte(value: unknown): value is number {
  return isWholeIn(value, 0, 0xff);
}

/** Whether `value` is a whole number from `min` to `max`. */
export function isWholeIn(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
  );
}

/** Runs the Routine at `entry` on a fresh copy of `loaded` until it returns. */
export function run(
  loaded: LoadedProgram,
  entry: number,
  options: RunOptions = {},
): Run {
  checkRegisters(
    options.registers ?? {},
    ["pc"],
    "the Run starts at the entry label",
  );
  const nopLimit = options.nopLimit ?? loaded.nopLimit;
  if (!isNopLimit(nopLimit)) {
    throw new Error(
      `The NOP limit cannot be ${nopLimit}: it takes ${NOP_LIMIT_TAKES}`,
    );
  }
  const portMask = options.portMask ?? loaded.portMask;
  if (!isAddress(portMask)) {
    throw new Error(
      `The port mask cannot be ${portMask}: it takes ${ADDRESS_TAKES}`,
    );
  }
  const supplied = options.ports ?? {};
  checkPorts(supplied, portMask);
  const toAddress = (at: LabelOrAddress) =>
    typeof at === "string" ? loaded.address(at) : at;
  const stubs = stubsByAddress(options.stubs ?? [], toAddress);
  const ports = new SuppliedPorts(supplied, portMask);
  const cpu = createCpu(ports);
  const memory = cpu.memory;
  memory.set(loaded.bytes);

  const callerSp = options.registers?.sp ?? loaded.sp;
  const sp = (callerSp - 2) & 0xffff;
  const returnAddressAt = [sp, (sp + 1) & 0xffff] as const;
  for (const address of returnAddressAt) {
    if (loaded.occupies(address)) {
      throw new Error(
        `The return address pushed at ${hex(address)} would overwrite the Program; set another SP`,
      );
    }
  }
  memory[returnAddressAt[0]] = SENTINEL & 0xff;
  memory[returnAddressAt[1]] = SENTINEL >> 8;
  for (const { at, bytes } of options.memory ?? []) {
    const start = toAddress(at);
    for (const [i, byte] of bytes.entries()) {
      const address = (start + i) & 0xffff;
      if (!isByte(byte)) {
        throw new Error(
          `The byte at ${hex(address)} cannot be ${byte}: it takes ${BYTE_TAKES}`,
        );
      }
      if (returnAddressAt.includes(address)) {
        throw new Error(
          `The bytes written at ${hex(start)} would overwrite the return address pushed at ${hex(sp)}; set another SP`,
        );
      }
      memory[address] = byte;
    }
  }
  setState(cpu, { ...options.registers, sp, pc: entry }, options.flags);

  const stubCalls: StubCall[] = [];
  const initial = memory.slice();
  const stack = new Stack(callerSp);
  const history = new History();
  const failure = (reason: string, registers: Registers, cause?: unknown) =>
    new Error(report(reason, history.lines(loaded), registers), { cause });
  let nops = 0;
  for (
    let before = cpu.registers();
    !hasReturned(before, callerSp);
    before = cpu.registers()
  ) {
    const halted = cpu.internals().halted;
    // Halted, the CPU fetches nothing at PC, so it calls no Stub there.
    const stub = halted ? undefined : stubs.get(before.pc);
    const cost =
      stub === undefined
        ? nopsOf(memory, before, halted)
        : (stub.nops ?? RET_NOPS);
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
    if (stub !== undefined) {
      stubCalls.push(
        Object.freeze({ at: stub.at, registers: Object.freeze(before) }),
      );
      returnFromStub(cpu, before, stub);
      continue;
    }
    // Halted, PC is already past the HALT, and the CPU executes no instruction of the Routine.
    if (!halted) {
      history.record(memory, before.pc);
    }
    try {
      cpu.step();
    } catch (error) {
      if (!(error instanceof PortRefusal)) {
        throw error;
      }
      const { address, key, why, cause } = error;
      throw failure(
        `The Routine read port ${hex(address)} (key ${hex(key)}) at ${hex(before.pc)}, ${why}`,
        before,
        cause,
      );
    }
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
    portWrites: Object.freeze(ports.writes),
    stubCalls: Object.freeze(stubCalls),
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
  // An indexed loop: entries() would allocate a pair for each of the 65,536 bytes.
  for (let address = 0; address < final.length; address++) {
    const after = final[address] ?? 0;
    const before = initial[address] ?? 0;
    if (after !== before) {
      result.push(Object.freeze({ address, before, after }));
    }
  }
  return result;
}

/** The ports of a Run: what the test supplied for each Port read, and the Port writes. */
class SuppliedPorts implements Ports {
  readonly writes: PortWrite[] = [];
  // The writes a port function sees, copied once per run of reads with no OUT between them.
  private snapshot: readonly PortWrite[] | undefined;
  // How many values of each key's sequence the Routine has read.
  private readonly counts = new Map<number, number>();

  constructor(
    private readonly supplied: Readonly<Record<number, PortValues>>,
    private readonly mask: number,
  ) {}

  read(address: number): number {
    const key = address & this.mask;
    const values = this.supplied[key];
    if (values === undefined) {
      throw new PortRefusal(address, key, "which the test did not supply");
    }
    return typeof values === "function"
      ? this.compute(values, address, key)
      : this.next(values, address, key);
  }

  write(address: number, value: number): void {
    this.writes.push(Object.freeze({ address, value }));
    this.snapshot = undefined;
  }

  private compute(compute: PortFunction, address: number, key: number): number {
    this.snapshot ??= Object.freeze(this.writes.slice());
    let value: number;
    try {
      value = compute({ address, writes: this.snapshot });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : cause;
      throw new PortRefusal(
        address,
        key,
        `whose function failed: ${message}`,
        cause,
      );
    }
    if (!isByte(value)) {
      throw new PortRefusal(
        address,
        key,
        `whose function returned ${value}: it takes ${BYTE_TAKES}`,
      );
    }
    return value;
  }

  private next(
    values: readonly number[],
    address: number,
    key: number,
  ): number {
    const count = this.counts.get(key) ?? 0;
    const value = values[count];
    if (value === undefined) {
      const plural = values.length === 1 ? "" : "s";
      throw new PortRefusal(
        address,
        key,
        `past the end of its ${values.length} value${plural}`,
      );
    }
    this.counts.set(key, count + 1);
    return value;
  }
}

/** A Port read the test did not supply, thrown out of the CPU's step for the Run to fail on. */
class PortRefusal extends Error {
  constructor(
    readonly address: number,
    readonly key: number,
    /** Ends the reason of the failure: "which the test did not supply"… */
    readonly why: string,
    cause?: unknown,
  ) {
    super(why, { cause });
  }
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
  // A ring buffer allocated once: record() runs on every step of a Run.
  private readonly addresses = new Uint16Array(HISTORY_LENGTH);
  private readonly bytes = new Uint8Array(HISTORY_LENGTH * LONGEST_INSTRUCTION);
  private recorded = 0;

  record(memory: Uint8Array, address: number): void {
    const slot = this.recorded % HISTORY_LENGTH;
    this.addresses[slot] = address;
    for (let i = 0; i < LONGEST_INSTRUCTION; i++) {
      this.bytes[slot * LONGEST_INSTRUCTION + i] =
        memory[(address + i) & 0xffff] ?? 0;
    }
    this.recorded++;
  }

  /** One line per instruction, oldest first: address, nearest label, mnemonic. */
  lines(loaded: LoadedProgram): string[] {
    const count = Math.min(this.recorded, HISTORY_LENGTH);
    const rows = Array.from({ length: count }, (_, i) => {
      const slot = (this.recorded - count + i) % HISTORY_LENGTH;
      const address = this.addresses[slot] ?? 0;
      const start = slot * LONGEST_INSTRUCTION;
      const bytes = [
        ...this.bytes.subarray(start, start + LONGEST_INSTRUCTION),
      ];
      return {
        address,
        label: loaded.labelNear(address),
        text: disassemble(address, bytes).text,
      };
    });
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

function checkPorts(
  ports: Readonly<Record<number, PortValues>>,
  portMask: number,
): void {
  for (const [key, values] of Object.entries(ports)) {
    const port = Number(key);
    if (!isAddress(port)) {
      throw new Error(`A port cannot be ${key}: it takes ${ADDRESS_TAKES}`);
    }
    if ((port & portMask) !== port) {
      throw new Error(
        `The port ${hex(port)} has bits outside the port mask ${hex(portMask)}, so no Port read would match it`,
      );
    }
    if (Array.isArray(values)) {
      for (const value of values) {
        if (!isByte(value)) {
          throw new Error(
            `A value read at port ${hex(port)} cannot be ${value}: it takes ${BYTE_TAKES}`,
          );
        }
      }
    } else if (typeof values !== "function") {
      throw new Error(
        `The port ${hex(port)} cannot be given ${JSON.stringify(values)}: it takes a list of values or a function`,
      );
    }
  }
}

/** A label as written, an address in CPC hexadecimal. */
function nameOf(at: LabelOrAddress): string {
  return typeof at === "string" ? at : hex(at);
}

/** The Stubs by the address PC reaches them at, once each is checked. */
function stubsByAddress(
  stubs: readonly Stub[],
  toAddress: (at: LabelOrAddress) => number,
): Map<number, Stub> {
  const result = new Map<number, Stub>();
  for (const stub of stubs) {
    const { at, registers, nops } = stub;
    if (typeof at === "number" && !isAddress(at)) {
      throw new Error(`A Stub cannot be at ${at}: it takes ${ADDRESS_TAKES}`);
    }
    const name = nameOf(at);
    checkRegisters(
      registers ?? {},
      ["sp", "pc"],
      "the Stub's return sets SP and PC",
      `of the Stub at ${name}`,
    );
    if (nops !== undefined && !isNopLimit(nops)) {
      throw new Error(
        `The Stub at ${name} cannot cost ${nops} NOPs: it takes ${NOP_LIMIT_TAKES}`,
      );
    }
    const address = toAddress(at);
    const other = result.get(address);
    if (other !== undefined) {
      throw new Error(
        `The Stubs at ${nameOf(other.at)} and ${name} are both at ${hex(address)}`,
      );
    }
    result.set(address, stub);
  }
  return result;
}

/**
 * Fails on a register in `unsettable`, which `why` explains, or a value too wide for its register.
 * `setter` follows the register's name in the message, as "Register a of the Stub at #BB5A".
 */
function checkRegisters(
  registers: StartRegisters,
  unsettable: readonly RegisterName[],
  why: string,
  setter?: string,
): void {
  const subject = (name: string) =>
    setter === undefined ? `Register ${name}` : `Register ${name} ${setter}`;
  for (const name of unsettable) {
    if (name in registers) {
      throw new Error(`${subject(name)} cannot be set: ${why}`);
    }
  }
  for (const [names, max] of [
    [WORD_REGISTERS, 0xffff],
    [BYTE_REGISTERS, 0xff],
  ] as const) {
    for (const name of names) {
      const value = (registers as Partial<Registers>)[name];
      if (value !== undefined && !isWholeIn(value, 0, max)) {
        throw new Error(
          `${subject(name)} cannot hold ${value}: it takes 0 to ${max}`,
        );
      }
    }
  }
}

/** Sets `registers`, then the `flags` over the bits of F. */
function setState(
  cpu: Cpu,
  registers: Partial<Registers>,
  flags: Partial<Flags> = {},
): void {
  cpu.setRegisters(registers);
  cpu.setRegisters({ f: withFlags(cpu.registers().f, flags) });
}

/** Sets the Stub's registers and flags, and pops the return address as a `RET` would. */
function returnFromStub(cpu: Cpu, before: Registers, stub: Stub): void {
  const { memory } = cpu;
  const returnAddress =
    (memory[before.sp] ?? 0) | ((memory[(before.sp + 1) & 0xffff] ?? 0) << 8);
  setState(
    cpu,
    { ...stub.registers, pc: returnAddress, sp: (before.sp + 2) & 0xffff },
    stub.flags,
  );
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
