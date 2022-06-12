'use strict'
// so really what we need is like, 
// for Content, a few different views

// per Content:
// - chat
// - editing
// - page contents
// - children (category view)

// per User:
// - user (show userpage + ???)

// other:
// - message search
// - content search
// - user search?
// - page create

// personal:
// - user register / password change etc.
// - user info change (avatar etc.)

// todo: View class (oops name collision though...)

// TODO:!!!!!!!!
// idea: the run_on_load system can have multiple event types
// (onload, after initial activity, after lastid, etc)
// 
// ex: we can call .start immediately
// if it does a request, we need to wait for lastId before doing the requst (on SOME page types)
// then we wait for onload, before displaying

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
	
	// create public variables here
	views: {
		test: {
			Init() {
				$testButton.onclick = ()=>{
					let c = $testTextarea.value
					$testOut.textContent="Starting..."
					try {
						let res = eval(c)
						$testOut.textContent="Finished:\n"+res
					} catch (e) {
						$testOut.textContent="Error:\n"+e
					}
				}
				let fields = ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'location', 'isComposing', 'repeat', 'code', 'key', 'charCode', 'char', 'keyCode', 'which']
				$testInput.onkeypress = e=>{
					$testOut2.textContent="onkeypress\n"
					for (let x of fields)
						$testOut2.textContent += x+": "+e[x]+"\n"
				}
				$testInput.onkeydown = e=>{
					let p = ""
					for (let x of fields)
						p += x+": "+e[x]+"\n"
					$testOut3.textContent="onkeydown\n"+p
					if (e.keyCode == 13)
						$testOut4.textContent = "last enter press\n"+p
				}
			},
			Name: 'test',
			Start() {
				return {quick: true}
			},
			Quick() {
				u.set_title("Testing")
			},
		},
		pages: {
			Redirect: (id, query) => ['page', id, query],
		},
	},
	// fake-ish
	errorView: {
		Name: 'error',
		Cleanup() {
			$errorMessage.textContent = ""
		},
	},
	
	// handle redirects
	get_view(location) {
		let view = u.views[location.type]
		let got = false
		while (view && view.Redirect) { //danger!
			let ret = view.Redirect(location.id, location.query)
			if (!ret) // oops no redirect
				break
			;[location.type, location.id, location.query] = ret // somehow this line triggers a bug in eslint
			view = u.views[location.type]
			got = true
		}
		return got
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
			let got_redirect = u.get_view(location)
			view = u.views[location.type]
			if (got_redirect)
				Nav.replace_url(location)
			if (!view)
				throw 'type'
			
			if (view.Early) {
				phase = "view.Early"
				view.Early()
				view.Early = null
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
				view.Init = null
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
			u.current_view = view = u.errorView
			if (e==='type') {
				u.set_title("Unknown page type")
			} else if (e==='data') {
				u.set_title("Data not found")
			} else {
				console.error("Error during view handling", e)
				u.set_title("Error during: "+phase)
				$errorMessage.fill(Debug.sidebar_debug(e))
			}
			//$errorMessage.textContent = e
		}
		u.load_end()
		//throw "heck darn"
		for (let elem of $main_slides.children)
			elem.classList.toggle('shown', elem.dataset.slide == u.current_view.Name)
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
	
	add_view(name, data) {
		data.Name = name
		u.views[name] = data
		data.did_init = false
		Object.seal(data)
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
			if (!e.shiftKey && e.keyCode == 13) {
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
