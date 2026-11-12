; An uninit section reserves its bytes without writing them.
section bss, "uninit"
 org #9000
buffer:
 ds 4
