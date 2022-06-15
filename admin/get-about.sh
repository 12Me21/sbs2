#!/bin/bash
set -ue ; cd -- "`dirname -- "${BASH_SOURCE:?}"`"

{
	printf 'let ABOUT='
	curl https://qcs.shsbs.xyz/api/Request/about
	echo
} >ABOUT.js
#sed -E '1i let ABOUT=
#;s/"([^"\n]+|\\")*":|}/\n&/g'

mv ABOUT.js ../src/ABOUT.js
echo "done" >&2
