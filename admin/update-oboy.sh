#!/bin/bash
# yes but you don'[t know my PASSWORD!
set -ue
ssh ssh://12@oboy.smilebasicsource.com:240 -t 'cd ~/storage/sbs2/ && git pull --recurse-submodules && yes | ./admin/build-with-sourcemaps.sh ~/html/'
echo "done" >&2
