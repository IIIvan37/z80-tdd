; Sets the border to the hardware colour in A, through the Gate Array (#7Fxx).
set_border:
 ld bc,#7f10   ; pen 16: the border
 out (c),c
 or #40        ; the "set colour" command
 out (c),a
 ret
