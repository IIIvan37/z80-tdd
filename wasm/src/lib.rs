//! The WebAssembly face of the cell80-z80 core, loaded by src/cpu/cell80.ts: one
//! instance holds one CPU, its 64 KB of memory, and the STATE slots the host reads and writes.

use std::ptr::addr_of_mut;

#[link(wasm_import_module = "env")]
extern "C" {
    fn io_in(port: u32) -> u32;
    fn io_out(port: u32, value: u32);
}

/// The slots of `STATE`, in the order of src/cpu/cell80.ts: the 16-bit registers
/// AF BC DE HL AF' BC' DE' HL' IX IY SP PC, then I, R, WZ, IM, IFF1, IFF2, Q, HALT.
const STATE_LENGTH: usize = 20;

static mut MEMORY: [u8; 0x10000] = [0; 0x10000];
static mut STATE: [u16; STATE_LENGTH] = [0; STATE_LENGTH];
static mut CPU: Option<z80::Cpu> = None;

fn cpu() -> &'static mut z80::Cpu {
    unsafe { (*addr_of_mut!(CPU)).get_or_insert_with(z80::Cpu::new) }
}

/// Memory and ports; `host_trap` keeps its default, so `ED FE` stays a no-op.
struct Bus;

impl z80::Bus for Bus {
    fn read(&mut self, address: u16) -> u8 {
        unsafe { (*addr_of_mut!(MEMORY))[address as usize] }
    }
    fn write(&mut self, address: u16, value: u8) {
        unsafe { (*addr_of_mut!(MEMORY))[address as usize] = value }
    }
    fn input(&mut self, port: u16) -> u8 {
        unsafe { io_in(port as u32) as u8 }
    }
    fn output(&mut self, port: u16, value: u8) {
        unsafe { io_out(port as u32, value as u32) }
    }
    fn contend(&mut self, _: u16, _: u32) {}
    fn tick(&mut self, _: u32) {}
}

fn pair(high: u8, low: u8) -> u16 {
    (high as u16) << 8 | low as u16
}

#[no_mangle]
pub extern "C" fn memory_ptr() -> *mut u8 {
    addr_of_mut!(MEMORY) as *mut u8
}

#[no_mangle]
pub extern "C" fn state_ptr() -> *mut u16 {
    addr_of_mut!(STATE) as *mut u16
}

#[no_mangle]
pub extern "C" fn read_state() {
    unsafe {
        let cpu = cpu();
        let r = &cpu.regs;
        *addr_of_mut!(STATE) = [
            pair(r.a, r.f),
            pair(r.b, r.c),
            pair(r.d, r.e),
            pair(r.h, r.l),
            pair(r.a_, r.f_),
            pair(r.b_, r.c_),
            pair(r.d_, r.e_),
            pair(r.h_, r.l_),
            r.ix,
            r.iy,
            r.sp,
            r.pc,
            r.i as u16,
            r.r as u16,
            r.wz,
            cpu.im as u16,
            cpu.iff1 as u16,
            cpu.iff2 as u16,
            cpu.q as u16,
            cpu.halted as u16,
        ];
    }
}

#[no_mangle]
pub extern "C" fn write_state() {
    unsafe {
        let s = *addr_of_mut!(STATE);
        let cpu = cpu();
        let r = &mut cpu.regs;
        [r.a, r.f] = s[0].to_be_bytes();
        [r.b, r.c] = s[1].to_be_bytes();
        [r.d, r.e] = s[2].to_be_bytes();
        [r.h, r.l] = s[3].to_be_bytes();
        [r.a_, r.f_] = s[4].to_be_bytes();
        [r.b_, r.c_] = s[5].to_be_bytes();
        [r.d_, r.e_] = s[6].to_be_bytes();
        [r.h_, r.l_] = s[7].to_be_bytes();
        r.ix = s[8];
        r.iy = s[9];
        r.sp = s[10];
        r.pc = s[11];
        r.i = s[12] as u8;
        r.r = s[13] as u8;
        r.wz = s[14];
        cpu.im = s[15] as u8;
        cpu.iff1 = s[16] != 0;
        cpu.iff2 = s[17] != 0;
        cpu.q = s[18] as u8;
        cpu.halted = s[19] != 0;
    }
}

#[no_mangle]
pub extern "C" fn step() {
    cpu().step(&mut Bus)
}
