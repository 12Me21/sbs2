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
			init += `
holder.$${id} = node${path}`
		}
		let c = new Function("holder", init).bind(root)
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
const View = ((u=NAMESPACE({
	// this will always be the currently rendered view
	// (set before `render` is called, and unset before `cleanup` is called)
	// current_view.cleanup should always be correct!
	current_view: null,
	
	first: true,
	
	real_title: null,
	favicon_element: null,
	
	views: {__proto__: null},
	
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
		let view = u.views[location.type]
		if (view && view.Redirect) {
			view.Redirect(location)
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
		u.flag('loading', true)
	},
	load_end() {
		u.flag('loading', false)
	},
	
	flags: {},
	flag(flag, state) {
		u.flags[flag] = state
		document.documentElement.classList.toggle("f-"+flag, state)
	},
	
	update_my_user(user) {
		if (user.id != Req.uid)
			return //uh oh
		Req.me = user
		let icon = Draw.avatar(Req.me)
		Sidebar.my_avatar.fill(icon)
	},
	
	cleanup(new_location) {
		if (u.current_view && u.current_view.Cleanup)
			try {
				u.current_view.Cleanup(new_location)
			} catch (e) {
				// we ignore this error, because it's probably not important
				// and also cleanup gets called during error handling so we don't want to get into a loop of errors
				console.error(e, "error in cleanup function")
				print(e)
			}
		u.current_view = null
	},
	
	cancel() {
		if (u.loading_view) {
			u.loading_view.return()
			u.loading_view = null
			u.load_end()
		}
	},
	
	loading_view: null,
	
	handle_view(location, callback, onerror) {
		u.cancel()
		u.loading_view = u.handle_view2(location).run(callback, onerror)
	},
	
	// technically STEP could be a global etc. but hhhh ....
	* handle_view2(location) {
		let STEP=yield
		let phase = "..."
		let view
		
		try {
			u.load_start()
			phase = "view lookup"
			let got_redirect = u.handle_redirects(location)
			let view_class = u.views[location.type]
			if (got_redirect)
				Nav.replace_location(location)
			view = new view_class(location)
			
			if (view.Early) {
				phase = "view.Early"
				view.Early()
			}
			phase = "view.Start"
			let data = view.Start(location)
			let resp
			if (!data.quick) {
				phase = "starting request"
				resp = yield Lp.chain(data.chain, STEP)
				
				phase = "view.Check"
				if (data.check && !data.check(resp, data.ext))
					throw 'data'
			}
			yield do_when_ready(STEP)
			
			if (u.first)
				console.log("🌄 Rendering first page")
			if (view.Init) {
				phase = "view.Init"
				view.Init()
			}
			u.cleanup(location)
			phase = "rendering"
			u.current_view = view
			if (data.quick)
				view.Quick(data.ext, location)
			else
				view.Render(resp, data.ext, location)
		} catch (e) {
			yield do_when_ready(STEP)
			
			u.cleanup(location)
			u.current_view = view = new ErrorView(location)
			if (e==='type') {
				u.set_title("Unknown page type")
			} else if (e==='data') {
				u.set_title("Data not found")
			} else {
				console.error("Error during view handling", e)
				u.set_title("Error during: "+phase)
				view.$error_message.fill(Debug.sidebar_debug(e))
				view.$error_location.append(JSON.stringify(location, null, 1))
			}
			//$errorMessage.textContent = e
		}
		u.load_end()
		//throw "heck darn"
		//for (let elem of $main_slides.children)
		//	elem.classList.toggle('shown', elem.dataset.slide == u.current_view.Name)
		view.$root.classList.add('shown')
		$main_slides.fill(view.$root)
		if (view.Visible)
			view.Visible()
		
		for (let elem of $titlePane.children) {
			let list = elem.dataset.view
			if (list)
				elem.classList.toggle('shown', list.split(",").includes(u.current_view.Name))
		}
		u.flag('viewReady', true)
		Sidebar.close_fullscreen()
		
		Lp.flush_statuses(()=>{})
		
		if (u.first) {
			console.log("☀️ First page rendered!")
			u.first = false
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
	
	title_notification(text, icon) {
		if (!Req.me)
			return
		if (text == false) {
			document.title = u.real_title
			u.change_favicon(null)
		} else {
			document.title = text
			u.change_favicon(icon || null)
		}
	},
	
	change_favicon(src) {
		if (!u.favicon_element) {
			if (src == null)
				return
			// remove the normal favicons
			for (let e of document.head.querySelectorAll('link[rel~="icon"]'))
				e.remove()
			// add our new one
			u.favicon_element = document.createElement('link')
			u.favicon_element.rel = "icon"
			u.favicon_element.href = src
			document.head.prepend(u.favicon_element)
		} else if (u.favicon_element.href != src) {
			if (src == null)
				src = "resource/icon16.png"
			u.favicon_element.href = src
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
	
	// set tab <title>
	// todo: now this only works on Content, not all entities?
	set_entity_title(entity) {
		$pageTitle.fill(Draw.content_label(entity))
		document.title = entity.name
		u.real_title = entity.name
		u.change_favicon(null)
	},
	// todo: maybe this belongs on BaseView?
	set_title(text) {
		let x = document.createElement('span')
		x.className = "pre" // this is silly ..
		x.textContent = text
		$pageTitle.fill(x)
		document.title = text
		u.real_title = text
		u.change_favicon(null)
	},
	
	// set path (in header)
	set_path(path) {
		$path.fill(Draw.title_path(path))
	},
	/*set_entity_path(page) {
		if (!page) {
			set_path([])
			return
		}
		let node = page.Type=='category' ? page : page.parent
		let path = []
		while (node) {
			path.unshift([Nav.entityPath(node), node.name])
			node = node.parent
		}
		if (page.Type == 'category')
			path.push(null)
		else
			path.push([Nav.entityPath(page), page.name])
		set_path(path)
	},*/
	
}))=>u)()

// todo: id can be a string now,
// so, we need to test if it is valid + in range (positive) in many places
// and handle invalid ids consistently
// so now there are 4 error conditions
// unknown page type
// connection error
// resource not found
// invalid id
