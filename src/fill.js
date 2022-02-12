// this file runs first (probably lol)

delete Array.prototype.toString
delete Object.prototype.toString

if (!window.devicePixelRatio)
	window.devicePixelRatio = 1

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
	this.appendChild(elem)
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


JSON.safeParse = function(json) {
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

// DANGEROUS
// allows object.forEach (but this will break if the .forEach key exists!!)
Object.defineProperty(Object.prototype, 'forEach', {
	enumerable: false, // EXTREMELY IMPORTANT
	configurable: true,
	value(callback) {
		for (let key in this)
			callback(this[key], key, this)
	}
})

//talking excitedly about javasscript getters and setters for an hour and then crying
