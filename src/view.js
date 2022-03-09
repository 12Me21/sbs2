// todo: View class (oops name collision though...)

// TODO:!!!!!!!!
// idea: the run_on_load system can have multiple event types
// (onload, after initial activity, after lastid, etc)
// 
// ex: we can call .start immediately
// if it does a request, we need to wait for lastId before doing the requst (on SOME page types)
// then we wait for onload, before displaying

let View = Object.create(null)
with(View)((window)=>{"use strict";Object.assign(View,{
	
	cancel_request: null,
	// this will always be the currently rendered view
	// (set before `render` is called, and unset before `cleanup` is called)
	// current_view.cleanup should always be correct!
	current_view: null,
	
	init_done: false,
	run_on_load: [],
	real_title: null,
	favicon_element: null,
	
	initial_data: null,
	
	// create public variables here
	views: {
		test: {
			init() {
				$testButton.onclick = ()=>{
					let c = $testTextarea.value
					$testOut.textContent="Starting..."
					try {
						let res = eval(c)
						$testOut.textContent="Finished:\n"+res
					} catch(e) {
						$testOut.textContent="Error:\n"+e
					}
				}
			},
			className: 'test',
			start() {
				return [2, {}]
			},
			quick() {
				set_title("Testing")
			},
		},
		users: {
			start(id, query) {
				return [1, {
					chains: [
						['user'],
					],
					fields: {},
					ext: {},
				}]
			},
			className: 'users',
			render(resp) {
				let users = resp.user
				set_title("Users")
				$memberList.fill(users.map((user)=>{
					let bar = Draw.entity_title_link(user)
					bar.className += " linkBar bar rem2-3"
					return bar
				}))
			},
			cleanup() { // clean_up...
				$memberList.fill()
			},
			init() {
				$memberNav.append(Draw.nav_buttons().element)
			}
		},
		pages: {
			redirect: (id, query) => ['page', id, query]
		},
	},
	// fake-ish
	errorView: {
		className: 'error',
		cleanup() {
			$errorMessage.textContent = ""
		}
	},
	
	// handle redirects
	get_view(name, id, query) {
		let view = views[name]
		let got = false
		while (view && view.redirect) {//danger!
			let ret = view.redirect(id, query)
			if (!ret) // oops no redirect
				break;
			;[name, id, query] = ret
			view = views[name]
			got = true
		}
		return [name, id, query, got]
	},
	
	load_start() {
		flag('loading', true)
	},
	load_end() {
		flag('loading', false)
	},
	
	flags: {},
	flag(flag, state) {
		if (!flags[flag] != !state) {
			if (state)
				flags[flag] = true
			else
				delete flags[flag]
			document.documentElement.classList.toggle("f-"+flag, state)
		}
	},
	
	update_my_user(user) {
		if (user.id != Req.uid)
			return //uh oh
		let icon = Draw.icon(user)
		Sidebar.my_avatar.fill(icon)
	},
	
	cleanup(type) {
		if (!current_view)
			return
		try {
			if (current_view.cleanup)
				current_view.cleanup(type, id, query)
		} catch(e) {
			// we ignore this error, because it's probably not important
			// and also cleanup gets called during error handling so we don't want to get into a loop of errors
			error(e, "error in cleanup function")
		}
		current_view = null
		//$main.scrollTop = 0 TODO, scroll the correct element here
	},
	
	after() {
		load_end()
		console.log("after")
		
		// children instead of childNodes, because we only want elements (real)
		for (let elem of $main_slides.children)
			elem.classList.toggle('shown', elem.dataset.slide == current_view.className)
		
		for (let elem of $titlePane.children) {
			let list = elem.dataset.view
			if (list)
				elem.classList.toggle('shown', list.split(",").includes(current_view.className))
		}
		
		View.flag('viewReady', true)
		View.flag('mobileSidebar', false) //bad (should be function on Sidebar)
		// todo: why are we doing this NOW instead of preemptively?
		Lp.set_listening(ChatRoom.listening_rooms())
		Lp.set_statuses(ChatRoom.generateStatus())
		Lp.refresh()
		// todo: scroll to fragment element
	},
	
	do_when_ready(go) {
		if (init_done) {
			go()
		} else {
			console.log("deferring render")
			run_on_load.push(go)
		}
	},
	
	// rn the `after2` callback is never used, but it's meant to be like,
	// called after rendering, to handle scrolling down to fragment links and whatever, I think
	handle_view(type, id, query, after2) {
		if (cancel_request) {
			cancel_request()
			cancel_request = null
		}
		
		load_start()
		
		let cancelled = false
		cancel_request = ()=>{
			load_end()
			cancelled = true
		}
		
		let view
		
		// must call this exactly once
		// and must be the last call made
		function handle(callback) {
			if (cancelled)
				return
			do_when_ready(()=>{
				if (cancelled)
					return
				cleanup(type)
				callback()
				current_view = view
				after()
				after2 && after2()
			})
		}
		
		// returns true if failed
		function attempt(msg, func) {
			try {
				func()
			} catch(e) {
				handle_error(msg, e)
				return true
			}
			return false
		}
		
		// handle view redirects
		if (attempt("error during redirect", ()=>{
			let got_redirect
			;[type, id, query, got_redirect] = get_view(type, id, query)
			view = views[type]
			if (got_redirect)
				Nav.set_location(type, id, query)
		}))
			return
		
		// NO VIEW
		if (!view)
			return handle_error("Unknown page type: \""+type+"\"")
		
		// call view.start
		let data
		if (attempt("render failed in view.start", ()=>{
			data = view.start(id, query)
		}))
			return
		
		// if we can render the page immediately
		if (data.quick)
			return handle(attempt.bind(
				null,
				"render failed in view.quick", 
				view.quick.bind(view, data.ext, view.render)))
		// otherwise prepare to make an api request
		let xhr
		cancel_request = ()=>{
			load_end()
			xhr && xhr.abort && xhr.abort()
			cancelled = true
		}
		let do_first = !initial_data
		xhr = Req.read(data.chains, data.fields, (e, resp, first)=>{
			// handle the response
			if (e)
				return handle_error("error 1")
			
			if (first) {
				console.log("View: got first!")
				initial_data = true
			}
			
			if (data.check && !data.check(resp, data.ext)) // try/catch here?
				return handle_error("content not found?")
			return handle(attempt.bind(
				null,
				"render failed in view.render",
				view.render.bind(view, resp, data.ext)))
			
		}, do_first)
		
		function handle_error(message, e=null) {
			handle(()=>{
				view = errorView
				if (e)
					error(e, message)
				else
					console.error(message) //eh
				// RENDER
				set_title(message)
				$errorMessage.textContent = e ? e+"\n"+e.stack : ""
			})
		}
		
	},
	
	onload() {
		// initialize all views
		Object.for(views, (view)=>{
			view.name = name
			try {
				view.init && view.init()
			} catch(e) {
				print("error in view init! ", view.name)
				console.error("Error in view init!", e)
			}
			// maybe we can just call these the first time the view is visited instead of right away,
			// though none of them should really take a significant amount of time, so whatver
		})
		
		init_done = true
		for (let f of run_on_load)
			f()
		run_on_load = null
		
		// set up event handlers:
		
		// video player does not fire 'click' events so instead
		// need to detect when the video is played
		// using a custom event
		document.addEventListener('videoclicked', (e)=>{
			image_focus_click_handler(e.target, true)
		})
		document.onmousedown = (e)=>{
			if (!e.button && e.target) // 0 or none (prevent right click etc.)
				image_focus_click_handler(e.target)
		}
		
		let embiggened_image
		// clicking outside an image shrinks it
		// maybe could block this if the click is on a link/button?
		document.onclick = (e)=>{
			let element = e.target
			if (!(element instanceof HTMLTextAreaElement)) {
				if (embiggened_image && element != embiggened_image) {
					delete embiggened_image.dataset.big
					embiggened_image = null
				}
			}
		}
		
		function image_focus_click_handler(element, grow_only) {
			if (element.dataset.shrink!=undefined) {
				// if click on image that's already big:
				if (embiggened_image && embiggened_image == element) {
					if (!grow_only) {
						delete embiggened_image.dataset.big
						embiggened_image = null
					}
				} else if (element != embiggened_image) { // if click on new iamge
					embiggened_image && delete embiggened_image.dataset.big
					element.dataset.big = ""
					embiggened_image = element
				}
			}
		}
	},
	
	add_view(name, data) {
		data.name = name
		views[name] = data
		init_done && data.init && data.init()
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
			let s = Store.get(save)
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
				Store.set(save, size)
		}
		function update_size(px) {
			size = Math.max(px, 0)
			element.style[horiz?'width':'height'] = size+"px"
			callback && callback(size)
		}
	},
	
	title_notification(text, icon) {
		if (!Req.me)
			return;
		if (text == false) {
			document.title = real_title
			change_favicon(null)
		} else {
			document.title = text
			change_favicon(icon || null)
		}
	},
	
	change_favicon(src) {
		if (!favicon_element) {
			if (src == null)
				return
			document.head.querySelectorAll("link[data-favicon]").forEach(e=>e.remove())
			favicon_element = document.createElement('link')
			favicon_element.rel = "icon"
			favicon_element.href = src
			document.head.append(favicon_element)
		} else if (favicon_element.href != src) {
			if (src == null)
				src = "resource/icon16.png"
			favicon_element.href = src
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
	set_entity_title(entity) {
		$pageTitle.fill(Draw.icon_title(entity))
		document.title = entity.name
		real_title = entity.name
		change_favicon(null)
	},
	set_title(text) {
		$pageTitle.textContent = text
		document.title = text
		real_title = text
		change_favicon(null)
	},
	
	// set path (in header)
	set_path(path) {
		$path.fill(Draw.title_path(path))
	},
	set_entity_path(page) {
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
	},
	
})<!-- PRIVATE })

0<!-- View ({
})(window)
Object.seal(View)

// todo: id can be a string now,
// so, we need to test if it is valid + in range (positive) in many places
// and handle invalid ids consistently
// so now there are 4 error conditions
// unknown page type
// connection error
// resource not found
// invalid id
