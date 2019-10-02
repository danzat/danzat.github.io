---
layout: post
title:  "Blackbox"
subtitle: "Level 8"
date:   2012-01-28
categories: reverse-engineering
---

_As in the previous posts, the password for the next level has been replaced with question marks so as to not make this too obvious, and so that the point of the walkthrough, which is mainly educational, will not be missed._

Also, make sure you notice this SPOILER ALERT! If you want to try and solve the level by yourself then read no further!

Let's see what level 8 holds in store:

```
$ ssh -p 2225 level8@blackbox.smashthestack.org
level8@blackbox.smashthestack.org's password:
...
level8@blackbox:~$ ls -l
total 16
-rw-r--r-- 1 root   root      10 2008-01-24 05:58 password
-rws--x--x 1 level9 level9 12254 2007-12-29 14:10 secrets
```

Wait a minute here, what's that? We only have execution permissions for secrets.

How can we analyze it if we can't even read it?

Well, there is a way, using `ptrace` sorcery. I won't go into too much depth here, so I recommend you read Playing with [ptrace, Part I](http://www.linuxjournal.com/article/6100) (I'd also recommend you read [part II](http://www.linuxjournal.com/node/6210), just for general knowledge).

Anyway, to summarize these articles, the way debuggers work is by `fork`-ing, invoking `ptrace` with `PTRACE_TRACEME` in the child, and then executing the to-be-traced process. The parent process can then control the child process and read its status using other `ptrace` calls.

So let's write a little program that does just that, and reads the memory contents of the child process where the child process will be secrets, this is how we can cheat the permission mechanism.

```c
#include <stdio.h>
#include <stdlib.h>
#include <sys/user.h>
#include <sys/ptrace.h>
#include <unistd.h>

int main(int argc, char *argv[])
{
    int pid;
    char *prog[] = {"/home/level8/secrets", NULL};
    long addr;
    long size;
    int i = 0;
    int val;
    struct user_regs_struct regs;
    if (argc != 3) {
        printf("Usage: %s <address> <number of long words>\n", argv[0]);
        return 1;
    }
    addr = strtoul(argv[1], NULL, 16);
    size = strtoul(argv[2], NULL, 10);
    pid = fork();
    if (0 == pid) {
        ptrace(PTRACE_TRACEME, 0, NULL, NULL);
        execve(prog[0], prog, NULL);
    } else {
        wait(NULL);
        for (i = 0; i < size; ++i) {
            val = ptrace(PTRACE_PEEKTEXT, pid, addr + 4*i, NULL);
            printf("%02x", val & 0xFF);
            printf("%02x", (val >> 8) & 0xFF);
            printf("%02x", (val >> 16) & 0xFF);
            printf("%02x", (val >> 24) & 0xFF);
        }
        printf("\n");
        ptrace(PTRACE_KILL, pid, NULL, NULL);
    }
    return 0;
}
```

As you can see, the child just invokes `ptrace` with `PTRACE_TRACEME` and executes the level's program.

The parents `wait`-s for the child to stop, and then reads the specified amount of long words from the specified address, prints them out encoded as a hex string, and then kills the child.

Let's try out our new toy, but which address interests us? Well, the function `main` commonly starts at `0x08048464`, as for the number of bytes we read, let's read some large amount, I'm sure `main` isn't too long:

```
level8@blackbox:/tmp$ ./wrap 0x08048464 200
5589e55381ec3404000083e4f0b80000000029c4c745f464870408c7042475870408e8cdfeffff8945f0c
785e4fbffff000000008b45f0890424e8c5feffff483985e4fbffff734781bde4fbfffffb0300007602eb
398d85e8fbffff89c3039de4fbffff8b85e4fbffff0345f08d48018b85e4fbffff0345f00fb6100fb6012
8d0045a88038d85e4fbffffff00eba58d85e8fbffff89c20395e4fbffff8b85e4fbffff0345f00fb600c0
f804240f042188028d85e9fbffff89c20395e4fbffff8b85e4fbffff0345f00fb600240f042188028d85e
afbffff0385e4fbffffc60000c785e4fbffff000000008d85e8fbffff890424e80bfeffff483985e4fbff
ff7205e99b0000008d85e8fbffff89c1038de4fbffff8d85e8fbffff89c20395e4fbffff8d85e9fbffff0
385e4fbffff0fb600320288018d85e9fbffff89c1038de4fbffff8d85e9fbffff89c20395e4fbffff8d85
e8fbffff0385e4fbffff0fb600320288018d85e8fbffff89c1038de4fbffff8d85e8fbffff89c20395e4f
bffff8d85e9fbffff0385e4fbffff0fb600320288018d85e4fbffff830002e949ffffff8d95e8fbffff8b
45f489442404891424e81dfdffff85c0751ac7042492870408e85dfdffffc704249b870408e811fdffffe
b0cc70424a3870408e843fdffffb8000000008b5dfcc9c3905589e5575631f65383ec0ce8a000000081c3
44120000e8a5fcffff8d9314ffffff8d8314ffffff29c2c1fa0239d6731c89d78db426000000008dbc270
0000000ff94b314ffffff4639fe72f483c40c5b5e5f5dc38db6000000008dbf000000005589e583ec0889
1c24e84200000081c3e6110000897424048d8314ffffff8d9314ffffff29d0c1f80285c08d70ff7510e85
b0000008b1c248b74240489ec5dc3ff94b314ffffff89f04e85c075f2ebe08b1c24c39090909090909090
909090905589e55383ec04bb90980408a19098040883f8ff74168d76008dbc270000000083eb04ffd08b0
383f8ff75f4585b5dc35589e553e8000000005b81c35b11000052e89afcffff8b5dfcc9c3000300000001
000200555b5b5a526357666358564d246c222300506c6561736520656e74657220796f
```

Now, to disassemble this I will use `nasm` which is not installed on the blackbox server. First I'll decode the hex string into a binary file which I will call `main.bin`, and then I will disassemble it at the base address of `main`:

```
~$ ndisasm -u -o 0x08048464 main.bin |cat -n|grep ret
   124 0804864E  C3                ret
   154 080486A3  C3                ret
   176 080486EF  C3                ret
   184 08048703  C3                ret
   215 0804873F  C3                ret
   226 0804875A  C3                ret
~$ ndisasm -u -o 0x08048464 main.bin | head -n 124
08048464  55                push ebp
08048465  89E5              mov ebp,esp
08048467  53                push ebx
08048468  81EC34040000      sub esp,0x434
0804846E  83E4F0            and esp,byte -0x10
08048471  B800000000        mov eax,0x0
08048476  29C4              sub esp,eax
08048478  C745F464870408    mov dword [ebp-0xc],0x8048764
0804847F  C7042475870408    mov dword [esp],0x8048775
08048486  E8CDFEFFFF        call dword 0x8048358
0804848B  8945F0            mov [ebp-0x10],eax
0804848E  C785E4FBFFFF0000  mov dword [ebp-0x41c],0x0
         -0000
08048498  8B45F0            mov eax,[ebp-0x10]
0804849B  890424            mov [esp],eax
0804849E  E8C5FEFFFF        call dword 0x8048368
080484A3  48                dec eax
080484A4  3985E4FBFFFF      cmp [ebp-0x41c],eax
080484AA  7347              jnc 0x80484f3
080484AC  81BDE4FBFFFFFB03  cmp dword [ebp-0x41c],0x3fb
         -0000
080484B6  7602              jna 0x80484ba
080484B8  EB39              jmp short 0x80484f3
080484BA  8D85E8FBFFFF      lea eax,[ebp-0x418]
080484C0  89C3              mov ebx,eax
080484C2  039DE4FBFFFF      add ebx,[ebp-0x41c]
080484C8  8B85E4FBFFFF      mov eax,[ebp-0x41c]
080484CE  0345F0            add eax,[ebp-0x10]
080484D1  8D4801            lea ecx,[eax+0x1]
080484D4  8B85E4FBFFFF      mov eax,[ebp-0x41c]
080484DA  0345F0            add eax,[ebp-0x10]
080484DD  0FB610            movzx edx,byte [eax]
080484E0  0FB601            movzx eax,byte [ecx]
080484E3  28D0              sub al,dl
080484E5  045A              add al,0x5a
080484E7  8803              mov [ebx],al
080484E9  8D85E4FBFFFF      lea eax,[ebp-0x41c]
080484EF  FF00              inc dword [eax]
080484F1  EBA5              jmp short 0x8048498
080484F3  8D85E8FBFFFF      lea eax,[ebp-0x418]
080484F9  89C2              mov edx,eax
080484FB  0395E4FBFFFF      add edx,[ebp-0x41c]
08048501  8B85E4FBFFFF      mov eax,[ebp-0x41c]
08048507  0345F0            add eax,[ebp-0x10]
0804850A  0FB600            movzx eax,byte [eax]
0804850D  C0F804            sar al,0x4
08048510  240F              and al,0xf
08048512  0421              add al,0x21
08048514  8802              mov [edx],al
08048516  8D85E9FBFFFF      lea eax,[ebp-0x417]
0804851C  89C2              mov edx,eax
0804851E  0395E4FBFFFF      add edx,[ebp-0x41c]
08048524  8B85E4FBFFFF      mov eax,[ebp-0x41c]
0804852A  0345F0            add eax,[ebp-0x10]
0804852D  0FB600            movzx eax,byte [eax]
08048530  240F              and al,0xf
08048532  0421              add al,0x21
08048534  8802              mov [edx],al
08048536  8D85EAFBFFFF      lea eax,[ebp-0x416]
0804853C  0385E4FBFFFF      add eax,[ebp-0x41c]
08048542  C60000            mov byte [eax],0x0
08048545  C785E4FBFFFF0000  mov dword [ebp-0x41c],0x0
         -0000
0804854F  8D85E8FBFFFF      lea eax,[ebp-0x418]
08048555  890424            mov [esp],eax
08048558  E80BFEFFFF        call dword 0x8048368
0804855D  48                dec eax
0804855E  3985E4FBFFFF      cmp [ebp-0x41c],eax
08048564  7205              jc 0x804856b
08048566  E99B000000        jmp dword 0x8048606
0804856B  8D85E8FBFFFF      lea eax,[ebp-0x418]
08048571  89C1              mov ecx,eax
08048573  038DE4FBFFFF      add ecx,[ebp-0x41c]
08048579  8D85E8FBFFFF      lea eax,[ebp-0x418]
0804857F  89C2              mov edx,eax
08048581  0395E4FBFFFF      add edx,[ebp-0x41c]
08048587  8D85E9FBFFFF      lea eax,[ebp-0x417]
0804858D  0385E4FBFFFF      add eax,[ebp-0x41c]
08048593  0FB600            movzx eax,byte [eax]
08048596  3202              xor al,[edx]
08048598  8801              mov [ecx],al
0804859A  8D85E9FBFFFF      lea eax,[ebp-0x417]
080485A0  89C1              mov ecx,eax
080485A2  038DE4FBFFFF      add ecx,[ebp-0x41c]
080485A8  8D85E9FBFFFF      lea eax,[ebp-0x417]
080485AE  89C2              mov edx,eax
080485B0  0395E4FBFFFF      add edx,[ebp-0x41c]
080485B6  8D85E8FBFFFF      lea eax,[ebp-0x418]
080485BC  0385E4FBFFFF      add eax,[ebp-0x41c]
080485C2  0FB600            movzx eax,byte [eax]
080485C5  3202              xor al,[edx]
080485C7  8801              mov [ecx],al
080485C9  8D85E8FBFFFF      lea eax,[ebp-0x418]
080485CF  89C1              mov ecx,eax
080485D1  038DE4FBFFFF      add ecx,[ebp-0x41c]
080485D7  8D85E8FBFFFF      lea eax,[ebp-0x418]
080485DD  89C2              mov edx,eax
080485DF  0395E4FBFFFF      add edx,[ebp-0x41c]
080485E5  8D85E9FBFFFF      lea eax,[ebp-0x417]
080485EB  0385E4FBFFFF      add eax,[ebp-0x41c]
080485F1  0FB600            movzx eax,byte [eax]
080485F4  3202              xor al,[edx]
080485F6  8801              mov [ecx],al
080485F8  8D85E4FBFFFF      lea eax,[ebp-0x41c]
080485FE  830002            add dword [eax],byte +0x2
08048601  E949FFFFFF        jmp dword 0x804854f
08048606  8D95E8FBFFFF      lea edx,[ebp-0x418]
0804860C  8B45F4            mov eax,[ebp-0xc]
0804860F  89442404          mov [esp+0x4],eax
08048613  891424            mov [esp],edx
08048616  E81DFDFFFF        call dword 0x8048338
0804861B  85C0              test eax,eax
0804861D  751A              jnz 0x8048639
0804861F  C7042492870408    mov dword [esp],0x8048792
08048626  E85DFDFFFF        call dword 0x8048388
0804862B  C704249B870408    mov dword [esp],0x804879b
08048632  E811FDFFFF        call dword 0x8048348
08048637  EB0C              jmp short 0x8048645
08048639  C70424A3870408    mov dword [esp],0x80487a3
08048640  E843FDFFFF        call dword 0x8048388
08048645  B800000000        mov eax,0x0
0804864A  8B5DFC            mov ebx,[ebp-0x4]
0804864D  C9                leave
0804864E  C3                ret
```

I hope you don't mind that we switched from the GAS syntax to the Intel syntax, but it's good to learn to read both.

Anyway, since we disassembled raw code, we don't have any symbolic information, so we are going to have have to guess function based on context. So let's start:

```
08048478  C745F464870408    mov dword [ebp-0xc],0x8048764
```

This loads the local variable at `ebp-0xc` with some constant which looks like an address in the data section. Let's use our tool again to read what's in that address.

```
level8@blackbox:/tmp$ ./wrap 0x08048764 10
555b5b5a526357666358564d246c222300506c6561736520656e74657220796f7572207061737377
```

See the `00` there? I suspect it is a string terminator, let's see what that string is:

```
level8@blackbox:/tmp$ python -c "print '%r' % '555b5b5a526357666358564d246c\
2223'.decode('hex')"
'U[[ZRcWfcXVM$l"#'
```

Odd string...seems like gibberish, we'll give `ebp-0xc` the name `gibberish` then. Let's continue, it might make more sense later:

```
0804847F  C7042475870408    mov dword [esp],0x8048775
08048486  E8CDFEFFFF        call dword 0x8048358
0804848B  8945F0            mov [ebp-0x10],eax
```

This is a function call with one parameter, which also looks like an address in the data section:

```
level8@blackbox:/tmp$ ./wrap 0x08048775 10
506c6561736520656e74657220796f75722070617373776f72643a200057656c636f6d650a002f62
Again, I spot another string terminator, so let's decode the string:
level8@blackbox:/tmp$ python -c "print '%r' % '506c6561736520656e7465722079\
6f75722070617373776f72643a20'.decode('hex')"
'Please enter your password: '
```

Aha, a prompt. It also looks like the return value is stored in the stack at `ebp-0x10`. This means that this is not some regular `printf` or `puts`.

```
0804848E  C785E4FBFFFF0000  mov dword [ebp-0x41c],0x0
         -0000
```

That's some sort of initialization of a variable at `ebp-0x41c`.

```
08048498  8B45F0            mov eax,[ebp-0x10]
0804849B  890424            mov [esp],eax
0804849E  E8C5FEFFFF        call dword 0x8048368
080484A3  48                dec eax
080484A4  3985E4FBFFFF      cmp [ebp-0x41c],eax
080484AA  7347              jnc 0x80484f3
```

This executes a mystery function on whatever was stored in `ebp-0x10` (the return from that prompt function), subtracts 1 from the return value and compares the result to the variable at `ebp-0x41c`. Sort of like this:

```c
if (var_41c >= (func(var_10) - 1)) goto 0x80484f3;
```

Let's call that address `label1` from now on, in case we see it again.

```
080484AC  81BDE4FBFFFFFB03  cmp dword [ebp-0x41c],0x3fb
         -0000
080484B6  7602              jna 0x80484ba
080484B8  EB39              jmp short 0x80484f3
```

This compares `var_41c` to the constant `0x3fb`, and jumps to some new location, or to `label1` if the test fails. Equivalent C code:

```c
if (var_41c <= 0x3fb)
    goto 0x80484f3;
else
    goto label1;
```

Let's call the new address `label2`.

For the next piece of code, notice it starts at `label2`, I'll just annotate it:

```
label2:
080484BA  8D85E8FBFFFF      lea eax,[ebp-0x418]
080484C0  89C3              mov ebx,eax
080484C2  039DE4FBFFFF      add ebx,[ebp-0x41c]
080484C8  8B85E4FBFFFF      mov eax,[ebp-0x41c]
080484CE  0345F0            add eax,[ebp-0x10]
080484D1  8D4801            lea ecx,[eax+0x1]
080484D4  8B85E4FBFFFF      mov eax,[ebp-0x41c]
080484DA  0345F0            add eax,[ebp-0x10]
080484DD  0FB610            movzx edx,byte [eax]
080484E0  0FB601            movzx eax,byte [ecx]
080484E3  28D0              sub al,dl
080484E5  045A              add al,0x5a
080484E7  8803              mov [ebx],al
080484E9  8D85E4FBFFFF      lea eax,[ebp-0x41c]
080484EF  FF00              inc dword [eax]
080484F1  EBA5              jmp short 0x8048498
```

What happens here is this, and you can verify it yourself:

```c
var_418[var_41c] = var_10[var_41c + 1] - var_10[var_41c] + 0x5a;
var_41c++;
```

This tells us several things:
* `var_41c` is some sort of index, from now on we will call it `idx`.
* `var_418` is some temporary buffer in the stack, we'll call it `buf`.
* `var_10`, which was returned from the prompt function, is a pointer to some input, most probably the user input, and the the prompt function is a prompt-and-read function. We will call it `input`.

At the end of that section, there's a jump to `0x8048498` which we will call `label3`. We've already been there, it's the piece that contained the mystery function. Let's rewrite it, but with more meaningful names and see if it sheds some new light:

```c
if (idx >= (func(input) - 1))
    goto label1;
else if
    (idx <= 0x3fb) goto label2;
else
    goto label1;
```

I think we can spots what's happening here, mystery function func is actually `strlen`, and this is part of a `while` statement:

```c
while ((idx < strlen(input)) && (idx <= 0x3fb)) {
    buf[idx] = input[idx + 1] - input[idx] + 0x5a;
    idx++;
}
/* do label1 stuff */
```

OK, let's see what happens at `label1` (I'm going to start annotating the code with variable names):

```
label1:
080484F3  8D85E8FBFFFF      lea eax,[buf]
080484F9  89C2              mov edx,eax
080484FB  0395E4FBFFFF      add edx,[idx]
08048501  8B85E4FBFFFF      mov eax,[idx]
08048507  0345F0            add eax,[input]
0804850A  0FB600            movzx eax,byte [eax]
0804850D  C0F804            sar al,0x4
08048510  240F              and al,0xf
08048512  0421              add al,0x21
08048514  8802              mov [edx],al
```

This translates to:

```c
buf[idx] = 0x21 + (input[idx] >> 4) & 0xf;
```

The next chunk:

```
08048516  8D85E9FBFFFF      lea eax,[buf+1]
0804851C  89C2              mov edx,eax
0804851E  0395E4FBFFFF      add edx,[idx]
08048524  8B85E4FBFFFF      mov eax,[idx]
0804852A  0345F0            add eax,[input]
0804852D  0FB600            movzx eax,byte [eax]
08048530  240F              and al,0xf
08048532  0421              add al,0x21
08048534  8802              mov [edx],al
```

Which translates to:

```c
buf[idx + 1] = 0x21 + input[idx] & 0xf;
```

Next we have:

```
08048536  8D85EAFBFFFF      lea eax,[buf+2]
0804853C  0385E4FBFFFF      add eax,[idx]
08048542  C60000            mov byte [eax],0x0
08048545  C785E4FBFFFF0000  mov dword [idx],0x0
         -0000
```

This is equivalent to:

```c
buf[idx + 2] = 0;
idx = 0;
```

This looks like something string-like was terminated, and the index was reset, probably for a second pass. Let's see what happens next:

```
0804854F  8D85E8FBFFFF      lea eax,[buf]
08048555  890424            mov [esp],eax
08048558  E80BFEFFFF        call dword 0x8048368 [strlen]
0804855D  48                dec eax
0804855E  3985E4FBFFFF      cmp [idx],eax
08048564  7205              jc 0x804856b [label4]
08048566  E99B000000        jmp dword 0x8048606 [label5]
```

Translated to C:

```c
if (idx < strlen(buf) - 1)
    goto label4;
else
    goto label5;
```

The next piece of code starts at `label4`, and has a repeating pattern, so I'll paste it all at once:

```
label4:
0804856B  8D85E8FBFFFF      lea eax,[buf]
08048571  89C1              mov ecx,eax
08048573  038DE4FBFFFF      add ecx,[idx]
08048579  8D85E8FBFFFF      lea eax,[buf]
0804857F  89C2              mov edx,eax
08048581  0395E4FBFFFF      add edx,[idx]
08048587  8D85E9FBFFFF      lea eax,[buf+1]
0804858D  0385E4FBFFFF      add eax,[idx]
08048593  0FB600            movzx eax,byte [eax]
08048596  3202              xor al,[edx]
08048598  8801              mov [ecx],al
0804859A  8D85E9FBFFFF      lea eax,[buf+1]
080485A0  89C1              mov ecx,eax
080485A2  038DE4FBFFFF      add ecx,[idx]
080485A8  8D85E9FBFFFF      lea eax,[buf+1]
080485AE  89C2              mov edx,eax
080485B0  0395E4FBFFFF      add edx,[idx]
080485B6  8D85E8FBFFFF      lea eax,[buf]
080485BC  0385E4FBFFFF      add eax,[idx]
080485C2  0FB600            movzx eax,byte [eax]
080485C5  3202              xor al,[edx]
080485C7  8801              mov [ecx],al
080485C9  8D85E8FBFFFF      lea eax,[buf]
080485CF  89C1              mov ecx,eax
080485D1  038DE4FBFFFF      add ecx,[idx]
080485D7  8D85E8FBFFFF      lea eax,[buf]
080485DD  89C2              mov edx,eax
080485DF  0395E4FBFFFF      add edx,[idx]
080485E5  8D85E9FBFFFF      lea eax,[buf+1]
080485EB  0385E4FBFFFF      add eax,[idx]
080485F1  0FB600            movzx eax,byte [eax]
080485F4  3202              xor al,[edx]
080485F6  8801              mov [ecx],al
```

Which is:

```c
buf[idx] = buf[idx] ^ buf[idx + 1];
buf[idx + 1] = buf[idx] ^ buf[idx + 1];
buf[idx] = buf[idx] ^ buf[idx + 1];
```

That's just the code for swapping bytes.

Next we have:

```
080485F8  8D85E4FBFFFF      lea eax,[idx]
080485FE  830002            add dword [eax],byte +0x2
08048601  E949FFFFFF        jmp dword 0x804854f
```

Which increments the index by 2 and then jumps back to the index comparison, which makes it look like another loop:

```c
for (idx = 0; i < strlen(buf) - 1; i += 2) {
    buf[idx] = buf[idx] ^ buf[idx + 1];
    buf[idx + 1] = buf[idx] ^ buf[idx + 1];
    buf[idx] = buf[idx] ^ buf[idx + 1];
}
```

Next is the code that gets executed when the loop is exhausted:

```
label5:
08048606  8D95E8FBFFFF      lea edx,[buf]
0804860C  8B45F4            mov eax,[gibberish]
0804860F  89442404          mov [esp+0x4],eax
08048613  891424            mov [esp],edx
08048616  E81DFDFFFF        call dword 0x8048338
0804861B  85C0              test eax,eax
0804861D  751A              jnz 0x8048639
```

I think by this time you figured out what's happening here, `gibberish` is a password hash, and the the program did so far is to hash the input password, and this is where they get compared.
I won't continue analyzing the code anymore, because that's enough. Let's combine all the little pieces of C code and see what we can do:

```c
while ((idx < strlen(input)) && (idx <= 0x3fb)) {
    buf[idx] = input[idx + 1] - input[idx] + 0x5a;
    idx++;
}

buf[idx] = 0x21 + (input[idx] >> 4) & 0xf;
buf[idx + 1] = 0x21 + input[idx] & 0xf;
buf[idx + 2] = 0;

for (idx = 0; i < strlen(buf) - 1; i += 2) {
    buf[idx] = buf[idx] ^ buf[idx + 1];
    buf[idx + 1] = buf[idx] ^ buf[idx + 1];
    buf[idx] = buf[idx] ^ buf[idx + 1];
}
```

Well, we know the hash, and we know the hashed password. We can now perform an inverse hash and obtain the original password.

That should be easy, working backwards:

* Unswap every two consecutive bytes in the hash.
* Take the last two bytes, subtract `0x21` from them, and recombine them to a single byte, one being the high nibble, and the other the low nibble. Now we know `input[N]`.
* Reversing the formula for `buf` inside the while we can obtain a regression formula for the `input`: `input[i] = input[i + 1] - buf[i] + 0x5a`.

I think I'll leave it to you to write a script and obtain the password yourselves.

Let's check check if it works:

```
level8@blackbox:~$ ./secrets
Please enter your password: 
Welcome
sh-3.1$
```

Just one last level to go ;)
