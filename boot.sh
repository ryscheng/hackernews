#!/bin/sh
echo "(nsv $1 \"$2\")" | ~/bin/MzScheme\ v372/bin/mzscheme -r boot.scm
