'use strict'

// todo: how do we determine the url when multiple slots are open?
//  maybe have a new form, like  page/937~editpage/44

// todo: also we have BaseView.location and ViewSlot.location,
// kinda redundant? idk (consider: if/when can/should they differ?)
class ViewSlot {
	constructor() {
		ViewSlot.template(this)
		this.$view = null
		do_when_ready(x=>{
			$main_slides.append(this.$root)
		})
		// todo: dragging should shrink either the left or right neighbor
		// depending on which half of the header you dragged
		new ResizeBar(this.$root, this.$header, 'right', null)
		
		this.loading = null // Generator
		this.view = null // BaseView
		this.location = null // SbsLocation
		this.url = null // String
		this.load_state = false // Boolean
		Object.seal(this)
	}
	unload() {
		this.cancel()
		this.cleanup(null)
		this.$root.remove()
	}
	
	// display stuff
	set_title(text) {
		let x = document.createElement('span')
		x.className = "pre" // todo: this is silly ..
		x.textContent = text
		this.$title.fill(x)
	}
	add_header_links(items) {
		for (let x of items) {
			let a = document.createElement('a')
			a.href = x.href
			a.textContent = x.label
			this.$header_buttons.append(a)
		}
	}
	// todo: this should support users etc. too?
	set_entity_title(entity) {
		this.$title.fill(Draw.content_label(entity))
	}
	loading_state(state, keep_error) {
		this.load_state = state
		if (!keep_error)
			this.$header.classList.remove('error')
		this.$header.classList.toggle('loading', state)
	}
	
	// functions for loading a view
	set_url(url) {
		let old = this.url
		if (old == url)
			return false
		this.set_location(Nav.parse_url(url))
		if (this.url == old)
			return false
		return true
	}
	set_location(location) {
		View.handle_redirect(location)
		this.url = Nav.unparse_url(location)
		this.location = location
		return true
	}
	load() {
		this.cancel()
		this.loading = this.handle_view2(this.location).run(()=>{
			// misc stuff to run after loading:
			Sidebar.close_fullscreen()
			Lp.flush_statuses(()=>{})
			// TODO! statuses fail to update sometimes!! on page load maybe
		}, (err)=>{
			console.error(err)
			alert('unhandled error during view load')
			print(err)
			// idk
			Sidebar.close_fullscreen()
			Lp.flush_statuses(()=>{})
		})
	}
	cleanup(new_location) {
		if (this.view)
			Events.destroy(this.view)
		if (this.view && this.view.Destroy)
			try {
				this.view.Destroy(new_location)
			} catch (e) {
				console.error(e, "error in cleanup function")
				print(e)
			}
		if (this.$view)
			this.$view.remove()
		this.$header_buttons.fill()
		this.$header_extra.fill()
		this.view = null
	}
	cancel() {
		if (this.loading) {
			this.loading.return()
			this.loading = null
			this.loading_state(false)
		}
	}
	* handle_view2(location) {
		let STEP = yield
		let phase = "..."
		let view, view_cls
		let data
		
		try {
			this.loading_state(true)
			phase = "view lookup"
			view_cls = View.views[location.type]
			if (!view_cls)
				throw 'type'
			
			view = new view_cls(location, this)
			phase = "view.Start"
			data = view.Start(location)
			
			let resp
			if (!data.quick) {
				phase = "starting request"
				resp = yield Lp.chain(data.chain, STEP)
				
				phase = "view.Check"
				if (data.check && !data.check(resp))
					throw 'data'
			}
			yield do_when_ready(STEP)
			
			if (View.first)
				console.log("🌄 Rendering first page")
			
			phase = "cleanup"
			this.cleanup(location)
			
			this.view = view
			phase = "view.Init"
			view.Init && view.Init()
			
			phase = "rendering"
			data.quick ? view.Quick() : view.Render(resp)
			Object.seal(view)
		} catch (e) {
			yield do_when_ready(STEP)
			
			this.cleanup(location)
			this.view = view = new ErrorView(location)
			if (e==='type') {
				this.set_title(`Unknown view: ‘${location.type}’`)
			} else if (e==='data') {
				this.set_title("Data not found")
			} else {
				console.error("Error during view handling", e)
				this.set_title("Error during: "+phase)
				view.$error_message.fill(Debug.sidebar_debug(e))
			}
			view.$error_location.append("location: "+JSON.stringify(location, null, 1))
			this.$header.classList.add('error')
		}
		this.loading_state(false, true)
		//throw "heck darn"
		this.$view = view.$root
		this.$root.append(view.$root)
		if (view.Visible)
			view.Visible()
		
		if (View.first) {
			console.log("☀️ First page rendered!")
			View.first = false
		}
	}
}
ViewSlot.template = HTML`
<view-slot class='COL'>
	<view-header $=header class='bar ellipsis' tabindex=0 accesskey="q">
		<span $=header_extra></span>
		<h1 $=title class='textItem'></h1>
		<span class='header-buttons item' $=header_buttons></span>
	</view-header>
</view-slot>
`



// redirect newdev -> oboy
Markup.renderer.url_scheme['https:'] =
Markup.renderer.url_scheme['http:'] =
	(url, thing)=>{
		if (thing=='image' && url.host=="newdev.smilebasicsource.com")
			url.host = "oboy.smilebasicsource.com"
		return url.href
	}
Markup.renderer.url_scheme['sbs:'] = (url)=>{
	return "#"+url.pathname+url.search+url.hash
}

const Nav = NAMESPACE({
	slots: [],
	
	focused_slot() {
		if (!this.slots[0]) {
			this.slots.push(new ViewSlot())
		}
		return this.slots[0]
	},
	
	/*update_location() {
		let url = this.slots.map(slot=>slot ? this.unparse_url(slot.location) : "").join("~")
		// todo: how to decide whether to pushstate or replacestate?
		// we only want to replace if the update is the result of initial lode, or user editing the address bar.
		// but let's say the page loads, and there are 2 views in the url
		// they both ask to update the address bar,
		// and this should be translated into one replacestate
		// i suppose set a flag when calling .goto or whatever, and then that view uh
		// actually i wonder if we should maybe move the location update out of ViewSlot and into Nav
		// then we update the location BEFORE... yeah
		window.history.pushState(null, "sbs2", "#"+url)
	}*/
	
	entity_link(entity) {
		let type = {
			user: 'user',
			content: 'page',
		}[entity.Type]
		if (!type)
			throw new Error('idk entity type')
		return "#"+type+"/"+entity.id
	},
	
	parse_url(source) {
		let [, type, id, query_str, fragment] = /^(.*?)(?:[/](.*?))?([?&].*?)?(?:[#](.*))?$/.exec(source)
		type = decodeURIComponent(type)
		if (id==undefined)
			id = null
		else {
			id = decodeURIComponent(id)
			if (/^-?\d+$/.test(id))
				id = +id
			else if (id[0]=="@")
				id = id.substring(1)
		}
		let query = {}
		if (query_str)
			for (let pair of query_str.match(/[^?&]+/g)) {
				let [key, value] = pair.match(/[^=]*(?==?([^]*))/)
				query[decodeURIComponent(key)] = decodeURIComponent(value)
			}
		fragment = fragment ? decodeURIComponent(fragment) : null
		return {type, id, query, fragment}
	},
	
	unparse_url(location) {
		function esc(str, regex) {
			// allow: \w - . ! * ' $ + , : ; @
			str = encodeURI(str).replace(/[)~(]+/g, escape)
			if (regex)
				str = str.replace(regex, encodeURIComponent)
			return str
		} // todo make sure this does infact match the url parsing we use here!
		let url = esc(location.type, /[/?&#]+/g)
		if (location.id!=null) {
			url += "/"
			if ('string'==typeof location.id) {
				if (/^-?\d+$|^@/.test(location.id))
					url += "@"
			}
			url += esc(location.id, /[/?&#]+/g)
		}
		
		let query = Object.entries(location.query).map(([k,v])=>{
			k = esc(k, /[?=&#]+/g)
			return v ? k+"="+esc(v, /[?&#]+/g) : k
		}).join("&")
		if (query)
			url += "?"+query
		
		if (location.fragment != null)
			url += "#"+esc(location.fragment)
		
		// don't allow , ! : . as final char
		url = url.replace(/[,!:.]$/, x=>"%"+x.charCodeAt().toString(16))
		
		return url
	},
	
	get_location() {
		// todo: we could use history.state instead of needing to parse the url each time.
		return this.parse_url(window.location.hash.substring(1))
	},
	
	// replace = modify address bar without calling render()
	replace_location(location, replace) {
		let url = this.unparse_url(location)
		window.history[!replace?"pushState":"replaceState"](null, "sbs2", "#"+url)
	},
	
	reload: RELOAD,
	
	update_slot_url(slot, url) {
		if (slot.set_url(url)) {
			window.history.pushState(null, "sbs2", "#"+this.make_url())
			slot.load()
		}
	},
	
	update_slot_location(slot, location) {
		if (slot.set_location(location)) {
			window.history.pushState(null, "sbs2", "#"+this.make_url())
			slot.load()
		}
	},
	
	make_url() {
		return this.slots.map(slot=>slot.url || "").join("~")
	},
	
	update_from_fragment(fragment) {
		let urls = fragment ? fragment.split("~") : []
		let changed = []
		for (let i=0; i<urls.length; i++) {
			let url = urls[i]
			let slot = this.slots[i] || (this.slots[i] = new ViewSlot())
			changed[i] = slot.set_url(url)
		}
		// delete extra slots
		for (let i=urls.length; i<this.slots.length; i++) {
			let slot = this.slots[i]
			slot.unload()
		}
		this.slots.length = urls.length
		
		window.history.replaceState(null, "sbs2", "#"+this.make_url())
		for (let i=0; i<this.slots.length; i++) {
			if (changed[i])
				this.slots[i].load()
		}
	},
	
	start() {
		// send users at ?page/123 to #page/123
		if (window.location.hash=="" && window.location.search.length>1) {
			let x = new URL(window.location)
			x.hash = "#"+x.search.substring(1)
			x.search = ""
			window.history.replaceState(null, "sbs2", x.href)
		}
		
		this.update_from_fragment(window.location.hash.substr(1))
	},
})

// notes:
/*
- hashchange fires only when the hash CHANGES, not necessarily when window.location.hash is set, or when a link is clicked
- hashchange does NOT fire if the hash is changed by history.replaceState

*/
window.onhashchange = ()=>{
	Nav.update_from_fragment(window.location.hash.substr(1))
}

// onclick fires like 20ms before hashchange..
document.addEventListener('click', ev=>{
	let link = ev.target.closest(':any-link')
	if (link) {
		let href = link.getAttribute('href')
		if (href.startsWith("#")) {
			ev.preventDefault()
			Nav.update_slot_url(Nav.focused_slot(), href.substring(1))
		}
	}
})
// TODO: what happens if a user clicks a link before Nav.init()?
