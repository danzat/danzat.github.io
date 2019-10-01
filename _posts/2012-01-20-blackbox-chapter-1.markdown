---
layout: post
title:  "Blackbox - Chapter 1"
date:   2012-01-20
categories: reverse-engineering
---

Well, I've decided it's about time I started keeping record of things I do/learn/come across.

As it so happens, this decision coincides (not entirely by chance) with my latest adventure - the blackbox wargame.

Blackbox is one of the servers on SmashTheStack, and the principle all servers follow is that you are given an initial login (level1), using which you need to obtain the privileges of the next user (level2), and so on.
The method of obtaining the privileges varies with each level (usually with increasing difficulty), and can range from obtaining the password to using privilege escalation.

It is my intent to use this blog to describe my experience hacking through the various levels, the things I learned from them and maybe get some useful feedback. Anyway, my point is that if you, the reader, plan to take on blackbox by yourself, let this be a SPOILER ALERT warning to you, otherwise, read on.

# Level 1
__The password for the next level has been replaced with question marks so as to not make this too obvious, and so that the point of the walkthrough, which is mainly educational, will not be missed.__

The password for the first level is simply `level1`. Let's connect to the server and look around:
```
$ ssh -p 2225 level1@blackbox.smashthestack.org
level1@blackbox.smashthestack.org's password: 
    __________.__                __   __________              
    \______   \  | _____    ____ |  | _\______   \ _______  ___
    |    |  _/  | \__  \ _/ ___\|  |/ /|    |  _//  _ \  \/  /
    |    |   \  |__/ __ \\  \___|    < |    |   (  <_> >    < 
    |______  /____(____  /\___  >__|_ \|______  /\____/__/\_ \
           \/          \/     \/     \/       \/            \/


                     Welcome to black

RULES->
->1: NO DOSING PLEASE !!!
->2: NO MONKEY BUSINESS!!!
->3: HAVE FUN

Admin: dusty@smashthestack.org
irc: irc.smashthestack.org #social #blackbox #staff

INFO:
Levels are in the /home dir. All code goes into /tmp.
Levels 1-8 are working. Beat level 8 and you will gain level 9 privs and win.
Tags are in /home/tags/. You can only tag at the level you are at.
They can be seen online at the main page, http://blackbox.smashthestack.org:85/ .

 
NOTICE: Easy on the resources, 30m idle logout in place.
Last login: Wed Jan 18 21:47:05 2012 from 173-164-36-250-colorado.hfc.comcastbusiness.net
level1@blackbox:~$ ls -l
total 1168
-rws--xr-x 1 level2 level2 1189337 2008-01-12 16:14 login2
```

Well, we have an executable, let's try and run it:
```
level1@blackbox:~$ ./login2 
Username:
```

Hmm, it wants a username and probably a password. Well, I know the username I'm interested in is "level2", but I don't know the password...

First we need to understand what we are looking for before we try to figure out how to find it. Well, I'd start by hypothesizing how the program works, and I assume for simplicity that the program ought to read the username and password from standard input, and them compare them to some constant strings, and then print some nice message if we there is a match and some other message if there is no match.
A rather simplistic view, but let's see what this means. What we would like to find a comparison, and follow the trail to that comparison in order to find out the password.

Let's disassemble the file and see what we can learn from it:

```
level1@blackbox:~$ objdump -C -d login2 | grep -A100 "<main>:"
0804827a <main>:
....
 80482f0: c7 44 24 04 5e fe 0f  movl   $0x80ffe5e,0x4(%esp)
 80482f7: 08 
 80482f8: 8d 45 f4              lea    0xfffffff4(%ebp),%eax
 80482fb: 89 04 24              mov    %eax,(%esp)
 80482fe: e8 eb 00 00 00        call   80483ee <bool std::operator==<char, std::char_...
 8048303: 34 01                 xor    $0x1,%al
 8048305: 84 c0                 test   %al,%al
 8048307: 75 1f                 jne    8048328 <main+0xae>
 8048309: c7 44 24 04 65 fe 0f  movl   $0x80ffe65,0x4(%esp)
 8048310: 08 
 8048311: 8d 45 f0              lea    0xfffffff0(%ebp),%eax
 8048314: 89 04 24              mov    %eax,(%esp)
 8048317: e8 d2 00 00 00        call   80483ee <bool std::operator==<char, std::char_...
 804831c: 34 01                 xor    $0x1,%al
 804831e: 84 c0                 test   %al,%al
 8048320: 75 06                 jne    8048328 <main+0xae> 
....
```

__I've cropped the output to the interesting lines only to spare you the horror of tons of C++ symbols. You can do this yourself if you like that sort of thing__

Well, it looks like my suspicions were confirmed, we have two string comparisons here, and the constants fed into them are probably the ones we are looking for - one string at `0x080ffe5e` and another at `0x080ffe65`.
Lets dig them out with `gdb`:

```
level1@blackbox:~$ gdb login2
...
(gdb) x/s 0x080ffe5e
0x80ffe5e <_IO_stdin_used+26>:  "????????"
(gdb) x/s 0x080ffe65
0x80ffe65 <_IO_stdin_used+33>:  "????????"
```

Bingo! The first one must be the user name, and the second is the password. Let's give them a try:

```
level1@blackbox:~$ ./login2 
Username: ????????
Password: ????????
Welcome, level 2!
sh-3.1$ whoami
level2
```

Well, looks like we made it, and we even got a shell with level2.
