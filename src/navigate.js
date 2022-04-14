// todo: navigate and view could maybe be merged?

Markup.url_scheme["sbs:"] = function(url) {
	return "#"+url.pathname+url.search+url.hash
}

const Nav = {
	ignore: false,
	
	entity_link(entity) {
		let type = {
			user: 'user',
			content: 'page',
		}[entity.Type]
		if (!type)
			throw new Error('idk entity type')
		return "#"+type+"/"+entity.id
	},
	
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
	
	// all paths are in the form
	// name[/id][?query][#fragment]
	to_location(url_str) {
		// /^(.*?)(|[?].*?)(|[#].*)$/.exec(url)
		let url = new URL("sbs:"+url_str)
		// replace ? with &, so, ex: "?x?y" parses as 2 items
		url.search = url.search.replace(/^|[?]/g, "")
		let query = Object.fromEntries(url.searchParams.entries())
		
		let [, type, id=null, num_id] = /^([^/]*)[/]?((-?\d+$)|[^]*)?$/.exec(url.pathname)
		if (num_id)
			id = +num_id
		
		// todo: we should have our own (global) location object or something, rather than passing around urls which are all just the current url anyway
		return {type, id, query, fragment:url.hash.substr(1)}
	},
	
	// convert back to url
	from_location(location) {
		let url = url_escape(location.type)
		if (location.id != null)
			url += "/"+url_escape(location.id)
		let query = new URLSearchParams(location.query).toString()
		if (query)
			url += "?"+query
		if (location.fragment != null)
			url += "#"+fragment
		
		return url
	},
	
	get_url() {
		return Nav.to_location(window.location.hash.substr(1))
	},
	
	// replace = modify address bar without calling render()
	replace_location(location) {
		Nav.replace_url(Nav.from_location(location))
	},
	replace_url(url) {
		Nav.ignore = true
		window.location.replace("#"+url)
		Nav.ignore = false
	},
	
	render(location, callback) {
		View.handle_view(location).then(callback)
	},
	
	reload: RELOAD,
	
	update_from_location() {
		if (Nav.ignore)
			return
		current_url = window.location
		let location = Nav.get_url()
		Nav.render(location)
	},
	
	init() {
		window.onhashchange = ()=>{
			Nav.update_from_location()
		}
		
		// send users at ?page/123 to #page/123
		if (window.location.hash=="" && window.location.search.length>1)
			Nav.replace_url(window.location.search.substr(1))
		
		Nav.update_from_location()
	},
}
Object.seal(Nav)
