'use strict'

// process of loading a View
// TODO: this was designed before views were changed to classes, so some of it is redundant and needs to be reorganied

// - .Early() is called immediately, after the constructor. it's basically redundant now.

// - .Start() is called. the data you return determines the api request

// - then, we wait for the request to finish (unless .quick is true)

// - at this point, the transition can no longer be cancelled

// - .Destroy() is called for the OLD view, if there was one

// - .Init() is called. this is where you should attach event listeners, and do any rendering that you can, before the data is received.
//   note:
//    the reason this happens NOW rather than right after .Start() is
//    because, before this point, the view's loading can be cancelled
//    so we don't want to commit to it yet. (note: the template html is cloned immediately, which is probably the more expensive operation anyway. so maybe THAT should be deferred as well?.)

// - .Render or .Quick is called (depending on whether .Start().quick was set). this is where you do the main rendering

// - the view is inserted into the document, and becomes visible

// - .Visible is called. here you can run any code that requires the element to be rendered

class BaseView {
	constructor(location) {
		this.location = location
		new.target.template(this)
		if (!this.$root || this.$root.tagName!='VIEW-ROOT')
			throw new DOMException("view's root node is not '<view-root>'", 'NotSupportedError')
	}
	Flag(name, state) {
		this.$root.classList.toggle("f-"+name, state)
	}
}

let HTML = ([html])=>{
	let temp = document.createElement('template')
	temp.innerHTML = html.replace(/\s*?\n\s*/g, "")
	let content = temp.content
	let root = content
	if (root.childNodes.length==1)
		root = root.firstChild
	
	// get from `root` to `node` using .firstChild and .nextSibling
	// TODO: optimize this  yeah yeah !
	//1: sharing results !
	//  ex. if you have 2 nodes:
	// A = root.firstChild.nextSibling.nextSibling
	// B = root.firstChild.nextSibling.firstChild
	//  then this can be:
	// temp = root.firstChild.nextSibling
	// A = temp.nextSibling
	// B = temp.firstChild
	//2: using .lastChild, .childNodes[n], etc.?
	// i wonder if browsers can optimize it better when it's simple though
	let get_path = (root, node)=>{
		let path = ""
		while (node!==root) {
			let parent = node.parentNode
			let pos = [].indexOf.call(parent.childNodes, node)
			path = ".firstChild"+".nextSibling".repeat(pos) + path
			node = parent
		}
		return path
	}
	
	let init = `const node=document.importNode(this, true)
holder.$root=node`
	for (let node of content.querySelectorAll("[\\$]")) {
		let path = get_path(root, node)
		let id = node.getAttribute('$')
		node.removeAttribute('$')
		id = id.replace(/,/g, " = holder.$")
		init += `
holder.$${id} = node${path}`
	}
	init += `
return holder`
	let c = new Function("holder={}", init).bind(root)
	//c.prototype = {__proto__: null, template: root}
	return c
}

class ErrorView extends BaseView {
	Init() {
		
	}
}
ErrorView.template = HTML`
<view-root>
	<div class='errorPage' $=error_message></div>
	<div class='pre' style='font:var(--T-monospace-font);' $=error_location></div>
</view-root>
`

// so this class is kinda a mess,
// it includes mostly:
// - things which affect the header or entire page (ex: setting the title/favicon)
// - control functions for managing the loading of different views

// hmm idk about using `u` instead of `this` here
// it's nice that we don't rely on `this` binding
// but also means we can't add new methods at runtime
// maybe best to just write View.prop ...
const View = NAMESPACE({
	// this will always be the currently rendered view
	// (set before `render` is called, and unset before `cleanup` is called)
	// current.cleanup should always be correct!
	current: null,
	views: {__proto__: null},
	lost_textarea: null,
	first: true,
	lost: null,
	
	register(name, view_class) {
		if (view_class.Redirect)
			;
		else if (view_class.prototype instanceof BaseView)
			view_class.prototype.Name = name
		else
			throw new TypeError('tried to register invalid view')
		view_class.Name = name
		Object.seal(view_class)
		View.views[name] = view_class
	},
	
	register_redirect(name, func) {
		this.views[name] = {Redirect: func}
	},
	
	// modifies `location` param, returns true if redirect happened
	handle_redirects(location) {
		let view = this.views[location.type]
		if (view && view.Redirect) {
			view.Redirect(location)
			Nav.replace_location(location)
			return true
		}
	},
	
	loading: false,
	$header: null,
	loading_state(state, keep_error) {
		this.loading = state
		do_when_ready(()=>{
			if (!keep_error)
				this.$header.classList.remove('error')
			this.$header.classList.toggle('loading', state)
		})
	},
	
	flags: {},
	flag(flag, state) {
		this.flags[flag] = state
		document.documentElement.classList.toggle("f-"+flag, state)
	},
	
	update_my_user(user) {
		if (user.id != Req.uid)
			throw new TypeError("tried to replace yourself with another user! id:"+user.id)
		Req.me = user
		let icon = Draw.avatar(Req.me)
		Sidebar.$my_avatar.fill(icon)
	},
	
	cleanup(new_location) {
		if (this.current && this.current.Destroy)
			try {
				this.current.Destroy(new_location)
			} catch (e) {
				// we ignore this error, because it's probably not important
				// and also cleanup gets called during error handling so we don't want to get into a loop of errors
				console.error(e, "error in cleanup function")
				print(e)
			}
		this.current = null
	},
	
	loading_view: null,
	cancel() {
		if (this.loading_view) {
			this.loading_view.return()
			this.loading_view = null
			this.loading_state(false)
		}
	},
	
	handle_view(location, callback, onerror) {
		this.cancel()
		this.loading_view = this.handle_view2(location).run(callback, onerror)
	},
	
	// technically STEP could be a global etc. but hhhh ....
	* handle_view2(location) {
		let STEP=yield
		let phase = "..."
		let view
		let data
		
		try {
			this.loading_state(true)
			//yield window.setTimeout(STEP, 1000)
			
			phase = "view lookup"
			this.handle_redirects(location)
			
			let view_class = this.views[location.type]
			if (!view_class)
				throw 'type'
			view = new view_class(location)
			
			phase = "view.Early"
			view.Early && view.Early()
			
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
			
			if (this.first)
				console.log("🌄 Rendering first page")
			
			// this used to run after init, idk why.
			// hopefully that isn't important?
			phase = "cleanup"
			this.cleanup(location) // passing the new location
			$main_slides.fill()
			
			phase = "view.Init"
			view.Init && view.Init()
			
			phase = "rendering"
			this.current = view
			if (data.quick)
				view.Quick()
			else
				view.Render(resp)
		} catch (e) {
			yield do_when_ready(STEP)
			
			this.cleanup(location)
			this.current = view = new ErrorView(location)
			if (e==='type') {
				this.set_title(`Unknown view: ‘${location.type}’`)
			} else if (e==='data') {
				this.set_title("Data not found")
				//view.$error_message.append(JSON.stringify(data, null, 1))
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
		view.$root.classList.add('shown')
		$main_slides.fill(view.$root)
		if (view.Visible)
			view.Visible()
		
		for (let elem of $titlePane.querySelectorAll("[data-view]")) {
			let list = elem.dataset.view
			elem.classList.toggle('shown', list.split(",").includes(this.current.Name))
		}
		Sidebar.close_fullscreen()
		
		Lp.flush_statuses(()=>{})
		
		if (this.first) {
			console.log("☀️ First page rendered!")
			this.first = false
		}
	},
	
	/// HELPER FUNCTIONS ///
	// kinda should move these into like, draw.js idk
	
	// these all set the page's <h1> and <title>, and reset the favicon
	real_title: null,
	set_title2(h1, title) {
		$pageTitle.fill(h1)
		document.title = title
		this.real_title = title
		this.change_favicon(null)
	},
	set_title(text) {
		let x = document.createElement('span')
		x.className = "pre" // todo: this is silly ..
		x.textContent = text
		this.set_title2(x, text)
	},
	// todo: this should support users etc. too?
	set_entity_title(entity) {
		this.set_title2(Draw.content_label(entity), entity.name)
	},
	
	comment_notification(comment) {
		this.title_notification(comment.text, Draw.avatar_url(comment.Author))
		// todo: why don't we dispatch this event directly from the view?
		// and then we can listen for it here and call title_notification
		
		// honestly i want to just make my own event system
		// so i can control bubbling,
		// or rather, the event gets dispatched to the view first, and then
		// to some global thing
		let ev = new CustomEvent('comment_notify', {
			bubbles: false, cancellable: false,
			detail: {comment, view:this.current},
		})
		document.dispatchEvent(ev)
	},
	
	// temporarily set <title> and favicon, for displaying a notification
	// pass text=`false` to reset them (todo: why do we use false?unused)
	title_notification(text, icon) {
		if (!Req.me)
			return
		if (text == false) {
			text = this.real_title
			icon = null
		}
		document.title = text
		this.change_favicon(icon || null)
	},
	
	$favicon: null,
	// todo: this stopped working in safari lol...
	change_favicon(src) {
		if (!this.$favicon) {
			if (src == null)
				return
			// remove the normal favicons
			for (let e of document.head.querySelectorAll('link[rel~="icon"]'))
				e.remove()
			// add our new one
			this.$favicon = document.createElement('link')
			this.$favicon.rel = "icon"
			this.$favicon.href = src
			document.head.prepend(this.$favicon)
		} else if (this.$favicon.href != src) {
			//todo: technically we should add back /all/ the icons here
			if (src == null)
				src = "resource/icon16.png"
			this.$favicon.href = src
		}
	},
	
	// this shouldnt be here i think
	bind_enter(block, action) {
		block.addEventListener('keypress', ev=>{
			if ('Enter'==ev.key && !ev.shiftKey) {
				ev.preventDefault()
				action()
			}
		})
	},
	
	observer: null,
	toggle_observer(state) {
		if (!this.observer == !state)
			return
		if (state) {
			this.observer = new IntersectionObserver(function(data) {
				// todo: load top to bottom on pages
				data = data.filter(x=>x.isIntersecting).sort((a, b)=>b.boundingClientRect.bottom-a.boundingClientRect.bottom)
				for (let {target} of data) {
					if (!target.src) {
						target.src = target.dataset.src
						delete target.dataset.src
						this.unobserve(target)
					}
				}
			})
		} else {
			// todo: we should load all unloaded images here
			this.observer.disconnect()
			this.observer = null
		}
	},
	
	$embiggened: null,
	set_embiggened(img) {
		if (this.$embiggened) delete this.$embiggened.dataset.big
		this.$embiggened = img
		if (this.$embiggened) this.$embiggened.dataset.big = ""
	},
	
	init() {
		// clicking an image causes it to toggle between big/small
		// we use mousedown so it happens sooner (vs waiting for click)
		document.addEventListener('mousedown', ev=>{
			let element = ev.target
			if (ev.button)
				return
			if (!element.hasAttribute('data-shrink'))
				return
			if (element==this.$embiggened)
				element = null // already big: make small
			this.set_embiggened(element)
		}, {passive: true})
		
		// clicking outside an image shrinks it
		// maybe could block this if the click is on a link/button?
		document.addEventListener('click', ev=>{
			let element = ev.target
			// this happens if an image was clicked to expand it.
			// (click fires after mousedown)
			if (element==this.$embiggened)
				return
			if (element instanceof HTMLTextAreaElement)
				return // allow clicking textarea
			this.set_embiggened(null)
		}, {passive: true})
	},
})

View.init()

Settings.add({
	name: 'lazy_loading', label: "lazy image loading", type: 'select',
	options: ['on', 'off'],
	update(value) { // bad
		View.toggle_observer(value=='on')
	},
})

// need to have a better idea of what "current" view means wrt the page header etc.
// like, maybe each view has a separate header element? or do they share
// separate is nicer but makes page layout awkward: now the titlebar 
// is redrawn whenever switching views?
// maybe we have some kind of "slot" object,
// which can have one view loaded within it
// when switching pages, the view is replaced while the slot remains
// and multiple views = multiple slots
