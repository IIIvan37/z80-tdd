import {
  ADDRESS_TAKES,
  BYTE_TAKES,
  type Cpu,
  checkRegisters,
  createCpu,
  disassemble,
  type Flags,
  flagsOf,
  hex,
  isAddress,
  isByte,
  type Ports,
  type RegisterName,
  type Registers,
  registerText,
  withFlags,
} from "./cpu/index.ts";
import {
  CALL_NOPS,
  isNopLimit,
  NOP_LIMIT_TAKES,
  nopsOf,
  RET_NOPS,
} from "./nops.ts";

// How many of the last instructions executed a failure report shows.
const HISTORY_LENGTH = 16;
// The most bytes a Z80 instruction spans.
const LONGEST_INSTRUCTION = 4;
// The return address pushed for the Routine. The Routine has returned when PC is back here
// with the stack back where it was, so a jump to this address alone does not end the Run.
const SENTINEL = 0xffff;

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

/** Runs the Routine at `entry` on a fresh copy of `loaded` until it returns. */
export function run(
  loaded: LoadedProgram,
  entry: number,
  options: RunOptions = {},
): Run {
  checkRegisters(options.registers ?? {}, {
    unsettable: ["pc"],
    why: "the Run starts at the entry label",
  });
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
  const stubs = new Stubs(options.stubs ?? [], toAddress);
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
    const stub = halted ? undefined : stubs.at(before.pc);
    const cost =
      stub === undefined ? nopsOf(memory, before, halted) : stub.cost;
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
      history.recordStub(before.pc);
      stubs.call(cpu, before, stub);
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
    stubCalls: Object.freeze(stubs.calls),
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

type CostedStub = Stub & { readonly cost: number };

/** The Stubs of a Run: where PC reaches each, what a call costs, how it returns, and the calls made. */
class Stubs {
  private readonly made: StubCall[] = [];
  private readonly byAddress = new Map<number, CostedStub>();

  /** Fails on a Stub at no address, with registers `checkRegisters` refuses, a cost that is not a NOP count, or at another's address. */
  constructor(
    declared: readonly Stub[],
    toAddress: (at: LabelOrAddress) => number,
  ) {
    for (const stub of declared) {
      const { at, registers, nops } = stub;
      if (typeof at === "number" && !isAddress(at)) {
        throw new Error(`A Stub cannot be at ${at}: it takes ${ADDRESS_TAKES}`);
      }
      const name = nameOf(at);
      checkRegisters(registers ?? {}, {
        setter: `of the Stub at ${name}`,
        unsettable: ["sp", "pc"],
        why: "the Stub's return sets SP and PC",
      });
      if (nops !== undefined && !isNopLimit(nops)) {
        throw new Error(
          `The Stub at ${name} cannot cost ${nops} NOPs: it takes ${NOP_LIMIT_TAKES}`,
        );
      }
      const address = toAddress(at);
      const other = this.byAddress.get(address);
      if (other !== undefined) {
        throw new Error(
          `The Stubs at ${nameOf(other.at)} and ${name} are both at ${hex(address)}`,
        );
      }
      this.byAddress.set(address, { ...stub, cost: nops ?? RET_NOPS });
    }
  }

  get calls(): readonly StubCall[] {
    return this.made;
  }

  at(pc: number): CostedStub | undefined {
    return this.byAddress.get(pc);
  }

  /** Records the call, then returns as a `RET` would, with the Stub's registers and flags. */
  call(cpu: Cpu, before: Registers, stub: CostedStub): void {
    this.made.push(
      Object.freeze({ at: stub.at, registers: Object.freeze(before) }),
    );
    const { memory } = cpu;
    const returnAddress =
      (memory[before.sp] ?? 0) | ((memory[(before.sp + 1) & 0xffff] ?? 0) << 8);
    setState(
      cpu,
      { ...stub.registers, pc: returnAddress, sp: (before.sp + 2) & 0xffff },
      stub.flags,
    );
  }
}

/** A label as written, an address in CPC hexadecimal. */
function nameOf(at: LabelOrAddress): string {
  return typeof at === "string" ? at : hex(at);
}

const REPORTED_REGISTERS: readonly (readonly RegisterName[])[] = [
  ["af", "bc", "de", "hl"],
  ["afPrime", "bcPrime", "dePrime", "hlPrime"],
  ["ix", "iy", "sp", "pc"],
  ["i", "r"],
];

/** The last instructions executed, with the bytes they had when they ran, and the Stubs called among them. */
class History {
  // A ring buffer allocated once: record() runs on every step of a Run.
  private readonly addresses = new Uint16Array(HISTORY_LENGTH);
  private readonly bytes = new Uint8Array(HISTORY_LENGTH * LONGEST_INSTRUCTION);
  // 1 where the slot holds a Stub call, which has no bytes to disassemble.
  private readonly stubbed = new Uint8Array(HISTORY_LENGTH);
  private recorded = 0;

  recordStub(address: number): void {
    const slot = this.recorded % HISTORY_LENGTH;
    this.addresses[slot] = address;
    this.stubbed[slot] = 1;
    this.recorded++;
  }

  record(memory: Uint8Array, address: number): void {
    const slot = this.recorded % HISTORY_LENGTH;
    this.addresses[slot] = address;
    this.stubbed[slot] = 0;
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
        text: this.stubbed[slot] ? "Stub" : disassemble(address, bytes),
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
  const cell = (name: RegisterName) => registerText(name, registers[name]);
  const lines = REPORTED_REGISTERS.map(
    (row) => `  ${row.map(cell).join("  ")}`,
  );
  return [
    reason,
    "",
    `Last ${history.length} instructions executed:`,
    ...history,
    "",
    "Registers:",
    ...lines,
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

/** Sets `registers`, then the `flags` over the bits of F. */
function setState(
  cpu: Cpu,
  registers: Partial<Registers>,
  flags: Partial<Flags> = {},
): void {
  cpu.setRegisters(registers);
  cpu.setRegisters({ f: withFlags(cpu.registers().f, flags) });
}

function hasReturned({ pc, sp }: Registers, callerSp: number): boolean {
  return pc === SENTINEL && sp === callerSp;
}
