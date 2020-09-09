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

function TrackScrollResize(element, callback) {
	var t = TrackScrollResize.tracking
	if (callback) {
		var n = {
			element: element,
			callback: callback,
			height: element.getBoundingClientRect().height,
		}
		if (TrackScrollResize.observer) {
			TrackScrollResize.observer.observe(element)
			t.set(element, n)
		} else {
			t.push(n)
		}
	} else {
		if (TrackScrollResize.observer) {
			TrackScrollResize.observer.unobserve(element)
			t['delete'](element)
		} else {
			for (var i=0; i<t.length; i++) {
				if (t[i].element == element) {
					t.splice(i, 1)
					break
				}
			}
		}
	}
}


if (window.ResizeObserver) {
	TrackScrollResize.tracking = new WeakMap()
	TrackScrollResize.observer = new ResizeObserver(function(events) {
		var t = TrackScrollResize.tracking
		events.forEach(function(event) {
			var item = t.get(event.target)
			if (item) {
				if (event.contentRect.width) {
					item.callback(item.height, event.contentRect.height)
					item.height = event.contentRect.height
				}
			}
		})
	})
} else {
	TrackScrollResize.tracking = []
	TrackScrollResize.interval = window.setInterval(function() {
		TrackScrollResize.tracking.forEach(function(item) {
			var height = item.element.getBoundingClientRect().height
			if (height != item.height) {
				item.callback(item.height, height)
				item.height = height
			}
		})
	}, 200)
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
}*/

//talking excitedly about javasscript getters and setters for an hour and then crying
