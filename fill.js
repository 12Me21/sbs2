if (!window.devicePixelRatio)
	window.devicePixelRatio = 1

if (!Array.prototype.includes)
	Array.prototype.includes = function(item) {
		return this.indexOf(item) >= 0
	}

String.prototype.split1 = function(sep) {
	var n = this.indexOf(sep)
	if (n == -1)
		return [this, null]
	else
		return [this.substr(0,n), this.substr(n+sep.length)]
}

// partial, supports 2 args only. be careful
if (!Object.assign)
	Object.assign = function(dest, src) {
		for (var key in src)
			dest[key] = src[key]
		return dest
	}

// note: only supports 1 child element, which must be a node (not a string)
// update: we need to replace this ALWAYS because ios safari implemented it wrong (fails when 0 arguments are passed)
//if (!HTMLElement.prototype.replaceChildren)
	HTMLElement.prototype.replaceChildren = function(child) {
		this.textContent = ""
		if (child)
			this.appendChild(child)
	}

Node.prototype.prependChild = function(child) {
	this.insertBefore(child, this.firstChild)
}

Node.prototype.createChild = function(type) {
	var elem = this.ownerDocument.createElement(type)
	this.appendChild(elem)
	return elem
}

JSON.safeParse = function(json) {
	try {
		return JSON.parse(json)
	} catch(e) {
		return undefined
	}
}

if (!HTMLElement.prototype.remove)
	HTMLElement.prototype.remove = function() {
		if (this.parentNode)
			this.parentNode.removeChild(this)
	}

if (!NodeList.prototype.forEach)
	NodeList.prototype.forEach = Array.prototype.forEach

function Inherit(child, parent) {
	Object.defineProperty(child.prototype = Object.create(parent.prototype), 'constructor', {
		value: child,
		enumerable: false,
		writable: true
	})
}

// creating our own storage system, to deal with compatibility + exceptions
if (localStorage) {
	var Store = {
		set: function(name, value, important) {
			try {
				localStorage.setItem(name, value)
			} catch(e) {
				return false
			}
			return true
		},
		get: function(name) {
			return localStorage.getItem(name)
		},
		remove: function(name) {
			localStorage.removeItem(name)
		}
	}
} else {
	// todo:
	var Store = {
		set: function(name, value, important) {
			return false
		},
		get: function(name) {
			return null
		},
		remove: function(name) {
		}
	}
}

Object.defineProperty(Object.prototype, 'forEach', {
	enumerable: false, // EXTREMELY IMPORTANT
	configurable: true,
	value: function(callback) {
		for (var key in this)
			callback(this[key], key, this)
	}
})

/*function NodeBlock(node, child) {
	// create object containing override properties
	// set this object's prototype to `node`
	return Object.create(node, {
		childNodes: {
			get: function() {return child.childNodes}
		},
		firstChild: {
			get: function() {return child.firstChild}
		},
		lastChild: {
			get: function() {return child.lastChild}
		},
		nodeValue: {
			get: function() {return child.nodeValue},
			set: function(x) {child.nodeValue = x}
		},
		textContent: {
			get: function() {return child.textContent}
			set: function(x) {child.textContent = x}
		},
		// and then functions like appendChild etx.
	})
}*/

//talking excitedly about javasscript getters and setters for an hour and then crying
