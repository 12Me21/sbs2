// this file runs first (probably lol)

// relatively safe
delete Array.prototype.toString
delete Object.prototype.toString
// ⚠ DANGER! ⚠ //
window.hasOwnProperty = Object.prototype.hasOwnProperty // firefox dev tools break otherwise
for (let key of Object.getOwnPropertyNames(Object.prototype))
	delete Object.prototype[key]
Object.freeze(Object.prototype)
/////////////////

if (!window.devicePixelRatio)
	window.devicePixelRatio = 1

delete window.sidebar // obsolete firefox global variable

if (!Array.prototype.findLast)
	Array.prototype.findLast = function(filter) {
		for (let i=this.length-1; i>=0; i--) {
			if (filter(this[i], i, this))
				return this[i]
		}
		return undefined
	}

String.prototype.split1 = function(sep) {
	let n = this.indexOf(sep)
	if (n == -1)
		return [this, null]
	else
		return [this.substr(0,n), this.substr(n+sep.length)]
}

// similar to replaceChildren, except:
//  - only 0 or 1 args
//  - can pass null/undefined to empty the node
//  - accepts an array of items to insert
//  - doesn't allow strings
Node.prototype.fill = function (x) {
	this.textContent = ""
	if (x instanceof Node)
		this.append(x)
	else if (x instanceof Array)
		this.append(...x)
	else if (x!=null)
		throw "invalid node childs"
}
// do not use replaceChildren itself, because it's relatively new
// and was implemented incorrectly on safari at some point

// custom
Node.prototype.createChild = function(type) {
	let elem = this.ownerDocument.createElement(type)
	this.append(elem)
	return elem
}
// type - tag name of element to create
// classes (optional) - assigned to className
Node.prototype.child = function(type, classes) {
	let elem = this.ownerDocument.createElement(type)
	this.append(elem)
	if (classes)
		elem.className = classes
	return elem
}
/*Node.prototype.class = function(t) {
	if (t)
		this.className += " "+t[0]
}*/

// same as JSON.parse, but returns `undefined` if it fails
// (note that JSON can't encode `undefined`)
JSON.safe_parse = function(json) { // should be function() not => yeah?
	try {
		return JSON.parse(json)
	} catch(e) {
		return undefined
	}
}
// convert obj into a json Blob for xhr
JSON.to_blob = function(obj) {
	return new Blob([JSON.stringify(obj)], {type: "application/json;charset=UTF-8"})
}

// creating our own storage system, to deal with compatibility + exceptions
let Store = {
	// value: string
	set(name, value) {
		try {
			localStorage.setItem(name, value)
		} catch(e) {
			return false
		}
		return true
	},
	// returns a string if the value exists, otherwise null
	get(name) {
		return localStorage.getItem(name)
	},
	remove(name) {
		localStorage.removeItem(name)
	},
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

// if x is a plain object (ex: from an object literal, JSON.parse, etc.)
Object.is_plain = function(x) {
	return x && Object.getPrototypeOf(x)==Object.prototype
}

// use this instead of String.prototype.match(regexp)
RegExp.prototype.rmatch = function(str) {
	if (typeof str != 'string')
		throw new TypeError("RegExp.rmatch() expects string")
	return String.prototype.match.call(str, this) || [null]
}

function error(e, ...rest) {
	console.error(...rest, "\n", e)
}

//talking excitedly about javasscript getters and setters for an hour and then crying
