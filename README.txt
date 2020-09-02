wrote by 12Me21

* Instructions
Make sure sbs2-markup/ isn't empty
If you're using git, you can run `git pull --recurse-submodules` to download it.
Otherwise, download the files from https://github.com/12Me21/sbs2-markup and put them in sbs2-markup/

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
