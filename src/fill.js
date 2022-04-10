// this file runs first (probably lol)

// relatively safe
delete Array.prototype.toString
//delete Object.prototype.toString
// ⚠ DANGER! ⚠ //
window.hasOwnProperty = Object.prototype.hasOwnProperty // firefox dev tools break otherwise
Object.proto = Object.create(null)
for (let key of Object.getOwnPropertyNames(Object.prototype)) {
	Object.proto[key] = Object.prototype[key]
	delete Object.prototype[key]
}
//Object.freeze(Object.prototype)
/////////////////

//usage:
/*
constructor(...) {
	super() // do not pass args here!
	this.trim_stack()
	this.message = "..." // set message like this instead
	...
}
*/
Error.prototype.trim_stack = function(levels=1) {
	while (levels-->0)
		this.stack = this.stack.replace(/^(?!Error\n).*\n/, "")
}

// missing parameter detector
// usage: function heck(a, b, c=~E) { ... }  -- c is now required
function Unhandled_Callback(err, ...x) {
	console.error("Unhandled Callback\n", err, ...x);
}
class ParamError extends Error {
	constructor() {
		super()
		this.trim_stack(2)
	}
}
ParamError.prototype.name = "Undefined Argument"
const E = {
	[Symbol.toPrimitive]: function Missing_Arg() {
		throw new ParamError()
	}
}

class FieldError extends Error {
	constructor(message, ...args) {
		super()
		this.trim_stack(2)
		this.name = message
		console.error(...args)
	}
}
let STRICT = new Proxy(Object.create(null), {
	get(t, name, obj) {
		throw new FieldError("🚮 invalid field read", obj, "⛔."+String(name))
	},
	set(t, name, value, obj) {
		throw new FieldError("🚮 invalid field write", obj, "⛔."+String(name)+" =", value)
	},
})

// wow an actual 
if (!Array.prototype.findLast)
	Array.prototype.findLast = function(filter) {
		for (let i=this.length-1; i>=0; i--) {
			if (filter(this[i], i, this))
				return this[i]
		}
		return undefined
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
eval("\n".repeat(419)+'a=>{return;'+' '.repeat(58)+'return}')
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

// do we really need this...
let Store = {
	set: localStorage.setItem.bind(localStorage),
	get: localStorage.getItem.bind(localStorage),
	remove: localStorage.getItem.bind(localStorage),
}

// these are kinda bad, both based on Array.forEach() which is [value,key] while here [key,value] would make more sense.
Object.for = (obj, callback)=>{
	for (let [key, value] of Object.entries(obj))
		callback(value, key, obj)
}
// are we using this?
Object.map = (obj, callback)=>{
	let ret = {}
	for (let [key, value] of Object.entries(obj))
		ret[key] = callback(value, key, obj)
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

// this is just exec but safer i guess...
RegExp.prototype.rmatch = function(str) {
	if (typeof str != 'string')
		throw new TypeError("RegExp.rmatch() expects string")
	return String.prototype.match.call(str, this) || [null]
}



let 𖹭 = Object.create.bind(Object,null,{𖹭:{set(f){Object.seal(Object.assign(this,f))}}})

// we aren't ready to use `static` yet, so we
// assign our static fields this way instead
const new_class = (cls, stat) => Object.seal(Object.assign(cls, stat))
const singleton = (obj) => Object.seal(obj)

// activating strict mode:
// x = function(){"use strict"; ... }()
// 

// examples:
// let MySingleton = function(){"use strict"; return singleton({
//    <fields>,
// })}()
// let MyClass = function(){"use strict"; return new_class(class MyClass{
//    <class init>
// }, {
//    <static fields>,
// })}()

// shouldn't really be here but this needs to be defined pretty early..
let run_on_load = []
let do_when_ready = func => run_on_load.push(func)
//console.log("deferring render", go)

if (!window.devicePixelRatio)
	window.devicePixelRatio = 1

delete window.sidebar // obsolete firefox global variable

//talking excitedly about javasscript getters and setters for an hour and then crying
