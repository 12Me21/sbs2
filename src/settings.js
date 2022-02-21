<!--/* trick indenter
var Settings = Object.create(null)
with (Settings) (function($) { "use strict"
Object.assign(Settings, { //*/

values: {},

fields: {
	chat_markup: {
		name: "Chat Markup Language",
		type: 'select',
		options: ['12y','bbcode','html'],
		update: function(value) {
			ChatRoom.markup = value
		},
	},
	big_avatar: {
		name: "Big Avatar",
		type: 'select',
		options: ['off', 'on'],
		//update: function(value) {
		//	ChatRoom.big_avatar = value
		//},
	},
	big_avatar_id: {
		name: "Big Avatar Id",
		type: 'textarea',
		//update: function(value) {
		//	ChatRoom.big_avatar_id = Number(value)
		//},
	},
	html: {
		name: "allow html injection",
		type: 'select',
		options: ['hell yeah'],
		update: function(value) {
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
			try {
				eval(value)
			} catch (e) {
				print(e.stack)
				console.error("failed to run sitejs", e)
			}
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
		//update: function(value) {
		//	ChatRoom.nickname = value.substr(0, 50).replace(/\n/g, "  ")
		//},
	},
	/*
this doesn't work because settings are not loaded soon enough
changing that is too much work
websocket: {
		name: "Use Websocket",
		type: 'select',
		options: ['long polling', 'websocket'],
		autosave: false,
	}*/
},
// todo:
// - add support for validation functions
// - read settings immediately and add support for deferred onchange functions

change: function(name, value) {
	var field = fields[name]
	values[name] = value
	if (!field) return
	field.update && field.update(value)
}

<!--/*
}) //*/


<!--/*
}(window)) //*/
