if [ "$1" ]
then
	dest="$(readlink -f "$1")"
	read -p "Will output files to: $dest
(Press Enter)" >&2
fi

cd "$(dirname "$0")"

echo 'Building markup system' >&2
./sbs2-markup/build.sh

echo 'creating _build.css' >&2
cat resource/fonts.css style.css markup.css code.css > resource/_build.css

echo 'creating _build.js' >&2
cat fill.js entity.js request.js sbs2-markup/_build.js draw.js view.js scroller.js sidebar.js chat.js Views/settings.js Views/page.js Views/image.js Views/editpage.js Views/category.js Views/user.js navigate.js main.js > resource/_build.js

echo 'creating _build.html' >&2
date=`date +%s`
sed '/<!--START-->/,/<!--END-->/c<link rel="stylesheet" href="resource/_build.css?'"$date"'">\
<script src="resource/_build.js?'"$date"'"></script>' index.html > _build.html

if [ "$1" ]
then
	echo 'Copying files' >&2
	if [ -f "$dest" ]
	then
		cp -v -u -r resource "$(dirname "$dest")"/resource
		cp -v -u _build.html "$dest"
	else
		mkdir -vp "$dest"
		cp -v -u -r resource "$dest"/
		cp -v -u _build.html "$dest"/index.html
	fi
fi

# Instructions for humans:

# 1: follow the instructions in sbs2-markup/build.sh

# 2: combine the contents of the files (in order):
#  fonts.css style.css markup.css code.css
# into resource/_build.css
 
# 3: combine the contents of the files (in order):
#  sbs2-markup/_build.js fill.js entity.js request.js draw.js view.js navigate.js main.js
# into resource/_build.js

# 4: open index.html
# replace the lines between <!--START--> and <!--END--> with
#  <link rel="stylesheet" href="_build.css?12345">
#  <script src="_build.js?12345"></script>
# replace the "12345"s with any random number (use a different one each time you build this))
# save as _build.html

# 5: copy these files to wherever you're hosting the site from:
#  _build.html resource/
# _build.html can be renamed

# maybe later I'll make a powershell script for this or something
