#!/bin/bash
set -ue ; cd -- "`dirname -- "${BASH_SOURCE:?}"`"

curl https://qcs.shsbs.xyz/api/Request/about -o ABOUT.json

clear

printf "const ABOUT=" >ABOUT.js
# format + convert json to js (unquote keys, add trailing commas, minify true/false)
json_pp <ABOUT.json | sed -E 's/^ *(".*?") *: */\1:/g;s/^"([a-zA-Z_]\w*?)":/\1:/g;s/^ *(.*?[^,{[]),?$/\1,/g;s/true,$/!0,/g;s/false,$/!1,/g;$s/,$/\n/' >>ABOUT.js
#sed -E '1i let ABOUT=
#;s/"([^"\n]+|\\")*":|}/\n&/g'

#tail -c +11 ../src/ABOUT.js | json_pp >old-about.json
#tail -c +11 ABOUT.js | json_pp >new-about.json
echo "diff:"
diff --color=auto -s ../src/ABOUT.js ABOUT.js >&2 || true
echo "sizes:"
wc -c ABOUT.json >&2
wc -c ABOUT.js >&2
wc -c ../src/ABOUT.js >&2

mv ABOUT.js ../src/ABOUT.js
echo "done" >&2
