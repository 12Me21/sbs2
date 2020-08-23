<!--/* trick indenter
var Nav = Object.create(null);
with (Nav) void function($) { "use strict"
Object.assign(Nav, { //*/

currentPath: null,
cancel: null,

// this will always be the currently rendered view
// (set before `render` is called, and unset before `cleanUp` is called)
// currentView.cleanUp should always be correct!
currentView: null,

entityPath: function(entity) {
	if (!entity)
		return
	if (entity.type == 'user')
		return "user/"+entity.id
	if (entity.type == 'content')
		return "page/"+entity.id
	if (entity.type == 'category')
		return "category/"+entity.id
},

link: function(path, element) {
	element = element || $.document.createElement('a')
	element.href = "#"+path
	return element
},

go: function(path) {
	$.location.hash = "#"+path
},

// called when site loads to load the initial page
// should read window.location and
// eventually call `render`
initial: function() {
	$.onhashchange()
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
	var id = +path.path[1] || 0
	path.id = id
	path.type = type
	return path
},

render: function(path) {
	if (cancel) {
		cancel()
		cancel = null
	}
	var path = decodePath(path)
	
	var view = $.View.getView(path.type)
	// todo: update url when view is redirected
	var cancelled
	function cleanUp() {
		if (currentView && currentView.cleanUp) {
			try {
				currentView.cleanUp()
			} catch(e) {
				console.error("error in cleanup function", e)
			} finally {
				currentView = null
			}
		}
	}
	if (view.start) {
		$.View.loadStart()
		var xhr = view.start(path.id, path.query, function() {
			if (cancelled)
				return
			cleanUp()
			currentView = view
			try {
				view.render.apply(null, arguments)
			} catch(e) {
				console.error("error in rendering function for "+path.type, e)
			}
			after()
			$.View.loadEnd()
		})
	} else {
		//(type is passed here so that the error page can display it)
		cleanUp()
		currentView = view
		try {
			view.render(path.id, path.query, path.type)
		} catch(e) {
			console.error("error in rendering function for "+path.type, e)
		}
		after()
	}
	cancel = function() {
		$.View.loadEnd()
		if (xhr && xhr.abort) {
			xhr.abort()
		}
		cancelled = true
	}
	function after() {
		$main.className = view.className
		// todo: scroll to fragment element
	}
},

<!--/* 
}) //*/

$.onhashchange = function() {
	render($.location.hash.substr(1))
}

<!--/*
}(window) //*/
