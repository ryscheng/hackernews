#!/bin/sh
echo "(nsv $1 \"$2\")" | ~/bin/mz372/bin/mzscheme -r boot.scm
