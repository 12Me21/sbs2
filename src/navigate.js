// todo: navigate and view could maybe be merged?

Markup.url_scheme["sbs:"] = function(url) {
	return "#"+url.pathname+url.search+url.hash
}

const Nav = {
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
	
	// todo: we should have our own (global) location object or something, rather than passing around urls which are all just the current url anyway
	
	get_location() {
		return Markup.parse_sbs_url(window.location.hash.substr(1))
	},
	
	// replace = modify address bar without calling render()
	replace_location(location) {
		Nav.replace_url(Markup.unparse_sbs_url(location))
	},
	replace_url(url) {
		//Nav.ignore = encodeURI("#"+url) // NOT encodeURIComponent!
		history.replaceState(null, "", "#"+url)
	},
	
	reload: RELOAD,
	
	update_from_location() {
		let location = Nav.get_location()
		console.info("location:", location)
		View.handle_view(location)
		Nav.replace_location(location) // normalize
	},
	
	init() {
		window.onhashchange = ()=>{
			console.info("hash change", window.location.hash)
			Nav.update_from_location()
		}
		
		// send users at ?page/123 to #page/123
		if (window.location.hash=="" && window.location.search.length>1) {
			let x = new URL(window.location)
			x.hash = "#"+x.search.substr(1)
			x.search = ""
			Nav.replace_url(x.href)
		}
		
		Nav.update_from_location()
	},
}
Object.seal(Nav)

// notes:
/*
- hashchange fires only when the hash CHANGES, not necessarily when window.location.hash is set, or when a link is clicked
- hashchange does NOT fire if the hash is changed by history.replaceState

*/
