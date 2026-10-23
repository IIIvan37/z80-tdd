import { type Hal, Z80 } from "z80-emulator";
import {
  BYTE_REGISTERS,
  type Cpu,
  type RegisterName,
  type Registers,
  WORD_REGISTERS,
} from "./cpu.ts";

const ALL_REGISTERS = [...WORD_REGISTERS, ...BYTE_REGISTERS];

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

  const read = (name: RegisterName): number =>
    // z80-base keeps bit 7 of R apart (r7), and its rCombined masks with 0xF7 instead of 0x7F.
    name === "r" ? (regs.r7 & 0x80) | (regs.r & 0x7f) : regs[name];

  const write = (name: RegisterName, value: number): void => {
    if (name === "r") {
      regs.r = value & 0x7f;
      regs.r7 = value & 0x80;
    } else {
      regs[name] = value;
    }
  };

  return {
    registers: () =>
      Object.fromEntries(
        ALL_REGISTERS.map((name) => [name, read(name)]),
      ) as Registers,
    setRegisters: (values) => {
      for (const name of ALL_REGISTERS) {
        const value = values[name];
        if (value !== undefined) {
          write(name, value);
        }
      }
    },
    step: () => z80.step(),
  };
}
