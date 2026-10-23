import { type Hal, Z80 } from "z80-emulator";
import type { Cpu, Registers } from "./cpu.ts";

const PAIRS = new Set([
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
]);

/** A Cpu backed by the z80-emulator core, executing from and into `memory` (64 KB). */
export function createCpu(memory: Uint8Array): Cpu {
  const hal: Hal = {
    tStateCount: 0,
    readMemory: (address) => memory[address] ?? 0,
    writeMemory: (address, value) => {
      memory[address] = value;
    },
    contendMemory: () => {},
    readPort: () => 0xff,
    writePort: () => {},
    contendPort: () => {},
  };
  const z80 = new Z80(hal);
  const regs = z80.regs;

  return {
    registers: () => ({
      a: regs.a,
      f: regs.f,
      b: regs.b,
      c: regs.c,
      d: regs.d,
      e: regs.e,
      h: regs.h,
      l: regs.l,
      af: regs.af,
      bc: regs.bc,
      de: regs.de,
      hl: regs.hl,
      afPrime: regs.afPrime,
      bcPrime: regs.bcPrime,
      dePrime: regs.dePrime,
      hlPrime: regs.hlPrime,
      ix: regs.ix,
      iy: regs.iy,
      ixh: regs.ixh,
      ixl: regs.ixl,
      iyh: regs.iyh,
      iyl: regs.iyl,
      sp: regs.sp,
      pc: regs.pc,
      i: regs.i,
      // z80-base keeps bit 7 of R apart (r7), and its rCombined masks with 0xF7 instead of 0x7F.
      r: (regs.r7 & 0x80) | (regs.r & 0x7f),
    }),
    setRegisters: (values) => {
      const entries = Object.entries(values) as [keyof Registers, number][];
      const ordered = [
        ...entries.filter(([name]) => PAIRS.has(name)),
        ...entries.filter(([name]) => !PAIRS.has(name)),
      ];
      for (const [name, value] of ordered) {
        if (name === "r") {
          regs.r = value & 0x7f;
          regs.r7 = value & 0x80;
        } else {
          regs[name] = value;
        }
      }
    },
    step: () => z80.step(),
  };
}
