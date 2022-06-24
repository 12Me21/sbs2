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
			do_when_ready(()=>{
				$chatTextarea.enterKeyHint = value=='newline' ? "enter" : "send"
			})
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
	sitecss: {
		name: "Custom CSS",
		type: 'textarea',
		autosave: false,
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
Settings.change = function(name, value) {
	let field = this.fields[name]
	if (!field)
		return
	this.values[name] = value
	localStorage.setItem("setting-"+name, JSON.stringify(value))
	field.update && field.update(value)
}

// todo: replace this
Settings.draw = function() {
	let settings = Settings
	let get = {}
	let update = (name)=>{
		let value = get[name]()
		settings.change(name, value)
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
		}
		
		get[name] = ()=>{
			return elem.value
		}
		
		let value = settings.values[name]
		elem.value = value
		
		if (data.autosave != false)
			elem.onchange = ()=>{
				update(name)
			}
		
		elem && row.append(elem)
	})
	return x
}

Object.seal(Settings)
