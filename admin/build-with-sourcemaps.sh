#!/bin/bash

set -e

# WARNING! EXPERIMENTAL

if [ "$1" ]
then
	dest="$(readlink -f "$1")"
	read -p "Will output files to: $dest
(Press Enter)" >&2
fi

cd -- "`dirname -- "${BASH_SOURCE:?}"`"
cd ..

merge_files () {
	echo "Creating $1" >&2
	echo "-------------------" >&2
	
	files=`grep -Po "$2" index.html`
	
	printf '{"version":3,"sections":[{"offset":{"column":0,"line":0},"map":{"version":3,"sources":["_build.js"],"mappings":"AAAA"}}' >"$1".map
	
	declare -i total=1
	for file in ${files[@]}; do
		printf ',{"offset": {"column":0,"line":%s},"map":{"version":3,"sourceRoot":"_source","sources":["%s"],"mappings":"AAAA' $total $file
		length=`wc -l <"$file"`
		printf '%s\tL:%d\n' $file $length >&2
		yes ';AACA' | head -n $length | tr -d '\n'
		printf '"}}'
		total+=$length
		mkdir -p resource/_source/"$(dirname "$file")" >&2
		cp $file resource/_source/$file >&2
	done >>"$1".map
	
	printf ']}' >>"$1".map
	
	echo "$3" >"$1"
	sed '' ${files[@]} >>"$1"
	
	echo "$4" >>"$1"
	
	echo "===================" >&2
}

printf "w" >>admin/.unique.unary
nocache () {
	printf "$1?"
	# yea;
	cat admin/.unique.unary | wc -c | tr '0123456789' 'zowruvxsen'
	#printf "%o" `date +%s` | tr 
	 #| basenc -d --base16 | basenc --base64url | tail -c +2 | tr -d =
}

merge_files resource/_build.js '<script .*\bsrc=\K[\w/.-]+(?=>)' '"use strict"' "//# sourceMappingURL=$(nocache _build.js.map)"

merge_files resource/_build.css '<link .*\brel=stylesheet href=\K[\w/.-]+(?=>)' '@uwu;' "/*# sourceMappingURL=$(nocache _build.css.map) */"

echo 'Creating _build.html' >&2
commit="$( git log -1 --format='%h [%ad] %s' | sed 's@[`$\\]@\\&@g' )"
inject="<!--**********************************************-->\\
<script>window.COMMIT = \`$commit\`</script>\\
<link rel=stylesheet href=$(nocache resource/_build.css)>\\
<style id=\$customCSS></style>\\
<script src=$(nocache resource/_build.js)></script>\\
<!--**********************************************-->"
sed "/<!--START-->/,/<!--END-->/c $inject" index.html > _build.html

if [ "$1" ]
then
	echo 'Copying files' >&2
	mkdir -vp "$dest"
	cp -u -r resource "$dest"/
	cp -v -u _build.html "$dest"/index.html
fi
