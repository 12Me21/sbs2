Markup.url_scheme["sbs:"] = function(url) {
	return "#"+url.pathname+url.search+url.hash
}

const Nav = {
	current_path: null,
	
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
		element.href = "#"+path
		// however, I also use some nested link elements (sorry...)
		// so, this assumes the event will be called on the inner element first
		// which is the default in most browsers, but some old browsers... idk
		return element
	},
	
	go(path) {
		// todo: maybe try to update page only after page loads
		Nav.render(path)
	},
	
	// called when site loads to load the initial page
	// should read window.location and
	// eventually call `render`
	initial() {
		Nav.update_from_location()
	},
	
	update_from_location() {
		let path = window.location.hash.substr(1)
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
	
	// no fragment?
	set_location(type, id, query) {
		let url = Nav.encode_path({
			path: id==null ? [type] : [type, String(id)],
			query: query,
		})
		window.location.hash="#"+url
	},
	
	render(path, callback) {
		console.log('hello?')
		Nav.current_path = path
		path = Nav.decodePath(String(path))
		let {type, id, query} = path
		View.handle_view(type, id, query, callback)
	},
	
	reload() {
		/// TODO: surely there's a better way?
		window.location.search = window.location.search ? "" : "?"
	},
}
Object.seal(Nav)

window.onhashchange = ()=>{
	Nav.update_from_location()
}
