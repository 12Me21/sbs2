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
