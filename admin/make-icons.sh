#!/bin/bash
set -ue ; cd -- "`dirname -- "${BASH_SOURCE:?}"`"
cd ../resource

# generate different icon sizes from favicon.svg

# rsvg-convert is from librsvg
# apt package: librsvg2-bin

rsvg-convert -aw 16 favicon.svg -o icon16.png
rsvg-convert -aw 32 favicon.svg -o icon32.png
rsvg-convert -aw 192 favicon.svg -o iconbig.png
echo "done" >&2

# I don't remember how i created icon16.ico... but no browsers should use that anymore anyway. maybe I'll remove it later...
