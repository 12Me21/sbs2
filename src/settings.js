'use strict'

Settings = Object.seal({
	values: Settings.values,
	
	fields: [],
	// .add() can be called at any time
	add(field, priority) {
		this.fields.push(field)
	},
	// .init() will run after all the scripts are loaded, but before the DOM is ready
	init() {
		this.add = function(field) {
			Object.setPrototypeOf(field, SettingProto.prototype)
			field.init()
			if (this.$elem)
				this.insert(field)
		}
		for (let field of this.fields)
			this.add(field)
	},
	// render
	$elem: null,
	draw(elem) {
		this.$elem = elem
		for (let field of this.fields)
			this.insert(field)
	},
	insert(field) {
		let after = null
		for (let x of this.$elem.children) {
			let weight = +x.dataset.order
			if (weight > field.order) {
				after = x
				break
			}
		}
		alert(Object.keys(field).join(","))
		let row = field.draw()
		this.$elem.insertBefore(row, after);
	},
	
	save_all() {
		for (let field of this.fields) {
			//if (field.autosave == false)
			field.change('save')
		}
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
		row.dataset.order = this.order
		
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
SettingProto.prototype.order = 0



Settings.add({
	name: 'theme', label: "Theme", type: 'select',
	options: ['auto', 'light', 'dark'],
	update(value) {
		if ('auto'==value)
			theme_query.onchange(theme_query)
		else
			document.documentElement.dataset.theme = value
		//else
		//delete document.documentElement.dataset.theme
	},
	order: -10000,
})
Settings.add({
	name: 'sitecss', label: "Custom CSS", type: 'textarea',
	autosave: false,
	order: Infinity-2,
	update(value, type) {
		if ('init'!=type)
			$customCSS.textContent = value
	},
})
Settings.add({
	name: 'sitejs', label: "Custom Javascript", type: 'textarea',
	autosave: false,
	order: Infinity-1,
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
})
