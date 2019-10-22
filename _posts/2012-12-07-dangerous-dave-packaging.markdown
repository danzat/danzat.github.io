---
layout: post
title:  "Reverse Engineering Dangerous Dave"
subtitle: "Packaging"
date:   2012-12-07
categories: reverse-engineering
---

I've been looking to take on a reverse-engineering project, as a means to practice the skill, for quite some time now.

I needed something simple, but not trivial. Old DOS games seemed like a nice option, since they are mostly small and not very complex, yet the challenge will still be real.

Now, Dangerous Dave is one of the most ubiquitous games out there, it has been around since the late 80's, and as such, it will be small enough for me to undertake as a first project.

Opening the file using the freeware version of IDA Pro, I got informed that the file is possibly a packed file. This means I should expect a big lump of data and some bootstrapping code that would unpack that data into executable code.

For the sake of exercise, I want to try tackling the disassembly of the unpacker using freely available tools.

Starting with the EXE header (for additional reference on EXE, a.k.a MZ, file structure you can check out [this source](http://www.tavi.co.uk/sdos/exeformat.html)).

Let's look at a hex dump of the header:
```
$ xxd DAVE.EXE |head
0000000: 4d5a 2a01 9600 0000 0200 e31c ffff 3e2a  MZ*...........>*
0000010: 8000 0000 0e00 9812 1c00 0000 4c5a 3931  ............LZ91
0000020: ffff ba4d 252e 8916 3502 b430 cd21 8b2e  ...M%...5..0.!..
0000030: 02ff ff00 8b1e 2c00 8eda a390 008c 068e  ......,.........
0000040: 0089 1ef0 1f8a fc2e a600 e83d 01c4 3e88  ...........=..>.
0000050: feff e4c7 8bd8 b9ff 7ffc f2ae e361 4326  .............aC&
0000060: 38ff e105 75f6 80cd 80f7 d989 0ee5 b901  8...u...........
0000070: ff10 00d3 e383 c308 83e3 f8cb 8cfe 7fc3  ................
0000080: da2b ea8b 3ebe 4b81 ff00 0273 07bf 48ff  .+..>.K....s..H.
0000090: fb89 f3c7 129f 7228 033e ff1f b24b 7222  ......r(.>...Kr"
```

The field which are of interest are:
* Header paragraphs (offset 0x8) = 2
  This is where the actual "program" starts in the file, i.e. this is the the start of the image that will be loaded into memory by the DOS loader.
* Initial CS (offset 0x16) = 0x1298
  This is the segment address where that code will start executing
* Initial IP (offset 0x14) = 0xE
  This is the offset within the above segment where the loader will jump once the file has been loaded into memory.

Using these 3 parameters I we can calculate the offset of the program's entry point in terms of offset from the start of the EXE file.

One thing to notice though, is that the initial IP is not 0, meaning there might be some data in the code segment.

Anyway, to find the offset of the code segment within the file, we need to skip the header which occupies 2 paragraphs, and an additional CS (`=0x1298`) paragraphs. Each paragraph is 16 bytes long, resulting in a total offset of `2 * 16 + 0x1298 * 2 = 0x129A0` bytes.

To disassemble the code I will use [nasm](http://www.nasm.us/). I want to start disassembling at offset `0x129A0` from the start of the file, and skip the first `0xE(=14)` (allegedly) data bytes. The former is facilitated by the `-e` switch, and the latter by specifying a sync point using the `-s` switch (you can read all about the different switches here) like this:

```
$ ndisasm -b 16 -e129A0h -sEh
00000000  0000              add [bx+si],al
00000002  0000              add [bx+si],al
00000004  80003F            add byte [bx+si],0x3f
...
```

I will now go over each section I managed to identify in the executable and discuss it in detail.

# Packed code

All the data from the 3rd (we have 2 header paragraphs) to the 1299th paragraph in the file. This is just one big chunk of data whose composition we do not yet now.

# Unpacker data

Remember that there is a non 0 initial IP specified in the header? Well, that's because the first 14 bytes in the code segment are data:

```
$xxd DAVE.EXE |grep "129a0"
00129a0: 0000 0000 8000 3f2f 9812 8d17 8a01 060e  ......?/........
```

The only interesting observation which can be made here is that `9812` looks a lot like an little endian encoding of `0x1298` which is exactly the size of the packed code in paragraphs, so we can name it: `word_0x8 = 0x1298` = packed code paragraphs.

# Bootstrapping

This section itself is quite complex, and contains several parts, I will try to divide them logically.

```
$ ndisasm -b 16 -e129A0h -sEh
...
0000000E  06                push es
```

This line is a bit curious now, it pushes es into the stack. During the loading process, `es` is loaded with the address of the PSP segment. While the segment contains very interesting system information, the "real" importance of it in this context is that it is the segment of the program's base, because immediately following the PSP segment, the executable is loaded. This will be important later, so for now we need to remember that the address of the PSP segment is saved to the stack.

```
0000000F  0E                push cs
00000010  1F                pop ds
00000011  8B0E0C00          mov cx,[0xc]  ; word_0xc = 0x18a
00000015  8BF1              mov si,cx
00000017  4E                dec si
00000018  89F7              mov di,si
0000001A  8CDB              mov bx,ds
0000001C  031E0A00          add bx,[0xa]  ; word_0xa = 0x178d
00000020  8EC3              mov es,bx
00000022  FD                std
00000023  F3A4              rep movsb
```

Basically a `memcpy` of a chunk of `0x18a` bytes from the beginning of the current segment, to some address located `0x178d` paragraphs forward. This chunk is exactly the all code from the start of the segment to the end of the file, which means that the bootstrapping code itself is copied forward in memory to make room for the unpacked data.

One thing to notice is the method with which the code is copied. The addresses loaded into the source (`ds:si`) and destination (`es:di`) point to the end of the copied buffers, and the direction flag (DF) is set (by the std instruction) so after each movsb the si and di registers will decrease.

This means that when the copy loop has finished, `es:di` will point to the end of the free memory (just below the copy of the bootstrapping code) and ds:si will point to the end of the compressed code.

By the way, two words in the data section can now be named:

* word_0xc = bootstrap code size
* word_0xa = unpacked code paragraphs

```
00000025  53                push bx
00000026  B82B00            mov ax,0x2b
00000029  50                push ax
0000002A  CB                retf
```

This just pushes the new segment address of the copy of the bootstrap code (in `bx`), and then the offset `0x2b`, making the `retf` serve as a far jump to `bx:0x2b`. Since there is no difference between the running code and its copy, we can just look at offset `0x2b` in the current code to see where the program will continue execution.

```
0000002B  2E8B2E0800        mov bp,[cs:0x8]
00000030  8CDA              mov dx,ds
00000032  89E8              mov ax,bp
00000034  3D0010            cmp ax,0x1000
00000037  7603              jna 0x3c
00000039  B80010            mov ax,0x1000
0000003C  29C5              sub bp,ax
0000003E  29C2              sub dx,ax
00000040  29C3              sub bx,ax
00000042  8EDA              mov ds,dx
00000044  8EC3              mov es,bx
00000046  B103              mov cl,0x3
00000048  D3E0              shl ax,cl
0000004A  89C1              mov cx,ax
0000004C  D1E0              shl ax,1
0000004E  48                dec ax
0000004F  48                dec ax
00000050  8BF0              mov si,ax
00000052  8BF8              mov di,ax
00000054  F3A5              rep movsw
00000056  09ED              or bp,bp
00000058  75D8              jnz 0x32
```

Translated to C (almost, I will use segmented addressing notation), the code above will look like this:

```c
paragraphs_left = compressed_code_paragraphs;
while (paragraphs_left > 0) {
    if (paragraphs_left < 0x1000) {
        paragraphs_to_copy = paragraphs_left;
    } else {
        paragraphs_to_copy = 0x1000;
    }
    paragraphs_left -= paragraphs_to_copy;
    source_segment -= paragraphs_to_copy;
    destination_segment -= paragraphs_to_copy;
    source_offset = destination_offset = paragraphs_to_copy * 16 - 1;
    words_to_copy = paragraphs_to_copy * 8;
    while (words_to_copy > 0) {
        *destination_segment:destination_offset = *source_segment:source_offset;
        destination_offset -= 2;
        source_offset -= 2;
        words_to_copy--;
    }
}
```

All this does is copy the packed code to the area adjacent and below the copy of the bootstrapping code.

The reason for copying in "chunks" is that you can only address 64KiB within a segment, that's `0x1000` paragraphs. So every 64KiB, the segment addressed of both the source and destination need to be readjusted.

After all the code/data is in place, the unpacking can begin.

First, make sure the source pointer points to the copy of the packed code, and the destination pointer points to the programs first segment (the beginning of the original packed code):

```
0000005B  8EC2              mov es,dx
0000005D  8EDB              mov ds,bx
0000005F  31F6              xor si,si
00000061  31FF              xor di,di
```

Now starts the unpacking routine. Because I don't want to paste a wall of code and then discuss its analysis, I will outline the unpacking algorithm, and then analyze small chunks of asm code to fill in the details.

# Unpacker
The basic idea is that the packed code is composed of control data which comes in words, and regular data whose handling is specified by the control data.

```
00000063  BA1000            mov dx,0x10
```

So, `dx` is loaded with 16 (which is the number of bits in a word).

```
00000066  AD                lodsw
00000067  89C5              mov bp,ax
```

Then a word from the packed code is loaded into `bp`.

```
00000069  D1ED              shr bp,1
0000006B  4A                dec dx
0000006C  7505              jnz 0x73
0000006E  AD                lodsw
0000006F  89C5              mov bp,ax
00000071  B210              mov dl,0x10
```

This is a piece of code which will repeat a lot. What it does is shift the LSB of the control word into the `CF`, then update the remaining bits count (in `dx`) and if it has reached 0, the next control word is loaded into `bp` and the remaining bits count is reset.

```
00000073  7303              jnc 0x78
00000075  A4                movsb
00000076  EBF1              jmp short 0x69
```

This code actually handles the bit we pushed from the control word into the `CF`. If `CF` is set (control bit was 1) then copy a byte from the packed code to the unpacked code as-is and continue reading the next control bit. Otherwise (control bit was 0) continue with:

```
00000078  31C9              xor cx,cx
```

Reset cx.

```
0000007A  D1ED              shr bp,1
0000007C  4A                dec dx
0000007D  7505              jnz 0x84
0000007F  AD                lodsw
00000080  89C5              mov bp,ax
00000082  B210              mov dl,0x10
```

This should be familiar from before, just read the next bit and load a new word if needed.

```
00000084  7222              jc 0xa8
```

We will handle the case where the control bit is '1' later. If, however, the control bit was '0':

```
00000086  D1ED              shr bp,1
00000088  4A                dec dx
00000089  7505              jnz 0x90
0000008B  AD                lodsw
0000008C  89C5              mov bp,ax
0000008E  B210              mov dl,0x10
```

Load the next control bit into `CF`.

```
00000090  D1D1              rcl cx,1
```

And push it into `cx` (from right to left).

```
00000092  D1ED              shr bp,1
00000094  4A                dec dx
00000095  7505              jnz 0x9c
00000097  AD                lodsw
00000098  89C5              mov bp,ax
0000009A  B210              mov dl,0x10
```

Read another control bit

```
0000009C  D1D1              rcl cx,1
```

And shift it into `cx` too. So what we get in essence is the two control bits in reverse order in `cx`.

```
0000009E  41                inc cx
0000009F  41                inc cx
```

Add 2 to `cx`.

```
000000A0  AC                lodsb
000000A1  B7FF              mov bh,0xff
000000A3  8AD8              mov bl,al
```

Load the next byte from the packed code into `bl`, and put `0xff` in `bh`. This will result in `bx` containing the signed (and negative) value of `read_byte-256`.

```
000000A5  E91300            jmp word 0xbb
```

Continue execution at:

```
000000BB  268A01            mov al,[es:bx+di]
000000BE  AA                stosb
000000BF  E2FA              loop 0xbb
000000C1  EBA6              jmp short 0x69
```

This is equivalent to:

```c
while (cx-- > 0) {
    *destination_segment:destination_offset = *destination_segment:(destination_offset + bx);
    destination_offset++;
}
```

This code copies a chunk of `cx` bytes from already unpacked code (remember `bx` < 0) to the head of the unpacked code. This means that:

The byte that was loaded into `bx` represents an offset.

The two bits (+2) which were loaded into `cx` represents a length.

Let's recap before we continue:

* The packed code is composed of control words, which are read bit-by bit from LSB to MSB.
* If we encounter a 1, we copy the next byte in the packed code to the unpacked code as-is.
* If we encounter two 0's in a row, we need to copy `N+2` bytes from the current position in the unpacked data minus `D`, where `N` is the next two bits in the control, and `D` is the next byte in the packed code.

How about if we read a 0 and then a 1? Well, that's the case I said we'll do later.

```
000000A8  AD                lodsw
000000A9  8BD8              mov bx,ax
```

Read a word from the packed data into `ax` (and `bx`).

```
000000AB  B103              mov cl,0x3
000000AD  D2EF              shr bh,cl
000000AF  80CFE0            or bh,0xe0
000000B2  80E407            and ah,0x7
```

This code separates two values encoded into the word. The 3 least significant bits of the high byte are loaded into `ax`, while the remaining 5 most significant bits are shifted right. The `or bh,0xe0` causes `bx` to contain the signed (and negative) value of its former value minus 8192.

```
000000B5  740C              jz 0xc3
```

We will handle the case in which `ax` turned out to be 0 later. If `ax` was not 0:

```
000000B7  88E1              mov cl,ah
000000B9  41                inc cx
000000BA  41                inc cx
```

Just sets `cx` to `ax+2`.

```
000000BB  268A01            mov al,[es:bx+di]
000000BE  AA                stosb
000000BF  E2FA              loop 0xbb
000000C1  EBA6              jmp short 0x69
```

This is the same copy loop we analyzed before. This means that the 3 least-significant bits in the high byte are an encoded length (-2), and the rest of the word, when recombined is the offset. Notice that in while in the previous case, the copied chunk's length was limited to 5 bytes, and the offset to 256, here the length is limited to 9 bytes, and the offset to 8192. How about that case in which the length we read is 0? Well:

```
000000C3  AC                lodsb
```

Read another byte from the packed code.

```
000000C4  08C0              or al,al
000000C6  7434              jz 0xfc
000000C8  3C01              cmp al,0x1
000000CA  7405              jz 0xd1
```

I'll cover the cases in which the read byte is 0 or 1 later.

```
000000CC  88C1              mov cl,al
000000CE  41                inc cx
000000CF  EBEA              jmp short 0xbb
```

If the read byte is bigger than 1, then load `cx` with that value + 1, and jump to the copying code. This means that the byte we read specified a length. Now let's handle the case in which that byte was 1:

```
000000D1  89FB              mov bx,di
000000D3  83E70F            and di,byte +0xf
000000D6  81C70020          add di,0x2000
000000DA  B104              mov cl,0x4
000000DC  D3EB              shr bx,cl
000000DE  8CC0              mov ax,es
000000E0  01D8              add ax,bx
000000E2  2D0002            sub ax,0x200
000000E5  8EC0              mov es,ax
000000E7  89F3              mov bx,si
000000E9  83E60F            and si,byte +0xf
000000EC  D3EB              shr bx,cl
000000EE  8CD8              mov ax,ds
000000F0  01D8              add ax,bx
000000F2  8ED8              mov ds,ax
000000F4  E972FF            jmp word 0x69
```

Remember that I mentioned earlier that we can't address more than 64KiB within a segment? Well, this limit could be reached while we are copying bytes to the uncompressed code. To avoid it, we need to readjust the segment addresses of both the source and destination segments. This is exactly what the code does, for each of the addresses, it adds the number of paragraphs which fit inside the offset to the segment address, and leaves the remainder in the offset. For example, if `es:di = 0x1234:0x5678`:

* We can fit `0x567` paragraphs in `0x5678` bytes.
* Add `0x567` to the segment address to obtain `0x179b`
* The remainder, `0x8`, is left in the offset
* The readjusted address is `0x179b:0x0008` is equivalent to `0x1234:0x5678` (you can check yourself by comparing the linear addresses), but the addressing limitation within the segment has been overcome.

This just leaves the last case of the read byte being 0. Well, that's the "end-of-stream" marker, which means the unpacking process is done.

So to summarize the unpacking algorithm (I use `C` to denote the current offset in the output):

* The packed code contains control words.
* The control words are read bit-by-bit from LSB to MSB.
  * `1` - read the next byte from the stream and copy it to the output as-is.
  * `00` - read the next two bits from the control into `N`. read the next byte from the stream into `D`. Copy `N+2` bytes from `C+D-256` to the output.
  * `01` - read the next word from the stream. Extract `N` from the 3 LSB of the high bytes, and `D` from the word resulting by right-shifting the high byte by 3. Then:
    * If `N = 0`, This is the end of stream, we are done.
    * If `N = 1`, We need to readjust the segments.
    * if `N > 1`, Copy `N+1` bytes from `C+D-8192` to the output.

This algorithm specification is actually enough to be able to unpack the code.

But in reality, the bootstrapping is not over yet. For one, the control needs to be passed to the unpacked code.

So for the sake of being thorough, let's continue just a bit more.

# Relocation

When the end-of-stream has been reached, we jump to:

```
000000FC  0E                push cs
000000FD  1F                pop ds
000000FE  BE5801            mov si,0x158
```

Set `ds` to the current code segment, and load `si` with `0x158`. This leads me to suspect that `ds:si` is now pointing to some data at the tail of the code:

```
$ xxd DAVE.EXE |grep -A20 "12af0:"
0012af0: 8ed6 8be7 fb2e ff2f 01dd 3200 3910 1530  ......./..2.9..0
0012b00: 2515 0015 3e12 00ed 1019 2000 0b14 00f0  %...>..... .....
0012b10: 0100 5e01 c85a 008d 0900 670a 5b87 4cdd  ..^..Z....g.[.L.
0012b20: 7400 8a01 0081 0200 0100                 t.........
```

Not that there will be any use for that data to us.

```
00000101  5B                pop bx
00000102  83C310            add bx,byte +0x10
00000105  89DA              mov dx,bx
```

OK, remember from way way before, when I said that the PSP segment was pushed to the stack? Well, it's still there (so far all the stack operations were balanced). The size of the PSP is 256 bytes, or, 10 paragraphs, so `bx` holds the segment address immediately following the PSP, which is also the start of the code, this time the unpacked code.

```
00000107  31FF              xor di,di
00000109  AC                lodsb
0000010A  08C0              or al,al
0000010C  7416              jz 0x124
0000010E  B400              mov ah,0x0
00000110  01C7              add di,ax
00000112  8BC7              mov ax,di
00000114  83E70F            and di,byte +0xf
00000117  B104              mov cl,0x4
00000119  D3E8              shr ax,cl
0000011B  01C2              add dx,ax
0000011D  8EC2              mov es,dx
0000011F  26011D            add [es:di],bx
00000122  EBE5              jmp short 0x109
00000124  AD                lodsw
00000125  09C0              or ax,ax
00000127  7508              jnz 0x131
00000129  81C2FF0F          add dx,0xfff
0000012D  8EC2              mov es,dx
0000012F  EBD8              jmp short 0x109
00000131  3D0100            cmp ax,0x1
00000134  75DA              jnz 0x110
```

I'll spare you the deep analysis, but what happens here is this:

* That data contains offsets to addresses which need to be relocated.
* These offsets are cumulative (the offset to relocation address `N` is the sum of the first `N` entries in the table).
* For each relocation address, the segment address of the code start is added to the segment address in the code.
* The way these offsets are encoded is that each offset is a byte, unless that byte is 0, in which case the offset is a word.
* The iteration ends when a word whose value is 1 is read.
* This sums up the relocation process.

# Wrapping up

The only thing left is jumping into the unpacked (and relocated) code to start the game:

```
00000136  8BC3              mov ax,bx
```

The segment address of the code start is loaded into `ax`.

```
00000138  8B3E0400          mov di,[0x4]        ; di = var_0x4
0000013C  8B360600          mov si,[0x6]
00000140  01C6              add si,ax           ; si = var_0x6 + reloc
00000142  01060200          add [0x2],ax        ; var_0x2 += reloc
00000146  2D1000            sub ax,0x10
00000149  8ED8              mov ds,ax           ; ds = PSP segment
0000014B  8EC0              mov es,ax           ; es = PSP segment
0000014D  31DB              xor bx,bx           ; bx = 0
0000014F  FA                cli
00000150  8ED6              mov ss,si           ; ss = var_0x6 + reloc
00000152  8BE7              mov sp,di           ; sp = var_0x4
00000154  FB                sti
```

This code just sets up the initial stack address (segment & offset), which also means that we can identify `var_0x6` as the initial stack segment and `var_0x4` as the initial stack offset. The code also loads `var_0x2` with the segment address of the code start. The next (and last) instruction will reveal why:

```
00000155  2EFF2F            jmp word far [cs:bx]
```

This is a far jump, meaning that the address is loaded from two words at `cs:0`, the first (`var_0x0`) is the offset, and the second (`var_0x2`) is the segment, which means that the entry points in the unpacked code is simply its beginning.

That's it for the easy and fun part, next time I will start reverse engineering the code we had just unpacked.
