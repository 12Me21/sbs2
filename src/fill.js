// this file runs first (probably lol)

delete Array.prototype.toString
delete Object.prototype.toString
for (let key of Object.getOwnPropertyNames(Object.prototype))
	delete Object.prototype[key]
Object.freeze(Object.prototype)

if (!window.devicePixelRatio)
	window.devicePixelRatio = 1

delete window.sidebar // obsolete firefox global variable

String.prototype.split1 = function(sep) {
	let n = this.indexOf(sep)
	if (n == -1)
		return [this, null]
	else
		return [this.substr(0,n), this.substr(n+sep.length)]
}

// update: we need to replace this ALWAYS because ios safari implemented it wrong (fails when 0 arguments are passed)
//if (!Element.prototype.replaceChildren)
Element.prototype.replaceChildren = function(...childs) {
	this.textContent = ""
	if (childs[0] != undefined)
		this.append(...childs)
}
Object.defineProperty(Node.prototype, 'childs', {
	set(x) {
		this.textContent = ""
		if (x instanceof Node)
			this.append(x)
		else if (x instanceof Array && x.length)
			this.append(...x)
		else if (x!=null)
			throw "invalid node childs"
	}
})


// custom
Node.prototype.createChild = function(type) {
	let elem = this.ownerDocument.createElement(type)
	this.append(elem)
	return elem
}
Node.prototype.child = function(t) {
	let elem = this.ownerDocument.createElement(t[0])
	this.append(elem)
	return elem
}
/*Node.prototype.class = function(t) {
	if (t)
		this.className += " "+t[0]
}*/


JSON.safe_parse = function(json) { // should be function() not => yeah?
	try {
		return JSON.parse(json)
	} catch(e) {
		return undefined
	}
}

// creating our own storage system, to deal with compatibility + exceptions
let Store = {
	set(name, value) {
		try {
			localStorage.setItem(name, value)
		} catch(e) {
			return false
		}
		return true
	},
	get(name) {
		return localStorage.getItem(name)
	},
	remove(name) {
		localStorage.removeItem(name)
	}
}

Object.for = (obj, callback)=>{
	for (let key in obj)
		callback(obj[key], key, obj)
}

Object.map = (obj, callback)=>{
	let ret = {}
	for (let key in obj)
		ret[key] = callback(obj[key], key, obj)
	return ret
}

// do we use this,, ehh
Object.first_key = function(obj) {
	for (let key in obj)
		return key
}

function error(e, ...rest) {
	try {
		if (/^.*\n    at /.test(e.stack)) {
			let [message, ...trace] = e.stack.split("\n")
			let longest = 0
			trace = trace.map(line=>{
				let [match, func="", path="", name, lnum, cnum] = line.match(/^ *at (?:(.*) )?\(?(.*\/)?(.*):(\d+):(\d+)\)?$/) || [null]
				if (match==null)
					return [null, line]
				let at = `at (${path}${name}:${lnum}:0)`
				longest = Math.max(longest, at.length-path.length)
				return [at, func.replace(/^Object\./, "{}."), path.length]
			}).map(([at, func, extra])=>{
				if (!at)
					return func
				return at.padEnd(longest+extra+1,"—") + func
			})
			let old = e.stack
			e.stack = message+"\n"+trace.join("\n")
			console.error(...rest, "\n", e)
			e.stack = old
		}
	} catch (e2) {
		console.error(...rest, "\n", e)
	}
}

//talking excitedly about javasscript getters and setters for an hour and then crying
