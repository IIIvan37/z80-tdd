// CPC durations from Madram / Overlanders, "Perfectly accurate Z80 flags and CPC timing"
// v1.0.6 (64NOPS blog). See ADR 0002 for why the tool owns this table.
import { FLAG_BITS, isWholeIn, type Registers } from "./cpu/index.ts";

/** The 3-bit register codes B C D E H L A; code 6, (HL), is left out. */
const REGISTER_CODES = [0, 1, 2, 3, 4, 5, 7];

/**
 * A conditional instruction: its NOPs when its condition is met, and when it is not. A repeated
 * block instruction's condition is that it repeats.
 */
interface Conditional {
  readonly met: number;
  readonly notMet: number;
  isMet(before: Registers, memory: Uint8Array): boolean;
}

type Entry = number | Conditional;

export const CALL_NOPS = 5;
// What a `RET` costs, and so what a Stub costs unless the test sets its duration.
export const RET_NOPS = 3;
export const NOP_LIMIT_TAKES = "a whole number of NOPs, 0 or more";

/** Whether `value` can be a NOP limit; one that is not would never stop a Run. */
export function isNopLimit(value: unknown): value is number {
  return isWholeIn(value, 0, Number.POSITIVE_INFINITY);
}

// Each step a halted CPU takes: the NOP it executes internally until an interrupt.
const HALTED_NOPS = 1;

const CB = 0xcb;
const ED = 0xed;
const INDEX_PREFIXES = [0xdd, 0xfd];
// The core runs a chain of prefixes as one instruction. A DD or FD that another prefix follows
// does nothing but its opcode fetch.
const PREFIXES = [...INDEX_PREFIXES, ED];
const IGNORED_PREFIX_NOPS = 1;

const UNPREFIXED_NOPS: Entry[] = new Array(256);

function setIn(table: Entry[], nops: Entry, ...opcodes: number[]): void {
  for (const opcode of opcodes) {
    table[opcode] = nops;
  }
}

const setNops = (nops: Entry, ...opcodes: number[]) =>
  setIn(UNPREFIXED_NOPS, nops, ...opcodes);

const inRegisterField = (base: number, shift: number) =>
  REGISTER_CODES.map((r) => base | (r << shift));
const inPairField = (base: number) =>
  [0, 1, 2, 3].map((rr) => base | (rr << 4));
const inBits3To5 = (base: number) =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((n) => base | (n << 3));

// 8-bit load
for (const to of REGISTER_CODES) {
  setNops(1, ...inRegisterField(0x40 | (to << 3), 0)); // ld r,r'
}
setNops(2, ...inRegisterField(0x46, 3)); // ld r,(hl)
setNops(2, ...inRegisterField(0x70, 0)); // ld (hl),r
setNops(2, ...inRegisterField(0x06, 3)); // ld r,n
setNops(3, 0x36); // ld (hl),n
setNops(2, 0x0a, 0x1a, 0x02, 0x12); // ld a,(bc) ld a,(de) ld (bc),a ld (de),a
setNops(4, 0x3a, 0x32); // ld a,(nn) ld (nn),a

// 16-bit load
setNops(3, ...inPairField(0x01)); // ld rr,nn
setNops(5, 0x2a, 0x22); // ld hl,(nn) ld (nn),hl
setNops(2, 0xf9); // ld sp,hl
setNops(4, ...inPairField(0xc5)); // push qq
setNops(3, ...inPairField(0xc1)); // pop qq

// Exchange
setNops(1, 0xeb, 0x08, 0xd9); // ex de,hl  ex af,af'  exx
setNops(6, 0xe3); // ex (sp),hl

// 8-bit arithmetic and logical
setNops(1, ...inBits3To5(0x80).flatMap((op) => inRegisterField(op, 0))); // alu r
setNops(2, ...inBits3To5(0x86)); // alu (hl)
setNops(2, ...inBits3To5(0xc6)); // alu n
setNops(1, ...inRegisterField(0x04, 3), ...inRegisterField(0x05, 3)); // inc r  dec r
setNops(3, 0x34, 0x35); // inc (hl)  dec (hl)

// 16-bit arithmetic
setNops(3, ...inPairField(0x09)); // add hl,rr
setNops(2, ...inPairField(0x03), ...inPairField(0x0b)); // inc rr  dec rr

// General-purpose arithmetic and CPU control
// halt: the HALT itself; each step the CPU then stays halted is HALTED_NOPS.
setNops(1, 0x27, 0x2f, 0x3f, 0x37, 0x00, 0x76, 0xf3, 0xfb); // daa cpl ccf scf nop halt di ei

// Rotate
setNops(1, 0x07, 0x0f, 0x17, 0x1f); // rlca rrca rla rra

// Jump, call and return
setNops(3, 0xc3); // jp nn
setNops(1, 0xe9); // jp (hl)
setNops(3, 0x18); // jr n
setNops(CALL_NOPS, 0xcd); // call nn
setNops(4, ...inBits3To5(0xc7)); // rst p: 11 T-states, yet 4 NOPs (ADR 0002)
setNops(RET_NOPS, 0xc9); // ret

// The condition codes NZ Z NC C PO PE P M test, in pairs, these bits of F.
const CONDITION_FLAGS = [FLAG_BITS.z, FLAG_BITS.c, FLAG_BITS.pv, FLAG_BITS.s];

function setConditional(
  met: number,
  notMet: number,
  base: number,
  codes: readonly number[],
): void {
  for (const cc of codes) {
    const flag = CONDITION_FLAGS[cc >> 1] ?? 0;
    const whenSet = (cc & 1) === 1;
    setNops(
      { met, notMet, isMet: ({ f }) => ((f & flag) !== 0) === whenSet },
      base | (cc << 3),
    );
  }
}

const EVERY_CONDITION = [0, 1, 2, 3, 4, 5, 6, 7];
setConditional(3, 2, 0x20, [0, 1, 2, 3]); // jr cc,n
setConditional(3, 3, 0xc2, EVERY_CONDITION); // jp cc,nn
setConditional(5, 3, 0xc4, EVERY_CONDITION); // call cc,nn
setConditional(4, 2, 0xc0, EVERY_CONDITION); // ret cc
setNops({ met: 4, notMet: 3, isMet: ({ b }) => b !== 1 }, 0x10); // djnz n: not met when B reaches 0

// Input and output
setNops(3, 0xdb, 0xd3); // in a,(n)  out (n),a

// CB: rotate, shift, bit, res, set. Operand 6 is (hl).
const CB_NOPS: number[] = Array.from({ length: 256 }, (_, op) => {
  const isBit = op >> 6 === 1;
  if ((op & 7) !== 6) {
    return 2; // rlc r … srl r  bit b,r  res b,r  set b,r
  }
  return isBit ? 3 : 4; // bit b,(hl) : rlc (hl) … srl (hl)  res b,(hl)  set b,(hl)
});

// ED. Any opcode the core runs as a `NOP` is two opcode fetches of 4 T-states: 2 NOPs
// (Madram's rule; he gives no value).
const ED_NOPS: Entry[] = new Array(256).fill(2);

setIn(ED_NOPS, 4, ...inBits3To5(0x40), ...inBits3To5(0x41)); // in r,(c)  out (c),r, and (c),0
setIn(ED_NOPS, 4, ...inPairField(0x42), ...inPairField(0x4a)); // sbc hl,rr  adc hl,rr
setIn(ED_NOPS, 6, ...inPairField(0x43), ...inPairField(0x4b)); // ld (nn),rr  ld rr,(nn)
// neg, retn/reti, im: the undocumented copies take the time of the documented one.
setIn(ED_NOPS, 2, ...inBits3To5(0x44)); // neg
setIn(ED_NOPS, 4, ...inBits3To5(0x45)); // retn  reti
setIn(ED_NOPS, 2, ...inBits3To5(0x46)); // im 0  im 1  im 2
setIn(ED_NOPS, 3, 0x47, 0x4f, 0x57, 0x5f); // ld i,a  ld r,a  ld a,i  ld a,r
setIn(ED_NOPS, 5, 0x67, 0x6f); // rrd  rld
setIn(ED_NOPS, 5, 0xa0, 0xa8); // ldi  ldd
setIn(ED_NOPS, 4, 0xa1, 0xa9); // cpi  cpd
setIn(ED_NOPS, 5, 0xa2, 0xaa, 0xa3, 0xab); // ini  ind  outi  outd
// Repeated: the last iteration is the one that does not repeat.
setIn(ED_NOPS, { met: 6, notMet: 5, isMet: ({ bc }) => bc !== 1 }, 0xb0, 0xb8); // ldir  lddr
// cpir  cpdr
setIn(
  ED_NOPS,
  {
    met: 6,
    notMet: 4,
    isMet: ({ a, bc, hl }, memory) => bc !== 1 && memory[hl] !== a,
  },
  0xb1,
  0xb9,
);
// inir  indr  otir  otdr
setIn(
  ED_NOPS,
  { met: 6, notMet: 5, isMet: ({ b }) => b !== 1 },
  0xb2,
  0xba,
  0xb3,
  0xbb,
);

// Behind DD or FD: "DD or FD prefix without indirection (inc ixl) adds 4 t-states (1 NOP)".
const INDEXED_NOPS = UNPREFIXED_NOPS.map((entry) =>
  typeof entry === "number"
    ? entry + 1
    : { ...entry, met: entry.met + 1, notMet: entry.notMet + 1 },
);

// With indirection, (hl) becomes (ix+n).
setIn(INDEXED_NOPS, 5, ...inRegisterField(0x46, 3)); // ld r,(ix+n)
setIn(INDEXED_NOPS, 5, ...inRegisterField(0x70, 0)); // ld (ix+n),r
setIn(INDEXED_NOPS, 5, ...inBits3To5(0x86)); // alu (ix+n)
setIn(INDEXED_NOPS, 6, 0x34, 0x35); // inc (ix+n)  dec (ix+n)
// Missing from Madram's tables: by his rule, 4 4 3 5 3 T-states (Z80 user manual).
setIn(INDEXED_NOPS, 6, 0x36); // ld (ix+n),n

// DDCB, FDCB: bit b,(ix+n), and every other operation on (ix+n), with or without its copy to r.
const INDEXED_CB_NOPS: number[] = Array.from({ length: 256 }, (_, op) =>
  op >> 6 === 1 ? 6 : 7,
);

function byteAt(memory: Uint8Array, address: number): number {
  return memory[address & 0xffff] ?? 0;
}

function entryAt(memory: Uint8Array, pc: number): Entry | undefined {
  const op = byteAt(memory, pc);
  const next = byteAt(memory, pc + 1);
  if (op === CB) {
    return CB_NOPS[next];
  }
  if (op === ED) {
    return ED_NOPS[next];
  }
  if (INDEX_PREFIXES.includes(op)) {
    // DD CB n op: the displacement comes before the opcode.
    return next === CB
      ? INDEXED_CB_NOPS[byteAt(memory, pc + 3)]
      : INDEXED_NOPS[next];
  }
  return UNPREFIXED_NOPS[op];
}

/**
 * The CPC duration, in NOPs, of the next step from the state `before`: the instruction at PC,
 * or, if the CPU is `halted`, the `NOP` it executes internally. Every opcode has a count; undefined
 * would mean a gap in the tables, which the Run reports rather than count zero.
 */
export function nopsOf(
  memory: Uint8Array,
  before: Registers,
  halted: boolean,
): number | undefined {
  if (halted) {
    return HALTED_NOPS;
  }
  let pc = before.pc;
  let ignoredPrefixes = 0;
  while (
    INDEX_PREFIXES.includes(byteAt(memory, pc)) &&
    PREFIXES.includes(byteAt(memory, pc + 1))
  ) {
    ignoredPrefixes += 1;
    pc = (pc + 1) & 0xffff;
  }
  const entry = entryAt(memory, pc);
  if (entry === undefined) {
    return undefined;
  }
  const nops =
    typeof entry === "number"
      ? entry
      : entry.isMet(before, memory)
        ? entry.met
        : entry.notMet;
  return ignoredPrefixes * IGNORED_PREFIX_NOPS + nops;
}
