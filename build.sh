cat fonts/fonts.css style.css markup.css code.css > _build.css
cat fill.js request.js view.js navigate.js main.js > _build.js

date=`date +%s`
sed '/<!--START-->/,/<!--END-->/c<link rel="stylesheet" href="_build.css?'"$date"'">\
<script src="_build.js?'"$date"'"></script>' index.html > _build.html
