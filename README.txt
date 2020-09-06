wrote by 12Me21

* Instructions
Make sure sbs2-markup/ isn't empty
If you're using git, you can run `git pull --recurse-submodules` to download it.
Otherwise, download the files from https://github.com/12Me21/sbs2-markup and put them in sbs2-markup/

Open index.html in a web browser

If you are hosting this on a server, it's a good idea to use `build.sh`
This will generate `_build.html` and some files in `resource/`, as well as copy the files to a destination.
You can run `./build.sh <file>`, which copies `_build.html` to <file>, and copies `resource` to the same directory
or use `./build.sh <directory>`, which copies `_build.html` to `<directory>/index.html` and `resource` to `<directory>/resource`
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

** View/chat.js
code specific to the chat page
** View/settings.js
code specific to the settings/login/register page

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
