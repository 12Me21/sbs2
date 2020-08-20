cd -P -- "`dirname -- "$0"`"

cat fonts.css style.css markup.css code.css > _build.css
cat sbs2-markup/sbhighlight.js sbs2-markup/parse.js sbs2-markup/render.js fill.js entity.js request.js draw.js view.js navigate.js main.js > _build.js

date=`date +%s`
sed '/<!--START-->/,/<!--END-->/c<link rel="stylesheet" href="_build.css?'"$date"'">\
<script src="_build.js?'"$date"'"></script>' index.html > _build.html
