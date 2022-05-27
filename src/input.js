// I really hate this file.

// TODO:
// lots of things
// improve styling (esp element widths)
// add onchange notifiers
// allow inserting other things into rendered forms (separators, section labels, etc.)
// output/readonly fields?

/*class Template {
	constructor(str) {
		this.template = document.createElement('template')
		this.template.innerHTML = str
	}
	copy(...args) {
		return new Proxy(
			this.template.content.cloneNode(true),
			{ get: (target, prop) => target.getElementById(prop) },
		)
	}
}*/

// query parameter format:

// ?<param1>&<param2>
// param consists of either
// "<key>=<value>" - value is a String
// "<key>" - value is Boolean `true`

// when encoding query parameters
// boolean values are encoded as the presence or absense of a field
// all other types are converted to string

// conversions:
// to read the value of an input: input -> DATA
// to read query parameters: query -> DATA
// to set the value of a form: DATA -> input
// to write query parameters: DATA -> query

// the conversions between input and DATA can be done in the input classes when reading/writing values

// DATA must contain the correct type

// maybe instead of specifying the layout in Form, we just provide a list of locations of where to insert the fields. this is necessary for, ex: the page title input which is outside the main element

// todo: nullability
// sometimes we want fields to return null when empty, but other times we don't.

class Form {
	constructor(p) {
		this.fields = p.fields // list of fields
		this.in_fields = [] // list of input fields
		
		this.inputs = {} // map of name -> INPUT instances
		
		this.elem = document.createElement('form-table')
		let body = this.elem
		
		for (let field of this.fields) {
			// name: field name
			// type: field type
			// opt: field options (ex: label)
			// inp: options for the input element itself (ex: list for <select>)
			// wait how do we change a select's values afterwards then?
			let [name, type, opt, inp={}] = field
			
			let input = new INPUTS[type](inp)
			this.inputs[name] = input
			input.value = opt.default
			
			if (!opt.output)
				this.in_fields.push(input)
			
			let lc = body.createChild('div')
			let label = lc.createChild('label')
			label.htmlFor = input.html_id
			label.textContent = opt.label+":"
			lc.className += ' label'
			input.elem.className += ' field'
			if (opt.span) {
				lc.className += ' wide'
				input.elem.className += ' wide'
			}
			body.append(input.elem)
		}
		Object.seal(this)
	}
	destroy() {
		this.elem.fill()
	}
	reset() {
		for (let [name, type, opt] of this.fields) {
			let value = opt.default!==undefined ? opt.default : null
			this.inputs[name].value = value
			this.inputs[name].write()
		}
	}
	read() {
		for (let [name] of this.fields)
			this.inputs[name].read()
	}
	write() {
		for (let [name] of this.fields)
			this.inputs[name].write()
	}
	get() {
		let a = {}
		for (let [name] of this.fields)
			a[name] = this.inputs[name].value
		return a
	}
	set(data) {
		for (let [name, type, opt] of this.fields) {
			let value = data[name]
			if (value===undefined) value = opt.default
			if (value===undefined) value = null
			this.inputs[name].value = value
		}
	}
	set_some(data) {
		for (let [name, type, opt] of this.fields) {
			let value = data[name]
			if (value!==undefined)
				this.inputs[name].value = value
		}
	}
	// maybe shouldn't be in this class
	to_query() {
		let params = {}
		for (let [name, type, opt] of this.fields) {
			let value = this.inputs[name].to_query()
			if (value != null) {
				let key = opt.param
				params[key] = value
			}
		}
		return params
	}
	from_query(query) {
		for (let [name, type, opt] of this.fields) {
			let value = query[opt.param]
			this.inputs[name].from_query(value)
		}
	}
}

const INPUTS = (()=>{
	function elem(x) {
		return document.createElement(x)
	}
	
	class GenericInput {
		constructor() {
			this.html_id = unique_id()
		}
		toString() {
			return `Input.${this.type}()`
		}
		_onchange() {
			if (this.onchange) {
				this.onchange(this.get())
			}
		}
	}
	
	let x = 0
	function unique_id() {
		x++
		return "input-"+x
	}
	
	return {
		// type: String/null(?)
		select: class extends GenericInput {
			// todo: option to reject setting invalid values?
			// probably ALL of these inputs should have settings for
			// whether to allow null and allow other invalid values
			constructor(p) {
				super()
				this.input = elem('select')
				this.input.id = this.html_id
				this.input.append(...p.options.map(opt => {
					let o = elem('option')
					o.value = opt[0]
					o.append(opt[1])
					return o
				}))
				this.default = p.default
				this.extra = elem('option')
				this.options = p.options.map(opt=>opt[0])
				this.elem = this.input
				this.input.onchange = this._onchange.bind(this)
			}
			read() {
				let v = this.input.value
				if (this.options.includes(v))
					this.value = v
				else if (this.default !== undefined)
					this.value = this.default
				else
					this.value = null
			}
			// todo: proper null
			write() {
				let v = this.value
				if (!this.options.includes(v)) {
					if (this.default !== undefined)
						v = this.default
					else {
						this.extra.value = v==null ? "" : v
						this.extra.textContent = "Unknown value: "+v
						this.input.prepend(this.extra)
						this.input.value = this.extra.value
						return
					}
				}
				this.extra.remove()
				this.input.value = v
			}
		},
		// type: Boolean (should this just be true/null?)
		checkbox: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.input.type = 'checkbox'
				this.elem = this.input
				this.input.onchange = this._onchange.bind(this)
			}
			read() {
				this.value = this.input.checked
			}
			write() {
				this.input.checked = this.value
			}
			to_query() { return this.value ? "" : null }
			from_query(s) { this.value = s != null }
		},
		// type: String/null
		text: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.input.placeholder = "text"
				if (p.type == 'password')
					this.input.type = 'password'
				else if (p.type == 'email')
					this.input.type = 'email'
				this.elem = this.input
				this.input.onchange = this._onchange.bind(this)
				if (p.confirm == true) {
					this.confirm = true
					this.elem = document.createElement('div')
					this.input2 = elem('input')
					this.input2.placeholder = "(repeat)"
					this.input2.type = this.input.type
					this.elem.append(this.input, this.input2)
				}
			}
			read() {
				if (this.confirm) {
					let v1 = this.input.value
					let v2 = this.input2.value
					if (v1 == v2)
						this.value = v1 || null
					else
						this.value = null // failed (todo: different return value?)
				} else {
					this.value = this.input.value || null
				}
			}
			write() {
				this.input.value = this.value || ""
				if (this.confirm)
					this.input2.value = ""
			}
			to_query() { return this.value }
			from_query(s) { this.value = s }
		},
		// type: {min: Number/null, max: Number/null} / {ids: [Number...]} / null
		// formats: "min-max"  "min-"  "-max"  "id1,id2,..."
		range: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.input.placeholder = "min-max or id list"
				this.elem = this.input
				this.input.onchange = this._onchange.bind(this)
			}
			decode(x) {
				if (x=="" || x==null) {
					this.value = null
					return
				}
				let [match, min, max] = /^(\d*)-(\d*)$/.rmatch(x)
				if (match) {
					this.value = {
						min: min ? Number(min) : null,
						max: max ? Number(max) : null,
					} // what if number parse fails? should be null i think
				} else {
					this.value = {ids: x.split(",").map(x=>Number(x))}
				}
			}
			encode() {
				let x = this.value
				if (x == null)
					return null
				if (x.ids!=null)
					return x.ids.join(",")
				if (x.min!=null && x.max!=null)
					return `${x.min}-${x.max}`
				if (x.min!=null)
					return `${x.min}-`
				if (x.max!=null)
					return `0-${x.max}`
				return null // idk
			}
			read() {
				this.decode(this.input.value)
			}
			write() {
				this.input.value = this.encode() || ""
			}
			to_query() {
				return this.encode()
			}
			from_query(s) {
				this.decode(s)
			}
		},
		// type: String/null
		textarea: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('textarea')
				this.input.id = this.html_id
				this.elem = this.input
				this.input.onchange = this._onchange.bind(this)
			}
			read() {
				this.value = this.input.value || null
			}
			write() {
				this.input.value = this.value || ""
			}
			to_query() {
				return this.value
			}
			from_query(s) {
				this.value = s
			}
		},
		// type: Number/null
		number: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.elem = this.input
				this.input.type = 'number'
				this.input.onchange = this._onchange.bind(this)
			}
			read() {
				// todo: validate? maybe we need a separate invalid/null state
				this.value = this.input.value=="" ? null : Number(this.input.value)
			}
			write() {
				this.input.value = this.value==null ? "" : this.value
			}
			to_query() {
				return this.value==null ? null : String(this.value)
			}
			from_query(s) {
				this.value = s==null ? null : Number(s)
			}
		},
		// type: [Number...]/null
		number_list: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.input.pattern = " *(\\d+( *[, ] *\\d+)*)? *"
				this.elem = this.input
				this.input.placeholder = "list of numbers"
				this.input.onchange = this._onchange.bind(this)
			}
			read() {
				let m = this.input.value.match(/[^,\s]+/g)
				if (m)
					this.value = m.map(x=>Number(x)) // todo: make sure the numbers like, exist
				else
					this.value = null
			}
			write() {
				if (this.value == null)
					this.input.value = ""
				else
					this.input.value = this.value.join(",")
			}
			to_query() { return this.value ? this.value.join(",") : null }
			from_query(s) {
				if (s) // todo: filter if values aren't valid numbers, allow spaces and other separators? etc
					this.value = s.match(/[^,\s]+/g).map(x=>Number(x))
				else
					this.value = null
			}
		},
		// type: [String...]/null
		word_list: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.placeholder = "list of words"
				this.elem = this.input
				this.input.onchange = this._onchange.bind(this)
			}
			read() {
				let words = this.input.value.match(/[^\s]+/g)
				this.value = words==null ? null : words
			}
			write() {
				this.input.value = this.value==null ? "" : this.value.join(" ")
			}
		},
		// type:  BROKEN
		permissions: class extends GenericInput {
			constructor() {
				super()
				this.elem = elem('div')
				this.elem.id = this.html_id //todo: put a hidden <input> element or something?
				this.input = Draw.user_selector()
				let table = elem('table')
				table.className += " permission-table"
				let header = table.createChild('thead').createChild('tr')
				header.createChild('th')
				header.createChild('th')
				header.createChild('th').textContent = "View"
				header.createChild('th').textContent = "Reply"
				header.createChild('th').textContent = "Edit"
				header.createChild('th').textContent = "Delete"
				this.body = table.createChild('tbody')
				this.body.className += " permission-users"
				
				this.elem.append(table)
				this.elem.append(this.input.elem)
				
				this.input.onchange = (user)=>{
					this._add_row(user, "rc")
				}
				// todo: fire the input onchange event
			}
			_add_row(user, perm) {
				this.body.append(Draw.permission_row(user, perm))
			}
			// TODO:
			set([perms, users]) {
				this.body.fill()
				let d = false
				Object.for(perms, (perm, uid) => {
					uid = +uid
					this._add_row(users[uid], perm)
					if (uid==0)
						d = true
				})
				if (!d)
					this._add_row({Type:'user', id:0}, "")
			}
			get() {
				let ret = {}
				for (let row of this.body.childNodes) {
					let perm = ''
					for (let check of row.querySelectorAll('input')) {
						if (check.checked)
							perm += check.value
					}
					ret[row.dataset.id] = perm
				}
				return ret
			}
		},
		// type: Date/null
		// dates are interpreted in local time.
		// uses 2 <input>s
		// considered "empty" if date input is blank. time input is optional and defaults to 00:00:00
		date: class extends GenericInput {
			constructor(p) {
				super()
				this.elem = elem('div')
				
				this.input1 = elem('input')
				this.input1.id = this.html_id
				this.input1.type = 'date'
				this.elem.append(this.input1)
				
				this.input2 = elem('input')
				this.input2.type = 'time'
				//this.input2.step = "1"
				this.elem.append(this.input2)
				
				this.input1.onchange = this._onchange.bind(this)
				this.input2.onchange = this._onchange.bind(this)
			}
			read() {
				// we can't use the .valueAsNumber or .valueAsDate attributes because these read the times in utc
				let [m1, year, month, day] = /(\d+)-(\d+)-(\d+)/.rmatch(this.input1.value)
				if (!m1) {
					this.value = null
				} else {
					let [m2, hour, minute, second] = /(\d+):(\d+)(?::([\d.]+))?/.rmatch(this.input2.value)
					if (!m2)
						hour = minute = second = 0
					this.value = new Date(year, month-1, day, hour, minute, Math.floor(second || 0))
				}
			}
			write() {
				let v = this.value
				let date="", time=""
				function str(x, len=2) {
					return String(x).padStart(len, "0")
				}
				if (v) {
					date =
						str(v.getFullYear(), 4)+"-"+
						str(v.getMonth()+1)+"-"+
						str(v.getDate())
					time =
						str(v.getHours())+":"+
						str(v.getMinutes())+":"+
						str(v.getSeconds())
				}
				this.input1.value = date
				this.input2.value = time
			}
			to_query() { return this.value ? this.value.toISOString() : null }
			from_query(s) {
				if (s)
					this.value = new Date(s) // todo: validate the date (how?)
				else
					this.value = null
			}
		},
		// type: String/null
		output: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('output')
				this.elem = this.input
			}
			write() {
				this.input.value = this.value || ""
			}
			read() {
				this.value = this.input.value || null
			}
		},
		// type: User/null
		user_output: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('div')
				this.input.className = 'bar rem1-5'
				this.elem = this.input
			}
			write() {
				this.input.fill(this.value ? Draw.entity_title_link(this.value) : null)
			}
		},
	}
})()
