if [ "$1" ]
then
	dest="$(readlink -f "$1")"
	read -p "Will output files to: $dest
(Press Enter)" >&2
fi

cd "$(dirname "$0")" || exit

merge_files () {
	files=`grep -Po "$2" index.html`
	echo "Creating $1" >&2
	echo "-------------------" >&2
	printf %s\\n $files >&2
	echo "===================" >&2
	cat $files >"$1"
}

merge_files resource/_build.css '<link .*\brel=stylesheet href=\K[\w/.-]+(?=>)'
merge_files resource/_build.js '<script .*\bsrc=\K[\w/.-]+(?=>)'

echo 'Creating _build.html' >&2
# nocache filename -> filename?1234567 (uses date modified)
nocache () {
	printf "$1?" ; date -r "$1" +%s
}
commit="$( git log -1 --format='%h [%ad] %s' | sed 's@[`$\\]@\\&@g' )"
inject="<!--**********************************************-->\\
<script>window.COMMIT = \`$commit\`</script>\\
<link rel=stylesheet href=$(nocache resource/_build.css)>\\
<script src=$(nocache resource/_build.js)></script>\\
<!--**********************************************-->"
sed "/<!--START-->/,/<!--END-->/c $inject" index.html > _build.html

if [ "$1" ]
then
	echo 'Copying files' >&2
	mkdir -vp "$dest" || exit
	cp -v -u -r resource "$dest"/
	cp -v -u _build.html "$dest"/index.html
fi
