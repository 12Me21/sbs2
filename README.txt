🔸🔶🟧 INSTRUCTIONS 🟧🔶🔸

Make sure markup/ isn't empty
If you're using git, you can run `git submodule update --init` to download it.
Otherwise, download the files from https://github.com/12Me21/sbs2-markup and put them in markup/

Open index.html (NOT src/index.html) in a web browser

If you are hosting this on a server, it's a good idea to use `build.sh`, to slightly improve load times and avoid problems with caching.
This will generate `_build.html` and some files in `resource/`, as well as copy the files to a destination.
`./build.sh <directory>` copies resource to <directory>/resource and _build.html to <directory>/index.html


🔸🔶🟧 FILES 🟧🔶🔸

📕 src/index.html
main html file

📒 src/fill.js
this is just a polyfill, I swear

📒 src/entity.js
recieved data processing
📒 src/activity.js
activity processing
📒 src/request.js
http requests, sbs2 api
📒 src/socket.js
long-polling/websocket system

📒 src/draw.js
html generation code
📒 src/input.js
form system

📒 src/view.js
page rendering system
📒 src/scroller.js
Autoscroller system
📒 src/sidebar.js
sidebar things
📒 src/chat.js
chat system
📒 src/settings.js
settings system (bad)

📒 src/View/*.js
code specific to a certain page
📒 src/View/template.js
template (unused)

📒 src/navigate.js
page navigation handling

📒 src/main.js
main

📘 src/theme.css
css variable definitions
📘 src/style.css
main css file
📘 src/markup.css
styling for markup
📘 src/code.css
highlighter colors for markup code blocks
📘 resource/fonts.css
font definitions

📚 resource/
fonts, icons, images, etc.

📚 markup/
markup parser subsystem

📗 build.sh
build script (optional)

📔 README.txt
readme
📔 LICENSE.txt
license


🔸🔶🟧 CREDITS 🟧🔶🔸

🔸𝓱𝓪𝓵𝓸𝓸𝓹𝓭𝔂
🔸𝟷𝟸
🔸𝔂
🔸𝓷𝓲𝓬𝓸𝓵𝓮
🔸𝓬𝓱𝓮𝓻𝓻𝔂
🔸𝓽𝓲𝓷𝓽
🔸𝓹𝓮𝓻𝓼𝓴𝓪
🔸𝓬𝓱𝓲𝓬𝓴𝓮𝓷
🔸𝓼𝓷𝓪𝓲𝓵_
🔸𝓻𝓮𝓬𝓸𝓻𝓭

𝓱𝓮𝓬𝓴𝓸
