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

function encodeUrlComponent(s) {
	let escape = c => "%"+(c.charCodeAt(0)+0x100).toString(16).substr(1)
	return s.replace(/[^-\w\$\.+!*',;/\:@#%~]/g, escape).replace(/[,\.?!:]$/, escape)
	
}

class Form {
	constructor(p) {
		this.fields = p.fields
		this.map = {}
		this.elem = document.createElement('div')
		for (let field of this.fields) {
			this.map[field.name] = field
			this.elem.append(field.input.elem)
		}
	}
	get() {
		return this.fields.reduce((a,field)=>{
			a[field.name] = field.input.get()
			return a
		}, {})
	}
	set(p) {
		for (let field of this.fields) {
			console.log('setting field ',field.name, p[field.name])
			field.input.set(p[field.name])
		}
	}
	to_query(p) {
		let params = []
		for (let field of this.fields) {
			let value = p[field.name]
			if (value != null && field.convert)
				value = field.convert.encode(value)
			if (value != null) {
				let key = encodeUrlComponent(field.param)
				if (value === true)
					params.push(key)
				else if (value !== false)
					params.push(key+"="+encodeUrlComponent(value))
			}
		}
		if (params.length == 0)
			return ""
		return "?"+params.join("&")
	}
	from_query(query) {
		let p = {}
		//console.log(query)
		for (let field of this.fields) {
			let value = query[field.param]
			if (field.convert)
				value = field.convert.decode(value)
			//console.log("got from query", field.param, query[field.param], value)
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
	
	function label(x, text) {
		if (text == undefined)
			return x
		let e = elem('label')
		e.append(x)
		e.append(String(text))
		return e
	}
	
	class GenericInput {
		toString() {
			return `Input.${this.type}()`
		}
	}
	
	return {
		select: class extends GenericInput {
			constructor(p) {
				super()
				this.elem = label(elem('select'), p.label)
				this.elem.append(...p.options.map(opt => {
					let o = elem('option')
					o.value = opt.value
					o.textContent = opt.label
					return o
				}))
			}
			get() {
				return this.elem.value
			}
			set(v) {
				this.elem.value = v
			}
		},
		checkbox: class extends GenericInput {
			constructor(p) {
				super()
				this.input = elem('input')
				this.input.type = 'checkbox'
				this.elem = label(this.input, p.label)
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
				this.elem = label(this.input, p.label)
				if (p.placeholder != undefined)
					this.input.placeholder = p.placeholder
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
				this.elem = label(this.input, p.label)
				if (p.placeholder != undefined)
					this.input.placeholder = p.placeholder
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
				this.elem = label(this.input, p.label)
				this.input.type = number
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
				this.elem = label(this.input, p.label)
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
				this.elem = label(elem('input'), p.label)
				if (p.placeholder != undefined)
					this.elem.placeholder = p.placeholder
			}
			get() {
				return this.elem.value.split(/[\s]/g).filter(x=>x.length!=0)
			}
			set(v) {
				this.elem.value = v.join(' ')
			}
		},
		permissions: class extends GenericInput {
			constructor() {
				super()
				this.elem = elem('div')
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
			set(perms, users) {
				this.body.replaceChildren()
				let d = false
				perms.forEach((perm, uid) => {
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
				this.elem = elem('select')
				//this.update()
			}
			// hack idk
			set(value, map) {
				let option = (value, text)=>{
					let x = elem('option')
					x.textContent = text
					x.value = value
					return x
				}
				
				this.elem.replaceChildren(option("", "-- Select Category --"))
				if (!map) return // not ready yet :(
				
				// recursive function
				// ⚠ if there are cycles in the data, this will freeze
				let build_list = (node, ret, depth)=>{
					ret.push({id: node.id, text: ">".repeat(depth)+" "+node.name})
					node.children && node.children.forEach((node)=>{
						build_list(node, ret, depth+1)
					})
				}
				
				let list = []
				if (map)
					build_list(map, list, 0)
				if (value!=null) {
					let selected = list.find(item=>item.id==value)
					if (!selected) {
						this.elem.append(option(value, "Unknown category: "+value))
					}
				}
				this.elem.append(...list.map(item=>option(item.id, item.text)))
				this.elem.value = value==null ? "" : value
			}
			get() {
				if (this.elem.value=="")
					return null
				return +this.elem.value
			}
		}
	}
})()
