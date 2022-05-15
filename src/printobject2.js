let hasOwnProperty = Object.prototype.hasOwnProperty

function info(it) {
	switch (typeof it) {
	case 'undefined':
		return "undefined"
		break
	case 'boolean':
		return it ? "true" : "false"
		break
	case 'number':
		return String(it)
		break
	case 'string':
		return it // todo: truncate, escape chars etc.
		break
	case 'symbol':
		let key = Symbol.keyFor(it)
		if (key!==undefined)
			return `Symbol.for("${it.description}")`
		key = it.description
		if (key!==undefined)
			return `Symbol("${key}")` // todo
		return "Symbol()"
		break
	case 'bigint':
		return String(it)
		break
	case 'function':
		// object with [[Call]]
		return function_info(it)
		break;
	case 'object':
		if (!it) {
			return "null"
		} else {
			// object without [[Call]]
			return object_info(it)
		}
		break
	}
}

// check for [[construct]] how ?

function function_info(it) {
	let is_cons
	// check if the function is a constructor
	try {
		// https://tc39.es/ecma262/multipage/ecmascript-language-functions-and-classes.html#sec-runtime-semantics-classdefinitionevaluation
		let cls = class extends it {}
		is_cons = true
	} catch (e) {}
	let source = Function.prototype.toString.call(it)
	// note: .name/.length are configurable, so can be tampered with
	let name = Object.getOwnPropertyDescriptor(it, 'name')
	let length = Object.getOwnPropertyDescriptor(it, 'length')
	let proto = Object.getOwnPropertyDescriptor(it, 'prototype')
}

function object_info(it) {
	let is_array = Array.isArray(it)
}

 Undefined 	"undefined"
Null 	"object"
Boolean 	"boolean"
Number 	"number"
String 	"string"
Symbol 	"symbol"
BigInt 	"bigint"
Object (does not implement [[Call]]) 	"object"
Object (implements [[Call]]) 	"function"
