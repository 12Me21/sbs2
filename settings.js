<!--/* trick indenter
var Settings = Object.create(null)
with (Settings) (function($) { "use strict"
Object.assign(Settings, { //*/

fields: {
	chat_markup: {
		name: "Chat Markup Language",
		type: 'select',
		options: ['12y','bbcode','html'],
		update: function(value) {
			ChatRoom.markup = value
		},
	},
	theme: {
		name: "Theme",
		type: 'select',
		options: ['auto','light','dark'],
		update: function(value) {
			if (value != 'auto')
				$.document.documentElement.dataset.theme = value
			else
				delete $.document.documentElement.dataset.theme
		}
	},
	sitejs: {
		name: "Custom Javascript",
		type: 'textarea',
		autosave: false, //todo: maybe highlight when changed, to notify user that they need to save manually?
		update: function(value) {
			eval(value)
		},
	},
	sitecss: {
		name: "Custom CSS",
		type: 'textarea',
		autosave: false,
		update: function(value) {
			$customCSS.textContent = value
		},
	},
	nickname: {
		name: "Chat Nickname",
		type: 'textarea',
		update: function(value) {
			ChatRoom.nickname = value.substr(0, 50).replace(/\n/g, "  ");
		},
	},
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
