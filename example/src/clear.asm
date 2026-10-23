; Fills the 16 bytes of buffer with zeros.
clear_buffer:
 ld hl,buffer
 ld bc,16
.loop:
 ld (hl),0
 inc hl
 dec bc
 ld a,b
 or c
 jr nz,.loop
 ret

buffer:
 defs 16
