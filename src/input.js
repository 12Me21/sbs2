'use strict'
// I really hate this file.

// TODO:
// lots of things
// improve styling (esp element widths)
// add onchange notifiers
// allow inserting other things into rendered forms (separators, section labels, etc.)
// output/readonly fields?

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
		this.inputs = {__proto__:null} // map of name -> INPUT instances
		
		this.elem = document.createElement('form-table')
		let body = this.elem
		
		for (let [name, type, opt] of p.fields) {
			// name: field name
			// type: field type
			// opt: field options (ex: label)
			// inp: options for the input element itself (ex: list for <select>)
			// wait how do we change a select's values afterwards then?
			let input = new INPUTS[type](opt)
			input.name = name
			this.inputs[name] = input
			input.draw()
			
			let lc = document.createElement('div')
			lc.className = 'label'
			body.append(lc)
			let label = document.createElement('label')
			lc.append(label)
			label.htmlFor = input.html_id
			label.textContent = opt.label+":"
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
		this.for(input=>{
			input.reset()
			input.write()
		})
	}
	read() {
		this.for(input=>input.read())
	}
	write() {
		this.for(input=>input.write())
	}
	for(fn) {
		Object.for(this.inputs, fn)
	}
	get() {
		let a = {}
		this.for((input, name)=>{
			a[name] = input.value
		})
		return a
	}
	set(data) {
		this.for((input, name)=>{
			input.value = data[name]
		})
	}
	set_some(data) {
		this.for((input, name)=>{
			let value = data[name]
			if (value!==undefined)
				input.value = value
		})
	}
	// maybe shouldn't be in this class
	to_query() {
		let params = {}
		this.for(input=>{
			let key = input.p.param
			if (key) {
				let q = input.to_query()
				if (q!=null)
					params[key] = q
			}
		})
		return params
	}
	from_query(query) {
		this.for((input, name)=>{
			let key = input.p.param
			if (key) {
				let value = query[key]
				if (value!==undefined)
					input.from_query(value)
				else
					input.reset()
			}
		})
	}
}

class GenericInput {
	constructor(p) {
		this.p = p
		this.value = p.default
		this.default = p.default
		this.html_id = GenericInput.unique_id()
	}
	toString() {
		return `Input.${this.type}()`
	}
	attach_onchange() {
		if (!this.auto)
			return null
		return e=>{
			this.read()
			if (this.p.onchange)
				this.p.onchange(this.value)
		}
	}
	static unique_id() {
		this.html_id++
		return "input-"+this.html_id
	}
	reset() {
		if (this.default===undefined)
			this._value = null
		else
			//throw new TypeError("tried to reset an input without a default value")
			this._value = this.default
	}
	get value() {
		return this._value
	}
	set value(v) {
		if (v===undefined) {
			this.reset()
		} else
			this._value = v
	}
}
GenericInput.html_id = 0
function elem(x) {
	return document.createElement(x)
}

const INPUTS = {
	// type: String/null(?)
	select: class extends GenericInput {
		// todo: option to reject setting invalid values?
		// probably ALL of these inputs should have settings for
		// whether to allow null and allow other invalid values
		constructor(p) {
			super(p)
			this.options = p.options
			this.allow_extra = p.allow_extra
		}
		draw() {
			this.elem = this.input = elem('select')
			this.input.onchange = this.attach_onchange()
			this.input.id = this.html_id
			// draw options
			function option(value, label) {
				let o = document.createElement('option')
				o.value = value
				o.append(label)
				return o
			}
			let labels = this.p.option_labels || this.options
			this.input.append(...labels.map((label, i)=>option(i, label)))
			this.extra_option = option('extra', "")
		}
		read() {
			let v = this.input.value
			if (v=='extra') {
				this.value = this.extra_value
				return
			} else {
				v = v|0
				if (v>=0 && v<this.options.length) {
					this.value = this.options[v]
					return
				}
			}
			this.value = this.default
		}
		write() {
			let v = this.value
			let i = this.options.indexOf(v)
			if (i>=0) {
				this.extra_option.remove()
				this.input.value = i
			} else {
				this.extra_value = v
				try {
					this.extra_option.textContent = "Unknown value: "+v
				} catch (e) {
					print("input dropdown error invalid value??", e)
					this.extra_option.textContent = "Unknown value: ???"
				}
				this.input.append(this.extra_option)
				this.input.value = "extra"
			}
		}
	},
	// type: Boolean (should this just be true/null?)
	checkbox: class extends GenericInput {
		constructor(p) {
			super(p)
		}
		draw() {
			this.elem = this.input = document.createElement('input')
			this.input.id = this.html_id
			this.input.type = 'checkbox'
			this.input.onchange = this.attach_onchange()
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
			super(p)
			this.confirm = p.confirm
			this.type = p.type
		}
		draw() {
			this.elem = this.input = elem('input')
			this.input.id = this.html_id
			this.input.placeholder = "text"
			if (this.type == 'password')
				this.input.type = 'password'
			else if (this.type == 'email')
				this.input.type = 'email'
			this.input.onchange = this.attach_onchange()
			if (this.confirm == true) {
				this.confirm = true
				this.elem = document.createElement('div')
				this.input2 = elem('input')
				this.input2.placeholder = "(repeat)"
				this.input2.type = this.input.type
				this.input2.onchange = this.input.onchange
				this.elem.append(this.input, this.input2)
			}
		}
		read() {
			let v = this.input.value
			if (this.confirm) {
				if (v != this.input2.value)
					v = null
			}
			if (v=="")
				v = null
			this.value = v
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
			super(p)
		}
		draw() {
			this.elem = this.input = elem('input')
			this.input.id = this.html_id
			this.input.placeholder = "min-max or id list"
			this.input.onchange = this.attach_onchange()
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
			super(p)
		}
		draw() {
			this.elem = this.input = elem('textarea')
			this.input.id = this.html_id
			this.input.onchange = this.attach_onchange()
		}
		read() {
			let v = this.value
			if (v=="")
				v = null
			this.value = v
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
			super(p)
		}
		draw() {
			this.elem = this.input = elem('input')
			this.input.id = this.html_id
			this.input.type = 'number'
			this.input.onchange = this.attach_onchange()
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
			super(p)
		}
		draw() {
			this.elem = this.input = elem('input')
			this.input.id = this.html_id
			this.input.pattern = " *(\\d+( *[, ] *\\d+)*)? *"
			this.input.placeholder = "list of numbers"
			this.input.onchange = this.attach_onchange()
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
			super(p)
		}
		draw() {
			this.elem = this.input = elem('input')
			this.input.id = this.html_id
			this.placeholder = "list of words"
			this.input.onchange = this.attach_onchange()
		}
		read() {
			let words = this.input.value.match(/[^\s]+/g)
			this.value = words
		}
		write() {
			this.input.value = this.value==null ? "" : this.value.join(" ")
		}
	},
	// type: Date/null
	// dates are interpreted in local time.
	// uses 2 <input>s
	// considered "empty" if date input is blank. time input is optional and defaults to 00:00:00
	date: class extends GenericInput {
		constructor(p) {
			super(p)
		}
		draw() {
			this.elem = elem('div')
			
			this.input1 = elem('input')
			this.input1.id = this.html_id
			this.input1.type = 'date'
			this.elem.append(this.input1)
			
			this.input2 = elem('input')
			this.input2.type = 'time'
			//this.input2.step = "1"
			this.elem.append(this.input2)
			
			this.input2.onchange = this.input1.onchange = this.attach_onchange()
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
			super(p)
			this.output = true
		}
		draw() {
			this.input = elem('output')
			this.elem = this.input
		}
		write() {
			this.input.value = this.value || ""
		}
		read() { // useless
			this.value = this.input.value || null
		}
	},
	// BROKEN
	user_output: class extends GenericInput {
		constructor(p) {
			super(p)
			this.input = elem('div')
			this.avatar = elem('img')
			this.username = elem('span')
			this.input.append(this.avatar)
			this.input.append(this.username)
			this.input.className = 'bar rem1-5'
			this.elem = this.input
		}
		draw() {
			
			void 0
		}
		write() {
			const user = this.value
			if (!user) return
			this.avatar.src = Draw.avatar_url(user)
			this.username.textContent = user.username
			// this.input.fill(this.value ? Draw.entity_title_link(this.value) : null)
		}
		read() {
			void 0
		}
	},
}
