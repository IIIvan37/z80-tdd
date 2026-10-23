TXT_OUTPUT equ #bb5a

; Prints the string at HL, ended by a zero byte, through the firmware.
print_string:
 ld a,(hl)
 or a
 ret z
 call TXT_OUTPUT
 inc hl
 jr print_string

message:
 defb "HI",0
