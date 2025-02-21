'use strict'

// todo: also we have BaseView.location and ViewSlot.location,
// kinda redundant? idk (consider: if/when can/should they differ?)
class ViewSlot {
	constructor() {
		//ViewSlot.all.add(this)
		ViewSlot.template(this)
		this.$view = null
		do_when_ready(x=>{
			$main_slides.append(this.$root)
		})
		// todo: dragging should shrink either the left or right neighbor
		// depending on which half of the header you dragged
		//new ResizeBar(this.$root, this.$header, 'right', null)
		
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
		this.$root.addEventListener('mousedown', ev=>{
			this.set_focus()
		}, {passive:true, capture:true})
		this.$root.addEventListener('focusin', ev=>{
			this.set_focus()
		}, {passive:true, capture:true})
		
		this.$close.onclick = ev=>{
			let x = Nav.slots.indexOf(this)
			if (x!=-1)
				Nav.slots.splice(x, 1)
			this.destroy()
			Nav.set_address(true)
		}
		
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
			a.target = x['target'] || '_self'
			let lb = document.createElement('span')
			lb.textContent = x.label
			a.append(lb)
			if (x.icon) {
				lb = document.createElement('span')
				lb.className = 'text-shadow'
				lb.append(x.icon)
				a.prepend(lb)
			}
			this.$header_buttons.append(a)
		}
	}
	// todo: this should support users etc. too?
	set_entity_title(entity) {
		this.title_text = entity.name2
		View.set_title(this.title_text)
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
	
	destroy() {
		if (this.view && View.protected.has(this.view)) {
			let r = confirm("are you sure you want to leave this view?")
			if (!r)
				return false
		}
		
		if (Nav.focused==this) {
			if (Nav.slots[0])
				Nav.slots[0].set_focus()
			else
				Nav.focused=null
		}
		this.cancel()
		this.switch_view(null)
		this.$root.remove()
		//ViewSlot.all.delete(this)
		return true
	}
	
	load() {
		this.cancel()
		this.loading = this.handle_view2(this.location).run(()=>{
			// misc stuff to run after loading:
		}, (err)=>{
			console.error(err)
			alert('unhandled error during view load')
			print(err)
			// idk
		})
	}
	// NEVER set this.view directly, always use switch_view()
	switch_view(view2) {
		// destruct the view
		if (this.view) {
			View.protected.delete(this.view)
			Events.destroy(this.view)
			if (this.view.Destroy)
				try {
					this.view.Destroy(view2)
				} catch (e) {
					console.error(e, "error in cleanup function")
					print(e)
				}
			this.view.Slot = null // just in case
		}
		this.view = view2
		// clean up elements
		this.$header.classList.remove('error')
		if (this.$view)
			this.$view.remove()
		this.$title.fill()
		this.$header_buttons.fill()
		this.$header_extra.fill()
	}
	cancel() {
		if (this.loading) {
			this.loading.return()
			this.loading = null
			this.loading_state(0)
			Lp.flush_statuses() // hhh
		}
	}
	* handle_view2(location) {
		let STEP = yield
		let phase = "..."
		let view, view_cls
		let data
		
		// TODO: this will only fire /if/ the `change` event has fired.
		// if, somehow, a page navigation occurs before your cursor leaves
		// the textarea, it won't know that it's been modified.
		if (this.view && View.protected.has(this.view)) {
			let r = confirm("are you sure you want to leave this view?")
			if (!r) {
				return false
			}
		}
		
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
			this.switch_view(view)
			
			phase = "view.Init"
			view.Init && view.Init()
			
			phase = "rendering"
			data.quick ? view.Quick() : view.Render(resp)
			Object.seal(view)
		} catch (e) {
			yield do_when_ready(STEP)
			
			view = new ErrorView(location)
			this.switch_view(view)
			this.$header.classList.add('error')
			
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
		
		Sidebar.close_fullscreen()
		if (view.Visible)
			view.Visible()
		
		// TODO! statuses fail to update sometimes!! on page load maybe
		Lp.flush_statuses() // todo: handle this better?
		
		if (View.first) {
			console.log("☀️ First page rendered!")
			View.first = false
		}
	}
}
ViewSlot.template = HTML`
<view-slot class='COL'>
	<div class=slot-overlay></div>
	<span tabindex=0 accesskey="q" class='header-focus-anchor'></span>
	<view-header $=header>
		<div>
			<div $=header_extra></div>
			<h1 $=title class='ellipsis'></h1>
		</div>
		<span class='header-buttons ROW' $=header_buttons></span>
		<button $=close class='slot-close'>×</button>
	</view-header>
</view-slot>
`



const Nav = NAMESPACE({
	slots: [], // visible onscreen
	focused: null,
	
	view() {
		if (this.focused)
			return this.focused.view
	},
	
	focused_slot() {
		if (this.focused)
			return this.focused
		if (!this.slots[0])
			this.slots.push(new ViewSlot())
		return this.slots[0]
	},
	
	entity_link(entity) {
		let type = {
			user: 'user',
			content: 'page',
			category: 'category'
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
			slot.destroy()
		}
		this.slots.length = urls.length
		
		this.set_address(true)
		for (let i=0; i<this.slots.length; i++)
			if (changed[i])
				this.slots[i].load()
	},
	
	start() {
		// send users at ?page/123 to #page/123
		if (window.location.hash=="" && window.location.search.length>1 && !window.location.search.startsWith("?api")) {
			let x = new URL(window.location)
			x.hash = "#"+x.search.substring(1)
			x.search = ""
			window.history.replaceState(null, "sbs2", x.href)
		}
		
		this.update_from_fragment(window.location.hash.substring(1))
	},
})

// notes:
/*
- hashchange fires only when the hash CHANGES, not necessarily when window.location.hash is set, or when a link is clicked
- hashchange does NOT fire if the hash is changed by history.replaceState

*/
window.onhashchange = ()=>{
	Nav.update_from_fragment(window.location.hash.substring(1))
}
// TODO: what happens if a user clicks a link before Nav.init()?

document.addEventListener('click', ev=>{
	// if the user clicked a link with a #href url
	let link = ev.target.closest(':any-link')
	if (!link)
		return
	let href = link.getAttribute('href') // note: can't use `link.href`
	let target = link.target
	
	if (href.startsWith('https://oboy.smilebasicsource.com/12/')) {
		href = link.hash
		target = ""
	}
	
	if (!href.startsWith("#"))
		return
	// a
	ev.preventDefault()
	ev.stopPropagation()
	// find nearest slot if we're inside one, otherwise use focused slot
	let slot = link.closest('view-slot')
	slot = (slot && Nav.slots.find(s=>s.$root===slot)) || Nav.focused_slot()
	// load url into slot
	if (target!='self') { //hack
		//ctrl: new slot
		if (ev.ctrlKey || ev.metaKey) {
			slot = new ViewSlot()
			Nav.slots.push(slot)
			slot.set_focus()
		}
		if (!slot.load_url(href.slice(1)))
			Sidebar.close_fullscreen()
	} else {
		// #anchor url
		//todo: actually add the hash into the url??
		let target = slot.$root.querySelector(`a[name="${CSS.escape(href.slice(1))}"]`)
		if (target)
			target.scrollIntoView()
	}
}, {capture:true})

/*window.addEventListener('blur', ev=>{
	if (!history.state)
		history.replaceState(1, "")
})
window.addEventListener('focus', ev=>{
	if (!history.state)
		console.log('state reset!')
})*/

// builtin window.Location — gone, reduced to atoms
class Location {
	constructor(arg1, id, query, frag) {
		if (arguments.length==1) {
			this.parse(arg1)
		} else {
			this.type = arg1
			this.id = id
			this.query = query
			this.fragment = frag || null
		}
	}
	parse(source) {
		let [, type, id, query_str, fragment] = /^(.*?)(?:[/](.*?))?([?&].*?)?(?:[#](.*))?$/.exec(source)
		this.type = decodeURIComponent(type)
		if (id==undefined)
			this.id = null
		else {
			id = decodeURIComponent(id)
			if (/\d+$/y.test(id))
				this.id = +id
			else if (id[0]=="@")
				this.id = id.slice(1)
			else
				this.id = id
		}
		this.query = {}
		if (query_str)
			for (let pair of query_str.match(/[^?&]+/g)) {
				let [key, value] = pair.match(/[^=]*(?==?([^]*))/)
				this.query[decodeURIComponent(key)] = decodeURIComponent(value)
			}
		this.fragment = fragment ? decodeURIComponent(fragment) : null
	}
	toString() {
		// type
		let url = this.type
		// id
		if ('number'==typeof this.id) {
			url += "/"+(this.id|0)
		} else if ('string'==typeof this.id) {
			// maybe we should just make the "@" mandatory for string id?
			url += /\d*$|@/y.test(this.id) ? "/@" : "/"
			url += this.id.replace(/[/]/g, "%2F")
		}
		url = url.replace(/[?&#)~(]+/g, escape)
		// query
		let query = Object.entries(this.query).map(([k,v])=>{
			k = k.replace(/=/g, "%3D")
			return (v ? k+"="+v : k).replace(/[?&#)~(]+/g, escape)
		}).join("&")
		if (query)
			url += "?"+query
		
		// fragment
		if (this.fragment != null)
			url += "#"+this.fragment.replace(/[)~(]+/g, escape)
		
		// make sure url doesn't end with punctuation
		let last = url.slice(-1)
		if (last==".")
			url = url.slice(0,-1)+"%2E"
		else if (",!;:".includes(last))
			url = url.slice(0,-1)+escape(last)
		
		// encode utf-8 etc.
		return encodeURI(url)
	}
	clone() {
		return new Location(this.type, this.id, this.query, this.fragment)
	}
	// read/write query params
	get(key) {
		return this.query[key]
	}
	set(key, value=undefined) {
		if (value==undefined)
			delete this.query[key]
		else
			this.query[key] = value
	}
}
