 org #4000
start:
 ret

; Stored at #8000, assembled to run at #C000.
 org #c000,#8000
moved:
 ld a,(moved)
 ret
