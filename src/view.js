'use strict'

// process of loading a View
// TODO: this was designed before views were changed to classes, so some of it is redundant and needs to be reorganied

// - Early is called immediately, after the constructor. it's basically redundant now.

// - Start is called right after Early (this is where you build the api request)
// if Start returns .quick:true, then:
//  - Init is called, then Quick is called
// otherwise:
//  - data is requested from the server
//  - Init is called, then Render is called

// - Visible is called after the view is inserted into the page (i.e. has been rendered and attached to the document. this exists so that, ex: the resizing textarea's size can be calculated)

class BaseView {
	constructor(location) {
		this.location = location
		new.target.template(this)
	}
	Flag(name, state) {
		this.$root.classList.toggle("f-"+name, state)
	}
}

{
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
	
	window.HTML = ([html])=>{
		let temp = document.createElement('template')
		temp.innerHTML = html.replace(/\s*?\n\s*/g, "")
		let content = temp.content
		let root = content
		if (root.childNodes.length==1)
			root = root.firstChild
		
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
}

class ErrorView extends BaseView {
	Init() {
		
	}
}
ErrorView.template = HTML`
<div>
<div class='errorPage' $=error_message></div>
<div class='pre' $=error_location></div>
</div>
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
	
	// modifies `location` param, returns true if redirect happened
	handle_redirects(location) {
		let view = this.views[location.type]
		if (view && view.Redirect) {
			view.Redirect(location)
			Nav.replace_location(location)
			return true
		}
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
	
	load_start() {
		this.flag('loading', true)
	},
	load_end() {
		this.flag('loading', false)
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
		if (this.current && this.current.Cleanup)
			try {
				this.current.Cleanup(new_location)
			} catch (e) {
				// we ignore this error, because it's probably not important
				// and also cleanup gets called during error handling so we don't want to get into a loop of errors
				console.error(e, "error in cleanup function")
				print(e)
			}
		this.current = null
	},
	
	cancel() {
		if (this.loading_view) {
			this.loading_view.return()
			this.loading_view = null
			this.load_end()
		}
	},
	
	loading_view: null,
	
	handle_view(location, callback, onerror) {
		this.cancel()
		this.loading_view = this.handle_view2(location).run(callback, onerror)
	},
	
	// technically STEP could be a global etc. but hhhh ....
	* handle_view2(location) {
		let STEP=yield
		let phase = "..."
		let view
		
		try {
			this.load_start()
			phase = "view lookup"
			this.handle_redirects(location)
			
			let view_class = this.views[location.type]
			view = new view_class(location)
			
			phase = "view.Early"
			view.Early && view.Early()
			
			phase = "view.Start"
			let data = view.Start(location)
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
				this.set_title("Unknown page type")
			} else if (e==='data') {
				this.set_title("Data not found")
			} else {
				console.error("Error during view handling", e)
				this.set_title("Error during: "+phase)
				view.$error_message.fill(Debug.sidebar_debug(e))
				view.$error_location.append(JSON.stringify(location, null, 1))
			}
		}
		this.load_end()
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
	
	// should be a class (actually nevermind the syntax is gross)
	attach_resize(element, tab, horiz, dir, save, callback, def) {
		let start_pos, start_size
		let held = false
		let size = null
		
		tab.addEventListener('mousedown', down)
		tab.addEventListener('touchstart', down)
		document.addEventListener('mouseup', up)
		document.addEventListener('touchend', up)
		document.addEventListener('mousemove', move)
		document.addEventListener('touchmove', move)
		
		if (save) {
			let s = localStorage.getItem(save)
			if (s) {
				update_size(+s)
				return
			}
		}
		if (def!=null)
			update_size(def)
		return
		
		function event_pos(e) {
			if (e.touches)
				return e.touches[0][horiz?'pageX':'pageY']
			else
				return e[horiz?'clientX':'clientY']
		}
		function down(e) {
			if (e.target !== tab)
				return
			e.preventDefault()
			tab.dataset.dragging = ""
			held = true
			start_pos = event_pos(e)
			start_size = element[horiz?'offsetWidth':'offsetHeight']
		}
		function move(e) {
			if (!held)
				return
			let v = (event_pos(e) - start_pos) * dir
			update_size(start_size + v)
		}
		function up(e) {
			delete tab.dataset.dragging
			held = false
			if (save && size != null)
				localStorage.setItem(save, size)
		}
		function update_size(px) {
			size = Math.max(px, 0)
			element.style.setProperty(horiz?'width':'height', size+"px")
			callback && callback(size)
		}
	},
	
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
	
	// temporarily set <title> and favicon, for displaying a chat message
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
	
	favicon_element: null,
	// todo: this stopped working in safari lol...
	change_favicon(src) {
		if (!this.favicon_element) {
			if (src == null)
				return
			// remove the normal favicons
			for (let e of document.head.querySelectorAll('link[rel~="icon"]'))
				e.remove()
			// add our new one
			this.favicon_element = document.createElement('link')
			this.favicon_element.rel = "icon"
			this.favicon_element.href = src
			document.head.prepend(this.favicon_element)
		} else if (this.favicon_element.href != src) {
			//todo: technically we should add back /all/ the icons here
			if (src == null)
				src = "resource/icon16.png"
			this.favicon_element.href = src
		}
	},
	
	// this shouldnt be here i think
	bind_enter(block, action) {
		block.addEventListener('keypress', (e)=>{
			if ('Enter'==e.key && !e.shiftKey) {
				e.preventDefault()
				action()
			}
		})
	},
})

// todo: id can be a string now,
// so, we need to test if it is valid + in range (positive) in many places
// and handle invalid ids consistently
// so now there are 4 error conditions
// unknown page type
// connection error
// resource not found
// invalid id
