cd -P -- "`dirname -- "$0"`"

./sbs2-markup/build.sh

cat fonts.css style.css markup.css code.css > resource/_build.css
cat sbs2-markup/_build.js fill.js entity.js request.js draw.js view.js navigate.js main.js > resource/_build.js

date=`date +%s`
sed '/<!--START-->/,/<!--END-->/c<link rel="stylesheet" href="resource/_build.css?'"$date"'">\
<script src="resource/_build.js?'"$date"'"></script>' index.html > _build.html

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

# maybe later I'll make a powershell script for this or something
