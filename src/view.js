'use strict'

// process of loading a View
// TODO: this was designed before views were changed to classes, so some of it is redundant and needs to be reorganied

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

Markup.renderer.url_scheme['sbs:'] = (url, thing)=>{
	if (thing=='image') {
		if (url.pathname.startsWith("image/"))
			return Req.image_url(url.pathname.substring(6)+url.search)
	}
	return "#"+url.pathname+url.search+url.hash
}

Markup.renderer.url_scheme['https:'] = (url, thing)=>{
	if (url.host == "new.smilebasicsource.com") {
		if (url.pathname.startsWith("/api/File/raw/"))
			url.host = "qcs.shsbs.xyz"
	}
	return url.href	
}

class BaseView {
	constructor(location, slot) {
		this.location = location
		this._protected = false
		this.Slot = slot
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
<view-root style='overflow-y:auto;'>
	<div class='errorPage' $=error_message></div>
	<div class='pre' style='font:var(--T-monospace-font);' $=error_location></div>
</view-root>
`

const View = NAMESPACE({
	views: {__proto__: null},
	lost_textarea: null,
	first: true,
	lost: null,	
	
	protected: new Set(),
	protect(view, state) {
		if (this.protected.has(view)==state)
			return
		
		if (state)
			this.protected.add(view)
		else
			this.protected.delete(view)
		
		if (this.protected.size) {
			if (!window.onbeforeunload)
				window.onbeforeunload = this.beforeunload
		} else {
			if (window.onbeforeunload)
				window.onbeforeunload = null
		}
	},
	beforeunload: ev=>{
		if (View.protected.size)
			ev.preventDefault()
	},
	
	get current() {
		if (Nav.focused)
			return Nav.focused.view
	},
	
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
	
	handle_redirect(location) {
		let view_cls = this.views[location.type]
		if (view_cls && view_cls.Redirect)
			view_cls.Redirect(location)
	},
	
	/// HELPER FUNCTIONS ///
	
	real_title: null,
	set_title(title) {
		// prevent the browser from collapsing sequences of spaces
		// replace every other one with a NBSP
		title = title.replace(/  /g, "  ").replace(/\n/g, "  \n")
		document.title = title
		this.real_title = title
		this.change_favicon(null)
	},
	
	comment_notification(comment) {
		this.title_notification(comment.text, Draw.avatar_url(comment.Author))
	},
	
	// temporarily set <title> and favicon, for displaying a notification
	// pass text=`false` to reset them (todo: why do we use false?unused)
	title_notification(text, icon) {
		if (!Req.me)
			return
		if (text == false) {
			text = this.real_title
			icon = null
		} else {
			text = text.replace(/  /g, "  ").replace(/\n/g, "  \n")
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
				action(ev)
			}
		})
	},
	
	observer: null,
	toggle_observer(state) {
		if (!this.observer == !state)
			return
		if (state) {
			Draw.observer = new IntersectionObserver(Draw.observer_callback)
		} else {
			// todo: we should load all unloaded images here
			Draw.observer.disconnect()
			Draw.observer = null
		}
	},
	
	shrink_all(skip) {
		this.embiggened = false
		for (let e of document.querySelectorAll('[data-big]'))
			if (e !== skip)
				e.removeAttribute('data-big')
	},
	
	embiggened: false,
	
	init() {
		// clicking an image causes it to toggle between big/small
		// we use mousedown so it happens sooner (vs waiting for click)
		document.addEventListener('mousedown', ev=>{
			if (ev.button)
				return
			
			let element = ev.target
			if (!(element instanceof HTMLElement))
				return // this Happens sometimes
			let shrink = element.getAttribute('data-shrink')
			if (shrink==null)
				return
			if (shrink=='video')
				element = element.parentNode
			
			if (!ev.ctrlKey && this.embiggened)
				this.shrink_all(element)
			
			if (!element.hasAttribute('data-big'))
				this.embiggened = true
			
			element.toggleAttribute('data-big')
			//ev.preventDefault()
		})
		
		// clicking outside an image shrinks it
		// maybe could block this if the click is on a link/button?
		document.addEventListener('click', ev=>{
			if (!this.embiggened)
				return
			
			let element = ev.target
			if (element instanceof HTMLTextAreaElement)
				return
			if (element.closest('media-player'))
				return
			if (element.hasAttribute('data-shrink'))
				return
			
			this.shrink_all()
		}, {passive: true})
	},	
})

View.init()

Settings.add({
	name: 'lazy_loading', label: "Image Loading", type: 'select',
	options: ['on', 'off'],
	options_labels: ['when visible', 'immediately'],
	update(value) { // bad
		View.toggle_observer(value=='on')
	},
})

class TestView extends BaseView {
	Start(location) {
		return {quick: true}
	}
	Quick() {
		// evil idea; what if we made shortcuts to access ev.target and currentTarget (ev.t, ev.c) and things like, Node.textContent (node.t) etc.
		this.$inputmode.onchange = ev=>{
			this.$textarea.setAttribute('inputmode', this.$inputmode.value)
		}
		this.$textarea.onkeydown = ev=>{
			this.$out.fill()
			for (let field of ['timeStamp','key','code','location','shiftKey','ctrlKey','altKey','metaKey','repeat','isComposing','keyCode']) {
				this.$out.append(field.padStart(11)+": ")
				this.$out.append(ev[field]+"\n")
			}
		}
		View.set_title("test")
	}
}
TestView.template = HTML`
<view-root class='COL' style='overflow-y:scroll'>
	Key test:
	<div>inputmode:<input $=inputmode autocomplete=off></div>
	<textarea $=textarea></textarea>
	<pre $=out></pre>
</view-root>
`
View.register('test', TestView)

// unfinished
class Paginator {
	constructor() {
		this.page = 1
	}
	read_location(location) {
		this.page = location.query.p | 0 || 1
	}
	write_location(location) {
		if (this.page)
			location.query.p = this.page
		else
			delete location.query.p
	}
}


//
// alert/confirm/prompt is becoming unreliable in ios safari?
// it supports <dialog> now, so we can use that instead
// (I don't particularly like custom popups because they can be unreliable)
// actually what if we just show the info in the sidebar in a temp. tab
// instead?
class Dialog {
	constructor() {
		
	}
}
