'use strict'

Settings.fields = {
	theme: {
		name: "Theme",
		type: 'select',
		options: ['auto', 'light', 'dark'],
		/*done_early: true,*/
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
		step: 1/20,
		notches: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], // 🥴
		update(value, event) {
			TTSSystem.synthParams.volume = value
			if (event && event.type == 'change') {
				TTSSystem.cancel()
				if (TTSSystem.placeholderSound) TTSSystem.speakMessage({text:"{#uwu",values:{m:'12y'}}, true)
				else TTSSystem.speakMessage({text:"example message",values:{m:'plaintext'}}, true)
			}
		}
	},
	tts_speed: {
		name: "TTS Speed",
		type: 'range',
		range: [0.5, 2], // (heard range may be narrower)
		step: 1/20,
		notches: [1],
		update(value, event) {
			TTSSystem.synthParams.rate = value
			if (event && event.type == 'change') {
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
		done_early: true,
		update(value) {
			$customCSS.textContent = value
		},
	},
	sitejs: {
		name: "Custom Javascript",
		type: 'textarea',
		autosave: false,
		//todo: maybe highlight when changed, to notify user that they need to save manually?
		// todo: js console tab thing
		update(value) {
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
		if (field.update && !field.done_early)
			field.update(value)
	})
},

// change a setting after load
Settings.change = function(name, value, event) {
	let field = this.fields[name]
	if (!field)
		return
	this.values[name] = value
	localStorage.setItem("setting-"+name, JSON.stringify(value))
	field.update && field.update(value, event)
}

// todo: replace this
Settings.draw = function() {
	let settings = Settings
	let get = {}
	let update = (name, event)=>{
		let value = get[name]()
		settings.change(name, value, event)
	}
	let x = {
		elem: document.createDocumentFragment(),
		update_all() {
			Object.for(get, (func, key)=>{
				update(key)
			})
		},
	}
	Object.for(settings.fields, (data, name)=>{
		let row = document.createElement('div')
		x.elem.append(row)
		let type = data.type
		let label = row.child('label')
		label.textContent = data.name+": "
		let elem
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
			elem.min = data.range[0]; elem.max = data.range[1]
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
		
		get[name] = ()=>{
			return elem.value
		}
		
		let value = settings.values[name]
		elem.value = value
		
		if (data.autosave != false)
			elem.onchange = (event)=>{
				update(name, event)
			}
		
		elem && row.append(elem)
	})
	return x
}

Object.seal(Settings)
