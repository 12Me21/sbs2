// todo: i suspect that quickly doubleclicking the same link is a thing which happens and isnt good

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
		if (query)
			for (let item of query.split("&")) {
				let [key, value] = item.split1("=")
				key = decodeURIComponent(key.trim())
				vars[key] = value==null ? true : decodeURIComponent(value.trim())
			}
		
		path = path.split("/")
		let type = path[0] || ""
		let id = path[1]
		if (id != undefined && /^-?\d+$/.test(id))
			id = +id
		return {path, query: vars, fragment, type, id}
	},
	
	// convert back to url
	encode_path({path, query, fragment}) {
		let url = path.map(url_escape).join("/")
		let params = []
		Object.for(query, (value, key)=>{
			if (value!=undefined) {
				let param = url_escape(key)
				if (value!==true)
					param += "="+url_escape(value)
				params.push(param)
			}
		})
		if (params.length!=0)
			url += "?"+params.join("&")
		if (fragment != null)
			url += "#"+fragment
		return url
	},
	
	haloopdy_path({path, query, fragment}) {
		let url = "https://smilebasicsource.com/"
		let params = ["p="+path.map(url_escape).join("-")] // can escape - though?
		Object.for(query, (value, key)=>{
			if (value!=undefined) {
				let param = url_escape(key)
				if (value!==true)
					param += "="+url_escape(value)
				params.push(param)
			}
		})
		if (params.length!=0)
			url += "?"+params.join("&")
		if (fragment != null)
			url += "#"+fragment
		return url
	},
	
	// no fragment?
	set_location(type, id, query) {
		let url = Nav.encode_path({
			path: id==null ? [type] : [type, String(id)],
			query: query,
		})
		window.history.replaceState(null, "", "?"+url)
	},
	
	render(path, callback) {
		Nav.current_path = path
		path = Nav.decodePath(String(path))
		let {type, id, query} = path
		do_when_ready(()=>{
			$haloopdyLink.href = this.haloopdy_path({
				path: id==null ? [type] : [type, String(id)],
				query: query,
			})
		})
		View.handle_view(type, id, query, callback)
	},
	
	reload() {
		window.location += ""
	},
}
Object.seal(Nav)

window.onpopstate = ()=>{
	Nav.init = true
	Nav.initial_pop = true
	Nav.update_from_location()
}
