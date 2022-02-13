const Nav = {
	current_path: null,
	initial_pop: false,
	init: false,
	
	entityPath(entity) {
		if (!entity)
			return
		let type = {
			user: 'user',
			content: 'page',
			category: 'category',
		}[entity.Type] || 'unknown'
		
		return type+"/"+entity.id
	},
	
	link(path, element) {
		path = String(path)
		element = element || document.createElement('a')
		element.href = "?"+path
		element.onclick = (e)=>{
			e.preventDefault()
			e.stopPropagation()
			Nav.go(path)
		}
		// a few notes about this
		// first, we need to use onclick because removing event listeners is a MASSIVE pain, especially here. we need to keep a list of old function references, and somehow attach that to the node? idk. WeakMap maybe but that's too new
		// this way, adding a new event will override the old one automatically
		// however, I also use some nested link elements (sorry...)
		// so, this assumes the event will be called on the inner element first
		// which is the default in most browsers, but some old browsers... idk
		return element
	},
	
	go(path) {
		window.history.pushState(null, "", "?"+path)
		// todo: maybe try to update page only after page loads
		Nav.render(path)
	},
	
	// called when site loads to load the initial page
	// should read window.location and
	// eventually call `render`
	initial() {
		// bad browsers will trigger popstate event
		// whenever the page loads
		// (not just from back/forward buttons)
		// this SHOULD happen before DOMContentLoaded,
		// and if it does, cancel the initial loader
		// if it happens AFTER DOMContentLoaded then you're basically fucked though
		if (Nav.init || Nav.initial_pop)
			return
		Nav.initial_pop = true
		Nav.init = true
		Nav.update_from_location()
	},
	
	update_from_location() {
		let path = window.location.search.substr(1)
		Nav.render(path)
	},
	
	// all paths are in the form
	// name[/id][?query][#fragment]
	decodePath(url) {
		let [main, fragment] = url.split1("#")
		let [path, query] = main.split1("?")
		let vars = {}
		query && query.split("&").forEach((item)=>{
			let [key, value] = item.split1("=")
			key = decodeURIComponent(key.trim())
			vars[key] = value==null ? true : decodeURIComponent(value.trim())
		})
		
		path = path.split("/")
		let type = path[0] || ""
		let id = path[1]
		if (id != undefined && /^-?\d+$/.test(id))
			id = +id
		return {path, query: vars, fragment, type, id}
	},
	
	render(path, callback) {
		Nav.current_path = path
		path = Nav.decodePath(String(path))
		// todo: update url when view is redirected
		View.handleView(path.type, path.id, path.query, callback)
	},
	
	reload() {
		window.location += ""
	},
}

window.onpopstate = ()=>{
	Nav.init = true
	Nav.initial_pop = true
	Nav.update_from_location()
}
