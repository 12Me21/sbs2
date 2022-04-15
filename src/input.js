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

class Form {
	constructor(p) {
		this.fields = p.fields // list of fields
		this.in_fields = [] // list of input fields
		
		this.map = {} // map of name -> item in this.fields
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
			this.map[name] = field
			
			let input = new (INPUTS[type])(inp)
			this.inputs[name] = input
			if (opt.default===undefined)
				input.set(opt.default)
			
			if (!opt.output)
				this.in_fields.push(field)
			
			let label = body.createChild('label')
			label.htmlFor = input.html_id
			label.textContent = opt.label+":"
			label.className += ' label'
			input.elem.className += ' field'
			if (opt.span) {
				label.className += ' wide'
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
			this.inputs[name].set(value)
		}
	}
	get() {
		return this.in_fields.reduce((a, [name])=>{
			a[name] = this.inputs[name].get()
			return a
		}, {})
	}
	set(data) {
		for (let [name, type, opt] of this.fields) {
			let value = data[name]
			if (value===undefined) value = opt.default
			if (value===undefined) value = null
			this.inputs[name].set(value)
		}
	}
	set_some(data) {
		for (let [name, type, opt] of this.fields) {
			let value = data[name]
			if (value!==undefined)
				this.inputs[name].set(value)
		}
	}
	// maybe shouldn't be in this class
	to_query(p) {
		let params = {}
		for (let [name, type, opt] of this.fields) {
			let value = p[name]
			if (value != null && opt.convert)
				value = opt.convert.encode(value)
			if (value != null) {
				let key = opt.param
				if (value === true)
					params[key] = ""
				else if (value !== false)
					params[key] = value
			}
		}
		return params
	}
	from_query(query) {
		let p = {}
		for (let [name, type, opt] of this.fields) {
			let value = query[opt.param]
			if (opt.convert)
				value = opt.convert.decode(value)
			if (value != null)
				p[name] = value
		}
		return p
	}
}

// for converting between query parameters and DATA
// remember query params can be strings or `true`, or null
// `decode` MUST return the correct type for DATA, or null
const CONVERT = {
	flag: {
		encode: x => x ? true : null,
		decode: x => x != null,
	},
	number_list: {
		encode: x => x ? x.join(",") : null,
		decode: x => typeof x == 'string' ? x.split(",").map(x=>Number(x)) : null, // todo: filter if values aren't valid numbers, allow spaces and other separators? etc
	},
	number: {
		encode: x => x != null ? String(x) : null,
		decode: x => typeof x == 'string' ? Number(x) : null,
	},
	string: {
		encode: x => x != null ? x : null,
		decode: x => typeof x == 'string' ? x : null,
	},
	date: {
		encode: x => x != null ? x.toISOString() : null,
		decode: x => typeof x == 'string' ? new Date(x) : null, // todo: validate the date (how?)
	},
	range: {
		encode: x => {
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
		},
		decode: x => {
			//from https://github.com/randomouscrap98/newsbs/blob/42b4c5b383f738f6b492b77d9a7d5d0d92f56761/index.js#L1341
			if (typeof x != 'string')
				return null
			let [match, min, max] = /^(\d*)-(\d*)$/.rmatch(x)
			if (match) {
				return {
					min: min ? Number(min) : null,
					max: max ? Number(max) : null,
				} // what if number parse fails? should be null i think
			} else {
				return {ids: x.split(",").map(x=>Number(x))}
			}
		}
	},
}

const INPUTS = (()=>{
	function elem(x) {
		return document.createElement(x)
	}
	
	class GenericInput {
		constructor () {
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
			get() {
				let v = this.input.value
				if (this.options.includes(v))
					return v
				if (this.default !== undefined)
					return this.default
				return null
			}
			// todo: proper null
			set(v) {
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
		// type: Boolean
		checkbox: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.input.type = 'checkbox'
				this.elem = this.input
				this.input.onchange = this._onchange.bind(this)
			}
			get() {
				return this.input.checked
			}
			set(v) {
				this.input.checked = v
			}
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
			get() {
				if (this.confirm) {
					let v1 = this.input.value
					let v2 = this.input2.value
					if (v1 == v2)
						return v1 || null
					else
						return null // failed (todo: different return value?)
				} else {
					return this.input.value || null
				}
			}
			set(v) {
				this.input.value = v || ""
				if (this.confirm) {
					this.input2.value = ""
				}
			}
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
			get() {
				if (this.input.value == "")
					return null
				return CONVERT.range.decode(this.input.value)
			}
			set(v) {
				this.input.value = v==null ? "" : CONVERT.range.encode(v)
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
			get() {
				let v = this.input.value
				return v=="" ? null : Number(v) // and of course, this can also return NaN
			}
			set(v) {
				this.input.value = v==null ? "" : String(v)
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
			get() {
				if (this.input.value=="")
					return null
				return this.input.value.split(/[,\s]/g).filter(x=>x.length!=0).map(x=>Number(x)) // todo: make sure the numbers like, exist
			}
			set(v) {
				if (v != null)
					this.input.value = v.join(',')
				else
					this.input.value = ""
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
			get() {
				return this.input.value.split(/[\s]/g).filter(x=>x.length!=0)
			}
			set(v) {
				this.input.value = v==null ? "" : v.join(' ')
			}
		},
		// type:
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
			get() {
				// we can't use the .valueAsNumber or .valueAsDate attributes because these read the times in utc
				let [m1, year, month, day] = /(\d+)-(\d+)-(\d+)/.rmatch(this.input1.value)
				if (!m1)
					return null
				let [m2, hour, minute, second] = /(\d+):(\d+)(?::([\d.]+))?/.rmatch(this.input2.value)
				if (!m2)
					hour = minute = second = 0
				return new Date(year, month-1, day, hour, minute, Math.floor(second || 0))
			}
			set(v) {
				if (v) {
					function str(x, len) {
						return String(x).padStart(len, "0")
					}
					this.input1.value =
						str(v.getFullYear(), 4)+"-"+
						str(v.getMonth()+1, 2)+"-"+
						str(v.getDate(), 2)
					this.input2.value =
						str(v.getHours(), 2)+":"+
						str(v.getMinutes(), 2)+":"+
						str(v.getSeconds(), 2)
				} else {
					this.input1.value = ""
					this.input2.value = ""
				}
			}
		},
		// type:
		category: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('select')
				this.input.id = this.html_id
				this.elem = this.input
				this.input.onchange = this._onchange.bind(this)
				//this.update()
			}
			
			// TODO: this is a hack. we need a way for fields to have extra data associated with them,
			// such as the permission editor's user map and this category tree
			set([value, tree]) {
				let option = (value, text)=>{
					let x = elem('option')
					x.textContent = text
					x.value = value
					return x
				}
				
				this.input.fill(option("", "-- Select Category --"))
				if (!tree) return // not ready yet :(
				
				// recursive function
				// ⚠ if there are cycles in the data, this will freeze
				let build_list = (node, ret, depth)=>{
					ret.push({id: node.id, text: ">".repeat(depth)+" "+node.name})
					if (node.children)
						for (let child of node.children)
							build_list(child, ret, depth+1)
				}
				
				let list = []
				tree && build_list(tree, list, 0)
				if (value!=null) {
					let selected = list.find(item=>item.id==value)
					if (!selected) {
						this.input.append(option(value, "Unknown category: "+value))
					}
				}
				this.input.append(...list.map(item=>option(item.id, item.text)))
				this.input.value = value==null ? "" : value
			}
			get() {
				if (this.input.value=="")
					return null
				return +this.input.value
			}
		},
		// type: File/null
		file: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.type = 'file'
				if (p.accept)
					this.input.accept = p.accept
				this.input.onchange = this._onchange.bind(this)
				this.elem = this.input
			}
			get() {
				return this.input.files[0] || null
			}
			set(v) {
				if (v==null)
					this.input.value = ""
				else
					throw 'cant set file like that'
			}
		},
		
		// type: String/null
		output: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('output')
				this.elem = this.input
			}
			set(v) {
				this.input.value = v==null ? "" : v
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
			set(v) {
				this.input.fill(v ? Draw.entity_title_link(v) : null)
			}
		},
	}
})()
