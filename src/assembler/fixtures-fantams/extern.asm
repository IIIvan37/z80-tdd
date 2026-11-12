; The linker writes the address of INIT, from another object.
 extern init
 org #4000
start:
 call init
 ret
