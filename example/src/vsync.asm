; Waits for the frame flyback: bit 0 of PPI port B (#F5xx) is set during the VSYNC.
wait_vsync:
 ld b,#f5
.wait:
 in a,(c)
 rra
 jr nc,.wait
 ret
