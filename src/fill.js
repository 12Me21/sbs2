'use strict'
// this file runs first (probably lol)
// ⚠ DANGER! ⚠ //

// ⚡ Remove all properties of `Object.prototype`
// - first, create backups of useful functions:
// firefox devtools uses this:
window.hasOwnProperty = Object.prototype.hasOwnProperty
// Object.prototype.toString.call -> Object.stringify
Object.stringify = Function.prototype.call.bind(Object.prototype.toString)
// polyfill: Object.hasOwn()
if (!Object.hasOwn)
	Object.hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty)
// everything, just in case
Object.proto = Object.getOwnPropertyDescriptors(Object.prototype)
// - remove properties:
for (let key of Object.getOwnPropertyNames(Object.prototype))
	delete Object.prototype[key]

function METHOD(type, name, tc) {
	Object.defineProperty(type.prototype, name, {
		value: tc, configurable: true,
	})
}

function SELF_DESTRUCT(err) {
	let x = ()=>{ throw err }
	return new Proxy({}, {get:x, set:x, has:x})
}

// ⚡ Custom errors
METHOD(Error, 'trim_stack', function(levels=1) {
	while (levels-->0)
		this.stack = this.stack.replace(/^(?!Error:).*\n/, "")
})

class FieldError extends Error {
	constructor(message, ...args) {
		super(message)
		this.trim_stack(2)
		FieldError.last = args
		//console.error(...args)
	}
}

// ⚡ STRICT prototype - throws when accessing nonexistant fields
function field_name(name) {
	if (typeof name != 'string')
		return `[${String(name)}]`
	return `.${name}`
}

let STRICT = new Proxy({__proto__:null}, {
	get(t, name, obj) {
		name = field_name(name)
		throw new FieldError(
			`🚮 invalid field read: ${name}`, obj, `⛔${name}`
		)
	},
	set(t, name, value, obj) {
		name = field_name(name)
		throw new FieldError(
			`🚮 invalid field write: ${name}`, obj, `⛔${name} =`, value
		)
	},
})
// idea: class extends STRICT, have some method for defining properties easily (instead of this.x = ...)

// ⚡ NO_CONVERT - prevents type conversions
// assign to Type.prototype[Symbol.toPrimitive]
// note: will override .toString/.valueOf on any inheriting types
function NO_CONVERT(type) {
	if (type=='default') type='primitive'
	throw new FieldError("🚮 invalid type conversion", this, "⛔ to "+type)
}
METHOD(Object, Symbol.toPrimitive, NO_CONVERT)
//METHOD(Object, Symbol.toStringTag, undefined)
METHOD(Error, Symbol.toPrimitive, function() {
	return this.toString()+"\n"+this.stack
})

//METHOD(Promise, 'then', x=>{throw '💔'})

// ⚡ async/await/Promise replacement using function*/yield
window.GeneratorFunction = function* () {}.constructor
window.Generator = GeneratorFunction.prototype

// how programmers walk:
METHOD(Generator, 'run', function(ok=console.info, err=e=>{ throw e }) {
	let step, main = data=>{
		step = defer => [data,step]=[defer,main] 
		try {
			let r = this.next(data)
			if (r.done) [data,step]=[r.value,ok]
		} catch (e) { [data,step]=[e,err] }
		step(data)
	}
	main()
	step(x=>step(x))
	return this
})

// obsolete global vars
delete window.content
delete window.sidebar
delete window.name

METHOD(Map, 'pop', function(key) {
	let v = this.get(key)
	this.delete(key)
	return v
})


// (end of scary part)

//const toBlob = new Symbol('toBlob')

// polyfill: Array.prototype.findLast()
if (!Array.prototype.findLast)
	METHOD(Array, 'findLast', function(filter) {
		for (let i=this.length-1; i>=0; i--) {
			if (filter(this[i], i, this))
				return this[i]
		}
		return undefined
	})

// polyfill: document.timeline.currentTime
if (!document.timeline)
	document.timeline = {get currentTime() { return performance.now() }}

// similar to replaceChildren, except:
//  - only 0 or 1 args
//  - can pass null/undefined to empty the node
//  - accepts an array of items to insert
//  - doesn't allow strings
//  * ISN't like, 20 characters longest method name ever
METHOD(Node, 'fill', function(x) {
	this.textContent = ""
	if (Array.isArray(x))
		this.append(...x)
	else if (x != undefined)
		this.appendChild(x)
})

// convert obj into a json Blob for xhr
JSON.to_blob = function(obj) {
	return new Blob([JSON.stringify(obj)], {type: "application/json;charset=UTF-8"})
}

// these are kinda bad, both based on Array.forEach() which is [value,key] while here [key,value] would make more sense.
Object.for = (obj, callback)=>{
	for (let [key, value] of Object.entries(obj))
		callback(value, key, obj)
}

// this is just exec but safer i guess...
RegExp.prototype.rmatch = function(str) {
	if (typeof str != 'string')
		throw new TypeError("RegExp.rmatch() expects string")
	return String.prototype.match.call(str, this) || []
}



//let 𖹭 = Object.create.bind(Object,null,{𖹭:{set(f){Object.seal(Object.assign(this,f))}}}) // not used anymore :(
//let 𖹭 = x=>{__proto__:null,set 𖹭(f){Object.seal(Object.assign(this,f))}} // golfed..

// why do we have these
const NAMESPACE = Object.seal

function 𐀶([html]) {
	let temp = document.createElement('template')
	temp.innerHTML = html.replace(/\s*?\n\s*/g, "")
	let node = temp.content
	if (node.childNodes.length==1)
		node = node.firstChild
	return document.importNode.bind(document, node, true)
}

//let DEFER = func => run_on_load.push(func)
/*Object.defineProperty(window, 'DEFER', {
	configurable: true, set(fn){run_on_load.push(fn)},
})
Object.defineProperty(window, 'DEFER', {
	configurable: true, set(fn){fn()},
})
DEFER = () => document.body.className = 'ack'
*/


//talking excitedly about javasscript getters and setters for an hour and then crying
