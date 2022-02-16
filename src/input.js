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

// nicer replacement for encodeURIComponent
function url_escape(s) {
	let escape = c => "%"+(c.charCodeAt(0)+0x100).toString(16).substr(1)
	return s.replace(/[^-\w\$\.+!*',;/\:@#%~]/g, escape).replace(/[,\.?!:]$/, escape)
}
// todo: also make a full query string encode function

// maybe instead of specifying the layout in Form, we just provide a list of locations of where to insert the fields. this is necessary for, ex: the page title input which is outside the main element

class Form {
	constructor(p) {
		this.fields = p.fields // list of fields
		this.map = {} // map of name -> item in this.fields
		this.elem = document.createElement('table')
		this.inputs = {} // map of name -> INPUT instances
		let tbody = this.elem.createChild('tbody')
		this.elem.className += ' form fill'
		
		for (let field of this.fields) {
			this.map[field.name] = field
			let input = new (INPUTS[field.type])(field.input)
			this.inputs[field.name] = input
			
			let tr = tbody.createChild('tr')
			
			if (field.input.span) {
				let t1 = tr.createChild('td')
				t1.colSpan = 2
				let label = t1.createChild('label')
				label.for = input.html_id
				let h3 = label.createChild('h3')
				h3.textContent = field.input.label+": "
				t1.append(input.elem)
				//t1.className += ' input'
			} else {
				let t1 = tr.createChild('th')
				let t2 = tr.createChild('td')
				let label = t1.createChild('label')
				label.for = input.html_id
				label.textContent = field.input.label+": "
				t2.append(input.elem)
				//t2.className += ' input'
			}
		}
	}
	destroy() {
		this.elem.replaceChildren()
	}
	get() {
		return this.fields.reduce((a, field)=>{
			a[field.name] = this.inputs[field.name].get()
			return a
		}, {})
	}
	set(p) {
		for (let field of this.fields) {
			this.inputs[field.name].set(p[field.name])
		}
	}
	to_query(p) {
		let params = []
		for (let field of this.fields) {
			let value = p[field.name]
			if (value != null && field.convert)
				value = field.convert.encode(value)
			if (value != null) {
				let key = url_escape(field.param)
				if (value === true)
					params.push(key)
				else if (value !== false)
					params.push(key+"="+url_escape(value))
			}
		}
		if (params.length == 0)
			return ""
		return "?"+params.join("&")
	}
	from_query(query) {
		let p = {}
		for (let field of this.fields) {
			let value = query[field.param]
			if (field.convert)
				value = field.convert.decode(value)
			if (value != null)
				p[field.name] = value
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
		decode: x => typeof x == 'string' ? x.split(",").map(x=>Number(x)) : null, // todo: filter if values aren't valid numbers
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
			if (typeof x == 'number')
				return String(x)
			let min = x[0]
			if (min == null)
				min = "0"
			let max = x[1]
			if (max == null)
				max = ""
			return min+"-"+max
		},
		decode: x => {
			if (typeof x == 'string') {
				let match = x.match(/^(\d+)(?:(-)(\d*))?$/)
				if (match) {
					let min = match[1]
					let dash = match[2]
					let max = match[3]
					if (min != null)
						min = +min
					if (max != null)
						max = +max
					if (!dash) {
						return min
					} else {
						return [min, max]
					}
				}
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
	}
	
	let x = 0
	function unique_id() {
		x++
		return "input-"+x
	}
	
	return {
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
				this.extra = elem('option')
				this.options = p.options.map(opt=>opt[0])
				this.elem = this.input
			}
			get() {
				return this.input.value
			}
			set(v) {
				if (!this.options.includes(v)) {
					this.extra.value = v==null ? "" : v
					this.extra.textContent = "Unknown value: "+v
					this.input.prepend(this.extra)
				} else
					this.extra.remove()
				this.input.value = v
			}
		},
		checkbox: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.input.type = 'checkbox'
				this.elem = this.input
			}
			get() {
				return this.input.checked
			}
			set(v) {
				this.input.checked = v
			}
		},
		text: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				if (p.placeholder != undefined)
					this.input.placeholder = p.placeholder
				this.elem = this.input
			}
			get() {
				return this.input.value || null
			}
			set(v) {
				this.input.value = v || ""
			}
		},
		range: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				if (p.placeholder != undefined)
					this.input.placeholder = p.placeholder
				this.elem = this.input
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
		number: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.elem = this.input
				this.input.type = 'number'
				if (p.placeholder != undefined)
					this.input.placeholder = p.placeholder
			}
			get() {
				let v = this.input.value
				return v=="" ? null : Number(v) // and of course, this can also return NaN
			}
			set(v) {
				this.input.value = v==null ? "" : String(v)
			}
		},
		number_list: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				this.elem = this.input
				if (p.placeholder != undefined)
					this.input.placeholder = p.placeholder
			}
			get() {
				if (this.input.value=="")
					return null
				return this.input.value.split(/[,\s]/g).filter(x=>x.length!=0).map(x=>Number(x))
			}
			set(v) {
				if (v != null)
					this.input.value = v.join(',')
				else
					this.input.value = ""
			}
		},
		word_list: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.id = this.html_id
				if (p.placeholder != undefined)
					this.input.placeholder = p.placeholder
				this.elem = this.input
			}
			get() {
				return this.input.value.split(/[\s]/g).filter(x=>x.length!=0)
			}
			set(v) {
				this.input.value = v==null ? "" : v.join(' ')
			}
		},
		permissions: class extends GenericInput {
			constructor() {
				super()
				this.elem = elem('div')
				this.elem.id = this.html_id //todo: put a hidden <input> element or something?
				this.input = Draw.userSelector()
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
			}
			_add_row(user, perm) {
				//ok we really need to fix the problem with null users
				// one solution is to have a user map lookup function which returns a placeholder object if the user is not found, to store the 2 important (and known) properties, Type and id, just to avoid losing that information.
				this.body.append(Draw.permissionRow(user, perm))
			}
			set([perms, users]) {
				this.body.replaceChildren()
				let d = false
				Object.for(perms, (perm, uid) => {
					uid = +uid
					this._add_row(users[uid] || {Type:'user', id:uid}, perm)
					if (uid==0)
						d = true
				})
				if (!d)
					this._add_row({Type:'user', id:0}, "rc")
			}
			get() {
				let ret = {}
				this.body.childNodes.forEach(row => {
					let perm = ''
					row.querySelectorAll('input').forEach(check => {
						if (check.checked)
							perm += check.value
					})
					ret[row.dataset.id] = perm
				})
				return ret
			}
		},
		date: class extends GenericInput {
			constructor() {
				super()
				this.elem = elem('div')
				
				this.input = elem('input')
				this.input.id = this.html_id
				this.input.type = 'datetime-local'
				
				this.seconds = elem('input')
				this.seconds.type = 'number'
				this.seconds.min = 0
				this.seconds.max = 60
				
				this.elem.append(this.input, this.seconds)
			}
			get() {
				let date = new Date(this.input.value)
				let seconds = +this.seconds.value
				date.setSeconds(Math.floor(seconds))
				date.setMilliseconds(seconds % 1 * 1000)
				if (!isFinite(date))
					return null
				return date
			}
			set(v) {
				if (v) {
					this.input.value = v.toISOString().replace(/Z$/,"")
					this.seconds.value = v.getSeconds() + v.getMilliseconds()/1000
				} else {
					this.input.value = ""
					this.seconds.value = ""
				}
			}
		},
		category: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('select')
				this.input.id = this.html_id
				this.elem = this.input
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
				
				this.input.replaceChildren(option("", "-- Select Category --"))
				if (!tree) return // not ready yet :(
				
				// recursive function
				// ⚠ if there are cycles in the data, this will freeze
				let build_list = (node, ret, depth)=>{
					ret.push({id: node.id, text: ">".repeat(depth)+" "+node.name})
					node.children && node.children.forEach((node)=>{
						build_list(node, ret, depth+1)
					})
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
		}
	}
})()
