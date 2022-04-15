// this file runs first (probably lol)
// ⚠ DANGER! ⚠ //

// ⚡ Remove all properties of `Object.prototype`
// - create backups:
window.hasOwnProperty = {}.hasOwnProperty // (ff devtools needs this)
Object.proto = Object.getOwnPropertyDescriptors(Object.prototype)
// - remove properties:
for (let key of Object.getOwnPropertyNames(Object.prototype))
	delete Object.prototype[key]
//Object.freeze(Object.prototype)

function throw2(err) {
	throw err
}
function SELF_DESTRUCT(err, ...args) {
	let x = {"💥💥💥💥💥"(){ throw new err(...args) }}["💥💥💥💥💥"]
	return new Proxy({}, {get:x, set:x, has:x})
}

// ex: function callback(resp=throw2(err), err) ??

// ⚡ Custom errors
// call this immediately after super() (do not pass args to super)
Error.prototype.trim_stack = function(levels=1) {
	while (levels-->0)
		this.stack = this.stack.replace(/^(?!Error\n).*\n/, "")
}
class ParamError extends Error {
	constructor(name) {
		super()
		this.trim_stack(2)
		this.message = `Undefined Argument: “${name}”`
	}
}
ParamError.prototype.name = "ParamError"
class FieldError extends Error {
	constructor(message, ...args) {
		super()
		this.trim_stack(2)
		this.name = message
		console.error(...args)
	}
}
function Unhandled_Callback(err, ...x) {
	console.error("Unhandled Callback\n", err, ...x);
}

// ⚡ Missing argument detector
// use like: function heck(name=E.name) { ... } -- now `name` is required
let E = new Proxy({}, {
	get(t, name) { throw new ParamError(name) }
})

// ⚡ STRICT prototype - throws when accessing nonexistant fields
function field_name(name) {
	if (typeof name != 'string')
		return `[${String(name)}]`
	return `.${name}`
}
let STRICT = new Proxy(Object.create(null), {
	get(t, name, obj) {
		name = field_name(name)
		throw new FieldError(
			`🚮 invalid field read: ${name}`, obj, `⛔${name}`)
	},
	set(t, name, value, obj) {
		name = field_name(name)
		throw new FieldError(
			`🚮 invalid field write: ${name}`, obj, `⛔${name} =`, value)
	},
})
// ⚡ NO_CONVERT - prevents type conversions
// assign to Type.prototype[Symbol.toPrimitive]
// note: will override .toString/.valueOf on any inheriting types
function NO_CONVERT(type) {
	if (type=='default') type='Primitive'
	if (type=='number') type='Number'
	if (type=='string') type='String'
	throw new FieldError("🚮 invalid type conversion", this, "⛔ to "+type)
}
function set_tc(type, tc=type.prototype.toString) {
	Object.defineProperty(type.prototype, Symbol.toPrimitive, {
		value: tc, configurable: true,
	})
}
set_tc(Object, NO_CONVERT)
set_tc(Error)

// ⚡ async/await/Promise replacement using function*/yield
let GeneratorFunction = function*(){}.constructor
GeneratorFunction.prototype.run = function(args, callback, onerror) {
	let iter
	let y = true
	let func = data => {
		try { // i wonder if there is an overhead to try/catch...
			while (y) {
				y = false
				let r = iter.next(data)
				if (r.done) return callback && callback(r.value)
			}
			y = true
		} catch (e) {
			if (onerror) return onerror(e)
			throw e
		}
	}
	iter = this(func, ...args)
	func()
	return iter
}


// (end of scary part)

//const toBlob = new Symbol('toBlob')

// wow an actual 
if (!Array.prototype.findLast)
	Array.prototype.findLast = function(filter) {
		for (let i=this.length-1; i>=0; i--) {
			if (filter(this[i], i, this))
				return this[i]
		}
		return undefined
	}

if (!document.timeline)
	document.timeline = {get currentTime(){return performance.now()}}

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

// this is just exec but safer i guess...
RegExp.prototype.rmatch = function(str) {
	if (typeof str != 'string')
		throw new TypeError("RegExp.rmatch() expects string")
	return String.prototype.match.call(str, this) || [null]
}



let 𖹭 = Object.create.bind(Object,null,{𖹭:{set(f){Object.seal(Object.assign(this,f))}}})

function 𐀶([html]) {
	let temp = document.createElement('template')
	temp.innerHTML = html.replace(/\s*\n\s*/g,"")
	let node = temp.content
	if (node.childNodes.length==1)
		node = node.firstChild
	return node.cloneNode.bind(node, true)
}

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
do_when_ready.then = do_when_ready
//console.log("deferring render", go)

if (!window.devicePixelRatio)
	window.devicePixelRatio = 1

delete window.sidebar // obsolete firefox global variable

//talking excitedly about javasscript getters and setters for an hour and then crying
