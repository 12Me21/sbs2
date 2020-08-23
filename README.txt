wrote by 12Me21

* Instructions
Open index.html in a web browser

If you are hosting this on a server, it's a good idea to run `build.sh`, then copy `_build.html`(can be renamed) and `resource/` into the place where you want to host from.
(build.sh only works on linux, but you can follow the instructions in the file to do it manually if you need to)

* Files
** index.html
main html file

** fill.js
polyfill
** navigate.js
page navigation handling
** request.js
http requests, sbs2 api
** entity.js
recieved data processing
** view.js
page rendering
** draw.js
html generation

** style.css
main css file
** markup.css
styling for markup
** code.css
highlighter colors for markup code blocks
** fonts.css
font definitions

** build.sh
build script (optional)

** resource/
fonts, icons, images, etc.

** README.txt
readme
** LICENSE.txt
license

** sbs2-markup
markup parser subsystem
