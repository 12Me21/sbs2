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
		for (key in src)
			dest[key] = src[key]
		return dest
	}

// note: only supports 1 child element, which must be a node (not a string)
if (!HTMLElement.prototype.replaceChildren)
	HTMLElement.prototype.replaceChildren = function(child) {
		this.innerHTML = ""
		if (child)
			this.appendChild(child)
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
}


Inherit(NodeBlock, DocumentFragment)
function NodeBlock(node, child) {
	var $ = node
	Object.defineProperties($, {
		childNodes: {
			get: function() {return child.childNodes},
		},
		firstChild: {
			get: function() {return child.firstChild},
		},
		lastChild: {
			get: function() {return child.lastChild},
		},
		appendChild: {
			get: function() {return child.appendChild},
		},
	})
	return $
}*/
