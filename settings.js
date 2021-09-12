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
	chatIgnored: {
			name: "Ignored Users",
			autosave: false,
			type: 'textarea',
			update: function(value) {
				Array.prototype.partition = function(isValid) {
					return this.reduce(([pass, fail], elem) => {
						return isValid(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]];
					}, [[], []]);
				}
				ChatRoom.ignoredUserIds = value.split(',').map(x => parseInt(x)) || []
				// hide all "message-block"s that have the user inside of them
				let msg = document.querySelectorAll('message-block')
				let [ignoredMsgs, unignoredMsgs] = Array
					.from(msg)
					.partition(x => ChatRoom
										.ignoredUserIds
										.includes(parseInt(x.getAttribute('data-uid'))))
				ignoredMsgs.map(x => x.remove())
				// cleanup all messages afterwards
				for (let i = 0; i < unignoredMsgs.length - 1; ++i) {
						if (unignoredMsgs[i].getAttribute('data-uid')
								=== unignoredMsgs[i+1].getAttribute('data-uid')) {
								let contents = unignoredMsgs[i].querySelector('message-contents')
								Array.from(unignoredMsgs[i+1].querySelectorAll('message-part'))
										.map(x => contents.appendChild(x))
								unignoredMsgs[i+1].remove()
								unignoredMsgs[i+1] = unignoredMsgs[i]
						}
				}
				let avatar = document.querySelectorAll('a.avatar-link')
				let [ignoredAvs, unignoredAvs] =Array
						.from(avatar)
						.partition(x => ChatRoom
											 .ignoredUserIds
											 .includes(parseInt(x.getAttribute('data-uid'))))
				ignoredAvs.map(x => x.classList.add('status-ignored'))
				unignoredAvs.map(x => x.classList.remove('status-ignored'))
			},
	},
	chatFilters: {
			name: "Comment Filters",
			autosave: false,
			type: 'textarea',
			update: function(value) {
					ChatRoom.filters = value.split(/\r?\n/)
							.filter(x => x !== '')
							.map(x => new RegExp(x, 'g'))
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
