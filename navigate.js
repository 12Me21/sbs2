<!--/* trick indenter
var Nav = Object.create(null);
with (Nav) void function($) { "use strict"
Object.assign(Nav, { //*/

currentPath: null,

initialPop: false,

init: false,

entityPath: function(entity) {
	if (!entity)
		return
	if (entity.Type == 'user')
		return "user/"+entity.id
	if (entity.Type == 'content')
		return "page/"+entity.id
	if (entity.Type == 'category')
		return "category/"+entity.id
	return "unknown/"+entity.id
},

link: function(path, element) {
	path = String(path)
	element = element || $.document.createElement('a')
	element.href = "?"+path
	element.onclick = function(e) {
		e.preventDefault()
		e.stopPropagation()
		go(path)
	}
	// a few notes about this
	// first, we need to use onclick because removing event listeners is a MASSIVE pain, especially here. we need to keep a list of old function references, and somehow attach that to the node? idk. WeakMap maybe but that's too new
	// this way, adding a new event will override the old one automatically
	// however, I also use some nested link elements (sorry...)
	// so, this assumes the event will be called on the inner element first
	// which is the default in most browsers, but some old browsers... idk
	return element
},

go: function(path) {
	currentPath = path
	$.history.pushState(null, "", "?"+path)
	// todo: maybe try to update page only after page loads
	render(path)
},

// called when site loads to load the initial page
// should read window.location and
// eventually call `render`
initial: function() {
	// bad browsers will trigger popstate event
	// whenever the page loads
	// (not just from back/forward buttons)
	// this SHOULD happen before DOMContentLoaded,
	// and if it does, cancel the initial loader
	// if it happens AFTER DOMContentLoaded then you're basically fucked though
	if (init || initialPop)
		return
	initialPop = true
	init = true
	updateFromLocation()
},

updateFromLocation: function() {
	var path = $.location.search.substr(1)
	currentPath = path
	render(path)
},

parsePath: function(path) {
	var a = path.split1("#")
	var b = a[0].split1("?")
	var base = b[0]
	var fragment = a[1]
	var query = b[1]
	var queryVars = {}
	if (query) {
		query.split("&").forEach(function(item) {
			item = item.split1("=")
			var name = decodeURIComponent(item[0].trim())
			if (item[1] == null)
				queryVars[name] = true
			else
				queryVars[name] = decodeURIComponent(item[1].trim())
		})
	}
	return {
		path: base.split("/"),
		query: queryVars,
		fragment: fragment
	}
},

// all paths are in the form
// name[/id][?query][#fragment]
decodePath: function(path) {
	path = parsePath(path)
	var type = path.path[0] || ""
	var id = path.path[1]
	if (id != undefined) {
		if (/^-?\d+$/.test(id))
			id = +id
	}
	path.id = id
	path.type = type
	return path
},

render: function(path, after) {
	path = String(path)
	var path = decodePath(path)
	
	// todo: update url when view is redirected
	$.View.handleView(path.type, path.id, path.query, after)
},
<!--/* 
}) //*/

$.onpopstate = function() {
	init = true
	initialPop = true
	updateFromLocation()
}

<!--/*
}(window) //*/
