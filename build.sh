rm build.html

sed '/<!--START-->/Q' index.html >> build.html

echo "<style>" >> build.html
cat fonts/fonts.css style.css markup.css code.css >> build.html
echo "</style>" >> build.html

echo "<script>" >> build.html
#cat util.js types.js myself.js lp4.js sbhighlight.js parse.js render.js view.js events.js navigate.js main.js >> build.html
echo "</script>" >> build.html

sed '1,/<!--END-->/d' index.html >> build.html
