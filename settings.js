<!--/* trick indenter
var Settings = Object.create(null)
with (Settings) (function($) { "use strict"
Object.assign(Settings, { //*/

fields: {
	theme: {
		name: "Theme",
		type: 'select',
		options: ['light','dark'],
		update: function(value) {
			if (value == "dark") {
				$customCSS.textContent = "body, img {filter: invert(100%) hue-rotate(180deg);}"
			} else
				$customCSS.textContent = ""
		}
	}
},

change: function(name, value) {
	var field = fields[name]
	if (!field) return
	field.update && field.update(value)
}

<!--/* 
}) //*/


<!--/*
}(window)) //*/
