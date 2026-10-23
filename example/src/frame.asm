; One frame of the game: waits for the frame flyback, then turns the border red.
next_frame:
 call wait_vsync
 ld a,#0c      ; hardware colour: bright red
 call set_border
 ret
