wrote by 12Me21

* Instructions
Make sure sbs2-markup/ isn't empty
If you're using git, you can run `git pull --recurse-submodules` to download it.
Otherwise, download the files from https://github.com/12Me21/sbs2-markup and put them in sbs2-markup/

Open index.html in a web browser

(You can also go to https://12Me21.github.io/sbs2)

If you are hosting this on a server, it's a good idea to use `build.sh`, to slightly improve load times and avoid problems with caching.
This will generate `_build.html` and some files in `resource/`, as well as copy the files to a destination.
`./build.sh <directory>` copies resource to <directory>/resource and _build.html to <directory>/index.html
(build.sh only works on linux, but you can follow the instructions in the file to do it manually if you need to)

* Files
** index.html
main html file

** fill.js
this is just a polyfill, I swear

** entity.js
recieved data processing
** request.js
http requests, sbs2 api

** draw.js
html generation

** view.js
page rendering

** scroller.js
Autoscroller system
** chat.js
chat

** View/settings.js
code specific to the settings/login/register page
** View/page.js
code specific to the chat/page view
** View/image.js
" file viewer
** View/editpage.js
" page editor
** View/category.js
" category pages
** View/template.js
template for creating views (unused)

** navigate.js
page navigation handling

** main.js
main

** style.css
main css file
** markup.css
styling for markup
** code.css
highlighter colors for markup code blocks
** resource/fonts.css
font definitions

** build.sh
build script (optional)

** resource/
fonts, icons, images, etc.

** README.txt
readme
** LICENSE.txt
license

** sbs2-markup/
markup parser subsystem

* Credits
- random
- y
- nicole
- perska
- chicken
- answer
- snail_
