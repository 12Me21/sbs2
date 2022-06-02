#!/bin/bash
set -ue ; cd -- "`dirname -- "${BASH_SOURCE:?}"`"

{
	printf 'let ABOUT='
	curl https://qcs.shsbs.xyz/api/Request/about
	echo
} >ABOUT.js
mv ABOUT.js ../src/ABOUT.js
echo "done" >&2
