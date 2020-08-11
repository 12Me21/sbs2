<!--/* trick indenter
var Nav = {}
with (Nav) { //*/

// private variables

var $ = window 

function split1(string, sep) {
	var n = string.indexOf(sep)
	if (n == -1)
		return [string, null]
	else
		return [string.substr(0,n), string.substr(n+sep.length)]
}

<!--/*
		Object.assign(Nav, { //*/

// public variables

currentPath: null,
cancel: null,

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

parsePath: function (path) {
	var a = split1(path, "#")
	var b = split1(a[0], "?")
	var base = b[0]
	var fragment = a[1]
	var query = b[1]
	var queryVars = {}
	if (query) {
		query.split("&").forEach(function(item) {
			item = split1(item, "=")
			if (item[1] == null) {
				queryVars[item[0]] = true
			} else {
				queryVars[item[0]] = item[1]
			}
		})
	}
	return {
		path: base.split("/"),
		query: queryVars,
		fragment: fragment
	}
},

decodePath: function(path) {
	path = parsePath(path)
	var type = path.path[0] || ""
	if (path.path[1] == 'edit') { // ex: pages/edit/123
		var id = path.path[2] != undefined && +path.path[2]
		type = type+"/"+path.path[1]
	} else {
		var id = +path.path[1] || 0
	}
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

	var view = View.views[path.type] || View.views.error
	var cancelled
	if (view.cleanUp)
		view.cleanUp()
	if (view.start) {
		var xhr = view.start(path.id, path.query, function() {
			if (cancelled)
				return
			view.render.apply(null, arguments)
			after()
		})
	} else {
		//(type is passed here so that the error page can display it)
		view.render(path.id, path.query, path.type)
		after()
	}
	cancel = function() {
		if (xhr && xhr.abort) {
			xhr.abort()
		}
		cancelled = true
	}
	function after() {
		// todo: scroll to fragment element
	}
},

<!--/*
		})} //*/

window.onhashchange = function() {
	Nav.render(window.location.hash.substr(1))
}
