// CPC durations from Madram / Overlanders, "Perfectly accurate Z80 flags and CPC timing"
// v1.0.6 (64NOPS blog). See ADR 0002 for why the tool owns this table.
import type { Registers } from "./cpu/index.ts";

/** The 3-bit register codes B C D E H L A; code 6, (HL), is left out. */
const REGISTER_CODES = [0, 1, 2, 3, 4, 5, 7];

/** A conditional instruction: its NOPs when its condition is met, and when it is not. */
interface Conditional {
  readonly met: number;
  readonly notMet: number;
  isMet(before: Registers): boolean;
}

export const CALL_NOPS = 5;
// Each step a halted CPU takes: the NOP it executes internally until an interrupt.
const HALTED_NOPS = 1;

const UNPREFIXED_NOPS: (number | Conditional)[] = new Array(256);

function setNops(nops: number | Conditional, ...opcodes: number[]): void {
  for (const opcode of opcodes) {
    UNPREFIXED_NOPS[opcode] = nops;
  }
}

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
setNops(3, 0xc9); // ret

// The condition codes NZ Z NC C PO PE P M test, in pairs, these bits of F.
const CONDITION_FLAGS = [0x40, 0x01, 0x04, 0x80];

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

/**
 * The CPC duration, in NOPs, of the next step from the state `before`: the instruction at PC,
 * or, if the CPU is `halted`, the NOP it executes internally. Undefined if the table has no count.
 */
export function nopsOf(
  memory: Uint8Array,
  before: Registers,
  halted: boolean,
): number | undefined {
  if (halted) {
    return HALTED_NOPS;
  }
  const entry = UNPREFIXED_NOPS[memory[before.pc] ?? 0];
  if (entry === undefined || typeof entry === "number") {
    return entry;
  }
  return entry.isMet(before) ? entry.met : entry.notMet;
}
