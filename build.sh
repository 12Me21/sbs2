if [ "$1" ]
then
	dest="$(readlink -f "$1")"
	read -p "Will output files to: $dest
(Press Enter)" >&2
fi

cd "$(dirname "$0")"

echo 'Building markup system' >&2
./markup/build.sh

echo 'creating _build.css' >&2
cat theme.css resource/fonts.css style.css markup.css code.css > resource/_build.css

echo 'creating _build.js' >&2
printf 'window.commit = "%q";\n\n' "`git log -1 --format='%h [%ad] %s'`" | cat - fill.js entity.js activity.js socket.js request.js markup/_build.js draw.js view.js scroller.js sidebar.js chat.js settings.js Views/settings.js Views/page.js Views/images.js Views/editpage.js Views/category.js Views/user.js Views/home.js Views/chatlogs.js Views/comments.js navigate.js main.js > resource/_build.js


# nocache filename -> filename?1234567 (uses date modified)
# for now this isn't very useful since the files are always new
# but maybe if we use `make`...
function nocache {
	echo -n "$1?"
	date -r "$1" +%s
}

echo 'creating _build.html' >&2
date=`date +%s`
sed '/<!--START-->/,/<!--END-->/c<link rel="stylesheet" href="'"$(nocache resource/_build.css)"'">\
<script src="'"$(nocache resource/_build.js)"'"></script>' index.html > _build.html

if [ "$1" ]
then
	echo 'Copying files' >&2
	mkdir -vp "$dest"
	cp -v -u -r resource "$dest"/
	cp -v -u _build.html "$dest"/index.html
fi

# Instructions for humans:

# 1: follow the instructions in markup/build.sh

# 2: combine the contents of the files (in order):
#  fonts.css style.css markup.css code.css
# into resource/_build.css
 
# 3: combine the contents of the files (in order):
#  markup/_build.js fill.js entity.js request.js draw.js view.js navigate.js main.js
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
