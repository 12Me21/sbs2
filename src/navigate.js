'use strict'

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
		this.title_text = null
		this.changed = false
		
		if (!Nav.focused)
			this.set_focus()
		
		// intercept links, and load them in the current slot rather than the default/focused one
		let lh = Nav.link_handler(url=>{
			this.load_url(url)
		})
		this.$root.addEventListener('click', ev=>{
			this.set_focus()
			lh(ev)
		}, {useCapture:true})
		/*this.$root.onmousedown = ev=>{
			this.set_focus()
		}*/
		this.$root.addEventListener('focusin', ev=>{
			this.set_focus()
		})
		
		Object.seal(this)
	}
	set_focus() {
		if (Nav.focused==this)
			return
		if (Nav.focused)
			Nav.focused.$root.classList.remove('focused')
		Nav.focused = this
		Nav.focused.$root.classList.add('focused')
	}
	
	// display stuff
	set_title(text) {
		// todo: set this.title_text and then we determine the page title based on which View/Slot is focused
		this.title_text = text
		View.set_title(text)
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
		this.title_text = entity.name
		View.set_title(entity.name)
		this.$title.fill(Draw.content_label(entity))
	}
	loading_state(state) {
		this.load_state = state
		this.$header.classList.toggle('rendering', state==2)
		this.$header.classList.toggle('loading', state==1)
	}
	
	/// functions for loading a view into the slot ///
	
	load_url(url, suppress=false) {
		if (this.url == url)
			return false
		return this.load_location(Nav.parse_url(url), suppress)
	}
	load_location(location, suppress=false) {
		let old = this.url
		View.handle_redirect(location)
		this.url = Nav.unparse_url(location)
		this.location = location
		if (suppress)
			return this.url != old
		Nav.set_address()
		if (this.url == old)
			// ex: if you try to change page/937 -> page/0937 or something
			return false
		this.load()
		return true
	}
	
	unload() {
		this.cancel()
		this.cleanup(null)
		this.$root.remove()
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
		this.$header.classList.remove('error')
		if (this.$view)
			this.$view.remove()
		this.$title.fill()
		this.$header_buttons.fill()
		this.$header_extra.fill()
		this.view = null
	}
	cancel() {
		if (this.loading) {
			this.loading.return()
			this.loading = null
			this.loading_state(0)
		}
	}
	* handle_view2(location) {
		let STEP = yield
		let phase = "..."
		let view, view_cls
		let data
		
		try {
			this.loading_state(1)
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
			
			this.loading_state(2)
			yield window.setTimeout(STEP)
			
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
			this.$header.classList.add('error')
			this.view = view = new ErrorView(location)
			if (e==='type') {
				this.set_title(`🚧 Unknown view: ‘${location.type}’`)
			} else if (e==='data') {
				this.set_title("🪹️ Data not found")
			} else {
				console.error("Error during view handling", e)
				this.set_title("💥 Error during: "+phase)
				view.$error_message.fill(Debug.sidebar_debug(e))
			}
			view.$error_location.append("location: "+JSON.stringify(location, null, 1))
		}
		this.loading_state(0)
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
	focused: null,
	
	focused_slot() {
		if (this.focused)
			return this.focused
		if (!this.slots[0])
			this.slots.push(new ViewSlot())
		this.slots[0].set_focus() // hhhh
		return this.focused
	},
	
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
	
	reload: RELOAD,
	
	set_address(replace=false) {
		//print('setting address: '+(replace?'replaceState':'pushState'), new Error('get the stack'))
		window.history[replace?'replaceState':'pushState'](null, "sbs2", this.make_url())
	},
	
	make_url() {
		return "#"+this.slots.map(slot=>slot.url || "").join("~")
	},
	
	update_from_fragment(fragment) {
		let urls = fragment ? fragment.split("~") : []
		let changed = []
		// TODO: try to match even if the order has changed
		// ex: if url changes from "page/937" to "editpage~page/937"
		// don't reload page/937, just move it
		
		for (let i=0; i<urls.length; i++) {
			let url = urls[i]
			let slot = this.slots[i] || (this.slots[i] = new ViewSlot())
			changed[i] = slot.load_url(url, true)
		}
		// delete extra slots
		for (let i=urls.length; i<this.slots.length; i++) {
			let slot = this.slots[i]
			slot.unload()
		}
		this.slots.length = urls.length
		
		this.set_address(true)
		for (let i=0; i<this.slots.length; i++)
			if (changed[i])
				this.slots[i].load()
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
	
	link_handler(callback) {
		return ev=>{
			let link = ev.target.closest(':any-link')
			if (!link)
				return
			let href = link.getAttribute('href') // need to use getattr because link.href is an absolute url, not the actual attribute value
			if (!href.startsWith("#"))
				return
			ev.preventDefault()
			ev.stopPropagation()
			callback(href.substring(1), ev)
		}
	}
})

// notes:
/*
- hashchange fires only when the hash CHANGES, not necessarily when window.location.hash is set, or when a link is clicked
- hashchange does NOT fire if the hash is changed by history.replaceState

*/
window.onhashchange = ()=>{
	Nav.update_from_fragment(window.location.hash.substr(1))
}
// only for links that aren't inside a slot (i.e. ones in the sidebar)
document.addEventListener('click', Nav.link_handler(url=>{
	Nav.focused_slot().load_url(url)
}))
// TODO: what happens if a user clicks a link before Nav.init()?
