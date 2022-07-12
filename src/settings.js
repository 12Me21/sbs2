'use strict'

Settings = Object.seal({
	values: Settings.values,
	
	fields: [{
		name: 'theme',
		label: "Theme",
		type: 'select',
		options: ['auto', 'light', 'dark'],
		update(value) {
			if ('auto'==value)
				theme_query.onchange(theme_query)
			else
				document.documentElement.dataset.theme = value
			//else
			//delete document.documentElement.dataset.theme
		},
	}, {
		name: 'nickname',
		label: "Chat Nickname",
		type: 'text',
	}, {
		name: 'chat_markup',
		label: "Chat Markup",
		type: 'select',
		options: ['12y', '12y2', 'plaintext'],
	}, {
		name: 'scroller_anim_type',
		label: "scroll animation method",
		type: 'select',
		options: ['1', '2', '0'],
		update(value) {
			Scroller.anim_type = +value
		},
	}, {
		name: 'chat_enter',
		label: "chat enter key",
		type: 'select',
		options: ['submit', 'newline'],
		update(value) {
			/*			do_when_ready(()=>{
						$chatTextarea.enterKeyHint = value=='newline' ? "enter" : "send"
						})*/
		},
	}, {
		name: 'tts_notify',
		label: "TTS Notify",
		type: 'select',
		options: ['no', 'everyone else', 'yes'],
	}, {
		name: 'tts_volume',
		label: "TTS Volume",
		type: 'range',
		range: [0.0, 1.0],
		default: 0.5,
		step: "0.05", //making this a string to /potentially/ bypass floating point
		notches: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], // 🥴
		update(value, type) {
			TTSSystem.synthParams.volume = value
			if ('change'==type) {
				TTSSystem.cancel()
				if (TTSSystem.placeholderSound)
					TTSSystem.speakMessage({text:"{#uwu",values:{m:'12y'}}, true)
				else
					TTSSystem.speakMessage({text:"example message",values:{m:'plaintext'}}, true)
			}
		}
	}, {
		name: 'tts_speed',
		label: "TTS Speed",
		type: 'range',
		range: [0.5, 2], // (heard range may be narrower)
		step: "0.05",
		default: 1,
		notches: [1],
		update(value, type) {
			TTSSystem.synthParams.rate = value
			if ('change'==type) {
				TTSSystem.cancel()
				TTSSystem.speakMessage({text:"example message",values:{m:'plaintext'}}, true)
			}
		},
	}, {
		name: 'tts_pitch',
		label: "TTS Pitch",
		type: 'range',
		range: [0, 2],
		step: "0.05",
		default: 1,
		notches: [1],
		update(value, type) {
			TTSSystem.synthParams.pitch = value
			if ('change'==type) {
				TTSSystem.cancel()
				TTSSystem.speakMessage({text:"example message",values:{m:'plaintext'}}, true)
			}
		},
	}, {
		name: 'lazy_loading',
		label: "lazy image loading",
		type: 'select',
		options: ['on', 'off'],
		update(value) { // bad
			View.toggle_observer(value=='on')
		},
	}, {
		name: 'big_avatar',
		label: "Big Avatar",
		type: 'select',
		options: ['off', 'on'],
	}, {
		name: 'big_avatar_id',
		label: "Big Avatar Id",
		type: 'text',
	}, {
		name: 'socket_debug',
		label: "socket debug messages",
		type: 'select',
		options: ['no', 'yes'],
	}, {
		name: 'sitecss',
		label: "Custom CSS",
		type: 'textarea',
		autosave: false,
		update(value, type) {
			if ('init'!=type)
				$customCSS.textContent = value
		},
	}, {
		name: 'sitejs',
		label: "Custom Javascript",
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
	} ],
	// .add() can be called at any time
	add(field) {
		this.fields.push(field)
	},
	// .init() will run after all the scripts are loaded, but before the DOM is ready
	init() {
		this.add = function(field) {
			Object.setPrototypeOf(field, SettingProto.prototype)
			field.init()
			if (this.$elem) {
				let row = field.draw()
				this.$elem.append(row)
			}
		}
		for (let field of this.fields)
			this.add(field)
	},
	// render
	$elem: null,
	draw(elem) {
		this.$elem = elem
		for (let field of this.fields) {
			let row = field.draw()
			this.$elem.append(row)
		}
	},
	
	save_all() {
		for (let field of this.fields)
			field.change('save')
	},
})

class SettingProto {
	// this reads the data which was loaded from localstorage earlier,
	// applies the default values, and calls the update functions
	init() {
		let value = this.get_value()
		// default value
		if (value === undefined) {
			if (this.default!==undefined)
				value = this.default
			else if (this.options)
				value = this.options[0]
			else
				value = null
		}
		this.change('init', value)
	}
	
	get_value() {
		return Settings.values[this.name]
	}
	
	// value: json-compatible value
	// event: enum string
	// - 'init' - first time (during page load)
	// - 'change' - changed by user
	// - 'save' - when "save" button clicked 
	change(event, value=this.read()) {
		Settings.values[this.name] = value
		if ('init'!=event)
			localStorage.setItem("setting-"+this.name, JSON.stringify(value))
		this.update && this.update(value, event)
	}
	// draw html input element
	// this should be called AFTER .init()
	draw() {
		let row = document.createElement('div')
		
		let label = row.child('label')
		label.textContent = this.label+": "
		
		let elem
		let type = this.type
		if (type=='select') {
			elem = document.createElement('select')
			for (let option of this.options) {
				let opt = elem.child('option')
				opt.value = option
				opt.textContent = option
			}
		} else if (type=='textarea') {
			elem = document.createElement('textarea')
		} else if (type=='range') {
			elem = document.createElement('input')
			elem.type = 'range'
			elem.min = this.range[0]
			elem.max = this.range[1]
			elem.step = this.step || 'any'
			if (this.notches) {
				let notches = row.child('datalist')
				for (let e of this.notches.concat(this.range)) {
					let opt = notches.child('option')
					opt.value = e
				}
				elem.setAttribute('list', notches.id = `settings_panel__${this.name}_datalist`)
			}
		} else if (type=='text') {
			elem = document.createElement('input')
		} else {
			console.warn('unknown settings type: '+type)
			elem = document.createElement('input')
		}
		// connect label to element (feels nice)
		label.htmlFor = elem.id = `settings_panel__${this.name}`
		this.elem = elem
		// set the initial value
		this.write()
		
		if (this.autosave != false)
			elem.onchange = ev=>{ this.change('change') }
		
		row.append(elem)
		return row
	}
	// read/write html input element
	read() {
		return this.elem.value
	}
	write() {
		this.elem.value = this.get_value()
	}
}
