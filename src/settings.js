'use strict'

Settings = NAMESPACE({
	values: Settings.values,
	groups: {__proto__:null},
	tabs: null,
	
	fields: [],
	// .add() can be called at any time
	add(field) {
		this.fields.push(field)
	},
	// .init() will run after all the scripts are loaded, but before the DOM is ready
	init() {
		this.add = function(field, push=true) {
			Object.setPrototypeOf(field, SettingProto.prototype)
			field.init()
			if (this.$elem)
				this.insert(field)
			if (push)
				this.fields.push(field)
		}
		for (let field of this.fields)
			this.add(field, false)
	},
	// render
	$elem: null,
	draw(elem) {
		this.tabs = new Tabs([
			{name:'default', label:'s', panel:$localSettings},
			{name:'debug', label:'d', panel:$debugTab},
		], $settings_tabs, 'settings')
		this.$elem = elem
		for (let field of this.fields)
			this.insert(field)
	},
	insert(field) {
		let group = field.group
		let panel = this.$elem
		if (group) {
			panel = this.groups[group]
			if (!panel) {
				panel = document.createElement('div')
				panel.className += 'local-settings'
				$settings_panels.appendChild(panel)
				this.tabs.add({name:group, label:group, panel})
			}
		}
		let after = null
		for (let x of panel.children) {
			let weight = +x.dataset.order
			if (weight > field.order) {
				after = x
				break
			}
		}
		let row = field.draw()
		panel.insertBefore(row, after)
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
		if ('init'!=event && 'update'!=event) {
			localStorage.setItem("setting-"+this.name, JSON.stringify(value))
			if (this.autosave==false)
				return
		}
		this.update && this.update(value, event)
	}
	// draw html input element
	// this should be called AFTER .init()
	draw() {
		let row = document.createElement('div')
		row.dataset.order = this.order
		
		let label = document.createElement('label')
		row.append(label)
		label.textContent = this.label+": "
		
		let elem
		let type = this.type
		if (type=='select') {
			elem = document.createElement('select')
			this.elem = elem
			this.redraw_options = ()=>{
				this.elem.fill()
				let found = false
				let val = this.get_value()
				for (let option of this.options) {
					let opt = document.createElement('option')
					this.elem.add(opt)
					opt.value = option
					opt.text = option
					if (option === val)
						found = true
				}
				// add placeholder option if value is missing from options list.. might cause problems though..
				if ('string'==typeof val && !found) {
					let opt = document.createElement('option')
					this.elem.add(opt)
					opt.value = val
					opt.text = val+" ?"
				}
				this.write()
			}
			this.redraw_options()
		} else if (type=='textarea') {
			elem = document.createElement('textarea')
		} else if (type=='code') {
			elem = document.createElement('textarea')
			elem.classList.add('code-textarea')
		} else if (type=='range') {
			elem = document.createElement('input')
			elem.type = 'range'
			elem.min = this.range[0]
			elem.max = this.range[1]
			elem.step = this.step || 'any'
			if (this.notches) {
				let notches = document.createElement('datalist')
				row.append(notches)
				for (let e of this.notches.concat(this.range)) {
					let opt = document.createElement('option')
					opt.value = e
					notches.append(opt)
				}
				elem.setAttribute('list', notches.id = `settings_panel__${this.name}_datalist`)
			}
		} else if (type=='text') {
			elem = document.createElement('input')
		} else {
			console.warn('unknown settings type: '+type)
			elem = document.createElement('input')
		}
		
		// connect label to element (feels nice)   (does not fele nice :(
		//label.htmlFor = elem.id = `settings_panel__${this.name}`
		this.elem = elem
		// set the initial value
		this.write()
		
		//if (this.autosave != false)
		elem.onchange = ev=>{ this.change('change') }
		if (this.autosave == false) {
			let btn = document.createElement('button')
			btn.textContent = "update"
			btn.onclick = ev=>{
				this.change('update')
			}
			row.append(btn)
		}
		
		if (this.render)
			this.render(row, elem, label)
		
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
	name: 'sitecss', label: "Custom CSS", type: 'code',
	autosave: false,
	group: 'css',
	order: Infinity-2,
	render(row, elem, label) {
		let btn = document.createElement('button')
		btn.textContent = 'reload css'
		btn.onclick = ev=>{
			for(let sheet of document.styleSheets)
				if(sheet.href)
					sheet.ownerNode.href+="#"
		}
		label.replaceWith(btn)
	},
	update(value, type) {
		if ('init'!=type)
			$customCSS.textContent = value
	},
})
Settings.add({
	name: 'sitejs', label: "Custom Javascript", type: 'code',
	autosave: false,
	group: 'js',
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
Settings.add({
	name: 'html_inject', label: 'html to inject', type: 'code',
	order: 100000,
})
