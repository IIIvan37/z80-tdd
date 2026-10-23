import { readFileSync } from "node:fs";
import {
  BYTE_REGISTERS,
  type Cpu,
  type Internals,
  type Ports,
  type Registers,
  WORD_REGISTERS,
} from "./cpu.ts";

// Node has WebAssembly, but @types/node does not declare it and lib "dom" would
// bring every browser global; these are the parts this file uses.
declare global {
  namespace WebAssembly {
    class Module {
      constructor(bytes: Uint8Array);
    }
    class Instance {
      constructor(module: Module, imports: Record<string, object>);
      readonly exports: Record<string, unknown>;
    }
    class Memory {
      readonly buffer: ArrayBuffer;
    }
  }
}

// Built from wasm/ by `pnpm build:wasm`; see ADR 0004.
const CELL80 = new WebAssembly.Module(
  readFileSync(new URL("./cell80.wasm", import.meta.url)),
);

interface Exports {
  readonly memory: WebAssembly.Memory;
  memory_ptr(): number;
  state_ptr(): number;
  read_state(): void;
  write_state(): void;
  step(): void;
}

// The layout of STATE in wasm/src/lib.rs: the 16-bit registers in WORD_REGISTERS
// order, then the slots of SLOT_OF.
const STATE_LENGTH = 20;
const SLOT_OF = {
  i: 12,
  r: 13,
  wz: 14,
  im: 15,
  iff1: 16,
  iff2: 17,
  q: 18,
  halted: 19,
} as const;

type WordRegister = (typeof WORD_REGISTERS)[number];
type ByteRegister = (typeof BYTE_REGISTERS)[number];

const high = (pair: WordRegister) => [WORD_REGISTERS.indexOf(pair), 8] as const;
const low = (pair: WordRegister) => [WORD_REGISTERS.indexOf(pair), 0] as const;

/** Where each 8-bit register lives: its slot and its shift within the slot. */
const BYTE_SLOTS: Readonly<Record<ByteRegister, readonly [number, number]>> = {
  a: high("af"),
  f: low("af"),
  b: high("bc"),
  c: low("bc"),
  d: high("de"),
  e: low("de"),
  h: high("hl"),
  l: low("hl"),
  ixh: high("ix"),
  ixl: low("ix"),
  iyh: high("iy"),
  iyl: low("iy"),
  i: [SLOT_OF.i, 0],
  r: [SLOT_OF.r, 0],
};

const NO_PORTS: Ports = { read: () => 0xff, write: () => {} };

/** A Cpu backed by the cell80-z80 core compiled to WebAssembly, with its own 64 KB of memory. */
export function createCpu(ports: Ports = NO_PORTS): Cpu {
  const instance = new WebAssembly.Instance(CELL80, {
    env: {
      io_in: (port: number) => ports.read(port) & 0xff,
      io_out: (port: number, value: number) => ports.write(port, value),
    },
  });
  const wasm = instance.exports as unknown as Exports;
  const memory = new Uint8Array(wasm.memory.buffer, wasm.memory_ptr(), 0x10000);
  const state = new Uint16Array(
    wasm.memory.buffer,
    wasm.state_ptr(),
    STATE_LENGTH,
  );

  const refreshState = (): Uint16Array => {
    wasm.read_state();
    return state;
  };

  return {
    memory,
    registers: () => {
      const slots = refreshState();
      const words = WORD_REGISTERS.map((name, slot) => [name, slots[slot]]);
      const bytes = BYTE_REGISTERS.map((name) => {
        const [slot, shift] = BYTE_SLOTS[name];
        return [name, ((slots[slot] ?? 0) >> shift) & 0xff];
      });
      return Object.fromEntries([...words, ...bytes]) as Registers;
    },
    setRegisters: (values) => {
      const slots = refreshState();
      for (const [slot, name] of WORD_REGISTERS.entries()) {
        const value = values[name];
        if (value !== undefined) {
          slots[slot] = value;
        }
      }
      for (const name of BYTE_REGISTERS) {
        const value = values[name];
        if (value !== undefined) {
          const [slot, shift] = BYTE_SLOTS[name];
          slots[slot] =
            ((slots[slot] ?? 0) & ~(0xff << shift)) | ((value & 0xff) << shift);
        }
      }
      wasm.write_state();
    },
    internals: () => {
      const slots = refreshState();
      return {
        wz: slots[SLOT_OF.wz] ?? 0,
        iff1: slots[SLOT_OF.iff1] !== 0,
        iff2: slots[SLOT_OF.iff2] !== 0,
        im: slots[SLOT_OF.im] ?? 0,
        q: slots[SLOT_OF.q] ?? 0,
        halted: slots[SLOT_OF.halted] !== 0,
      };
    },
    setInternals: (values: Partial<Internals>) => {
      const slots = refreshState();
      for (const [name, value] of Object.entries(values)) {
        slots[SLOT_OF[name as keyof Internals]] = Number(value);
      }
      wasm.write_state();
    },
    step: () => wasm.step(),
  };
}
