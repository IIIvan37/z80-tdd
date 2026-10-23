; clear_buffer without its "dec bc": the loop never ends.
; failure-report.test.ts runs it to show a failure report.
clear_buffer_buggy:
 ld hl,buffer
 ld bc,16
.loop:
 ld (hl),0
 inc hl
 ld a,b
 or c
 jr nz,.loop
 ret
