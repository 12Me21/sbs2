// todo: navigate and view could maybe be merged?

history.scrollRestoration = 'manual' // idk..

Markup.url_scheme["sbs:"] = function(url) {
	return "#"+url.pathname+url.search+url.hash
}

const Nav = {
	ignore: false,
	
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
	
	replace_location(location) {
		Nav.replace_url(Nav.from_location(location))
	},
	
	replace_url(url) {
		Nav.ignore = true
		window.location.replace("#"+url)
		Nav.ignore = false
	},
	
	render(location, callback) {
		View.handle_view(location, callback)
	},
	
	reload: RELOAD,
}
Object.seal(Nav)

window.onhashchange = ()=>{
	if (Nav.ignore)
		return
	current_url = window.location
	let location = Nav.get_url()
	Nav.render(location)
}
// todo: we also need to check onpopstate, perhaps.. because sometimes there's like, a break in the history and forward/back cause a page reload.
