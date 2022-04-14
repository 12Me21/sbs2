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
		// todo: make this a standard part of Markup
		let [, type, id, num_id, query_str, fragment] = /^(.*?)([/](-?\d+?)|[/][^]*?)?([?&].*?)?([#].*)?$/.exec(url_str)
		if (num_id)
			id = +num_id
		else
			id = id.substr(1)
		
		let query
		if (query_str)
			query = Object.fromEntries(query_str.substr(1).split(/[?&]/g).map(x=>/^[^=]*(?==?(.*)$)/.exec(x).map(decodeURIComponent)))
		
		// todo: we should have our own (global) location object or something, rather than passing around urls which are all just the current url anyway
		if (fragment)
			fragment = fragment.substr(1)
		
		return {type, id, query, fragment}
	},
	
	// convert back to url
	from_location(location) {
		let url = url_escape(location.type)
		if (location.id != null)
			url += "/"+url_escape(""+location.id)
		let query = new URLSearchParams(location.query).toString()
		if (query)
			url += "?"+query
		if (location.fragment != null)
			url += "#"+fragment
		
		return url
	},
	
	get_location() {
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
	
	reload: RELOAD,
	
	update_from_location() {
		if (Nav.ignore)
			return
		current_url = window.location
		let location = Nav.get_location()
		View.handle_view(location)
		Nav.replace_location(location) // normalize
	},
	
	init() {
		window.onhashchange = ()=>{
			Nav.update_from_location()
		}
		
		// send users at ?page/123 to #page/123
		if (window.location.hash=="" && window.location.search.length>1) {
			let x = new URL(window.location)
			x.hash = "#"+x.search.substr(1)
			x.search = ""
			Nav.ignore = true
			window.history.replaceState(null, "", x.href)
			Nav.ignore = false
		}
		
		Nav.update_from_location()
	},
}
Object.seal(Nav)
