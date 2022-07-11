'use strict'

Settings.fields = {
	theme: {
		name: "Theme",
		type: 'select',
		options: ['auto', 'light', 'dark'],
		update(value) {
			if (value == 'auto')
				theme_query.onchange(theme_query)
			else
				document.documentElement.dataset.theme = value
			//else
			//delete document.documentElement.dataset.theme
		},
	},
	nickname: {
		name: "Chat Nickname",
		type: 'text',
	},
	chat_markup: {
		name: "Chat Markup",
		type: 'select',
		options: ['12y', '12y2', 'plaintext'],
	},
	scroller_anim_type: {
		name: "scroll animation method",
		type: 'select',
		options: ['1', '2', '0'],
		update(value) {
			Scroller.anim_type = +value
		},
	},
	chat_enter: {
		name: "chat enter key",
		type: 'select',
		options: ['submit', 'newline'],
		update(value) {
/*			do_when_ready(()=>{
				$chatTextarea.enterKeyHint = value=='newline' ? "enter" : "send"
			})*/
		},
	},
	tts_notify: {
		name: "TTS Notify",
		type: 'select',
		options: ['no', 'everyone else', 'yes'],
	},
	// tts_voice: {
	// 	name: "TTS Voice",
	// 	type: 'select',
	// 	options: ['none'],
	// },
	tts_volume: {
		name: "TTS Volume",
		type: 'range',
		range: [0.0, 1.0],
		step: "0.05", //making this a string to /potentially/ bypass floating point
		notches: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], // 🥴
		update(value, type) {
			TTSSystem.synthParams.volume = value
			if (type=='change') {
				TTSSystem.cancel()
				if (TTSSystem.placeholderSound)
					TTSSystem.speakMessage({text:"{#uwu",values:{m:'12y'}}, true)
				else
					TTSSystem.speakMessage({text:"example message",values:{m:'plaintext'}}, true)
			}
		}
	},
	tts_speed: {
		name: "TTS Speed",
		type: 'range',
		range: [0.5, 2], // (heard range may be narrower)
		step: "0.05",
		notches: [1],
		update(value, type) {
			TTSSystem.synthParams.rate = value
			if (type='change') {
				TTSSystem.cancel()
				TTSSystem.speakMessage({text:"example message",values:{m:'plaintext'}}, true)
			}
		},
	},
	lazy_loading: {
		name: "lazy image loading",
		type: 'select',
		options: ['on', 'off'],
		update(value) { // bad
			View.toggle_observer(value=='on')
		},
	},
	big_avatar: {
		name: "Big Avatar",
		type: 'select',
		options: ['off', 'on'],
	},
	big_avatar_id: {
		name: "Big Avatar Id",
		type: 'text',
	},
	socket_debug: {
		name: "socket debug messages",
		type: 'select',
		options: ['no', 'yes'],
	},
	sitecss: {
		name: "Custom CSS",
		type: 'textarea',
		autosave: false,
		update(value, type) {
			if (type!='init')
				$customCSS.textContent = value
		},
	},
	sitejs: {
		name: "Custom Javascript",
		type: 'textarea',
		autosave: false,
		//todo: maybe highlight when changed, to notify user that they need to save manually?
		// todo: js console tab thing
		update(value, type) {
			try {
				eval(value)
			} catch (e) {
				console.error("failed to run sitejs", e)
				print(e)
				print("error in sitejs ^")
			}
		},
	},
},

Settings.early = function() {
	Object.for(this.fields, (field, name)=>{
		let value = this.values[name]
		if (value === undefined) {
			if (field.options)
				value = field.options[0]
			else
				value = null
		}
		this.values[name] = value
		if (field.update)
			field.update(value, 'init')
	})
},

// change a setting

// type:
// - 'init' - first time (during page load)
// - 'change' - changed by user
// - 'save' - when "save" button clicked 
Settings.change = function(name, value, type) {
	let field = this.fields[name]
	if (!field)
		return
	this.values[name] = value
	if (type!='init')
		localStorage.setItem("setting-"+name, JSON.stringify(value))
	field.update && field.update(value, type)
}

Settings.update_all = function() {
	Object.for(this.fields, (data, name)=>{
		this.change(name, data.read(), 'save')
	})
}

// todo: replace this
Settings.draw = function() {
	let f = document.createDocumentFragment()
	Object.for(this.fields, (data, name)=>{
		let row = document.createElement('div')
		f.append(row)
		
		let label = row.child('label')
		label.textContent = data.name+": "
		
		let elem
		let type = data.type
		if (type=='select') {
			elem = document.createElement('select')
			for (let option of data.options) {
				let opt = elem.child('option')
				opt.value = option
				opt.textContent = option
			}
		} else if (type=='textarea') {
			elem = document.createElement('textarea')
		} else if (type=='text') {
			elem = document.createElement('input')
		} else if (type=='range') {
			elem = document.createElement('input')
			elem.type = 'range'
			elem.min = data.range[0]
			elem.max = data.range[1]
			elem.step = data.step || 'any'
			if (data.notches) {
				let notches = row.child('datalist')
				for (let e of data.notches.concat(data.range)) {
					let opt = notches.child('option')
					opt.value = e
				}
				elem.setAttribute('list', notches.id = `settings_panel__${name}_datalist`)
			}
		}
		
		// connect label to element (feels nice)
		elem.id = `settings_panel__${name}`
		label.htmlFor = elem.id
		
		data.read = ()=>elem.value
		
		let value = this.values[name]
		elem.value = value
		
		if (data.autosave != false)
			elem.onchange = ev=>{
				this.change(name, data.read(), 'change')
			}
		
		elem && row.append(elem)
	})
	return f
}

Object.seal(Settings)
