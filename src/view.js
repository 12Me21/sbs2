// todo: View class (oops name collision though...)

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
			render() {
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
					check() { return true },
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
	errorView: {
		className: 'error',
		render(message, error) {
			set_title(message)
			$errorMessage.textContent = error ? error+"\n"+error.stack : ""
		},
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
		Req.me = user //This probably shouldn't be handled by View...
		// if this gets called too early, the sidebar isnt even rendered yet
		if (Sidebar.my_avatar) { //should always be set ugh..
			let icon = Draw.icon(user)
			Sidebar.my_avatar.fill(icon)
		}
	},
	
	handle_view(type, id, query, callback) {
		if (cancel_request) {
			cancel_request()
			cancel_request = null
		}
		let view
		
		function cleanup() {
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
		}
		
		function after() {
			load_end()
			
			// children instead of childNodes, because we only want elements (real)
			for (let elem of $main_slides.children)
				elem.classList.toggle('shown', elem.dataset.slide == view.className)
			
			for (let elem of $titlePane.children) {
				let list = elem.dataset.view
				if (list)
					elem.classList.toggle('shown', list.split(",").includes(view.className))
			}
			
			View.flag('viewReady', true)
			View.flag('mobileSidebar', false) //bad (should be function on Sidebar)
			Lp.set_listening(ChatRoom.listening_rooms())
			Lp.set_statuses(ChatRoom.generateStatus())
			Lp.refresh()
			
			callback && callback()
			// todo: scroll to fragment element
		}
		
		let cancelled = false
		
		cancel_request = ()=>{
			load_end()
			cancelled = true
		}
		
		let when_page_loaded = (callback)=>{
			if (cancelled)
				return
			if (init_done)
				callback()
			else {
				console.log("deferring render")
				run_on_load.push(callback)
			}
		}
		
		try {
			let got_redirect
			;[type, id, query, got_redirect] = get_view(type, id, query)
			view = views[type]
			if (got_redirect)
				Nav.set_location(type, id, query)
		} catch(e) {
			error(e, "error during redirect")
			return handle_early_error("error during redirect", e)
		}
		
		// NO VIEW
		if (!view) {
			return handle_early_error("Unknown page type: \""+type+"\"")
		}
		
		load_start()
		
		// SIMPLE VIEW (no request needed)
		if (!view.start) {
			when_page_loaded(()=>{
				handle_quick(view.render)
			})
		// NORMAL VIEW
		} else {
			let need, data
			try {
				;[need, data] = view.start(id, query)
			} catch(e) {
				return handle_early_error("render failed in view.start", e)
			}
			if (need==2) {
				when_page_loaded(()=>{
					handle_quick(data)
				})
			} else if (need==1) {
				let xhr
				cancel_request = ()=>{
					load_end()
					xhr && xhr.abort && xhr.abort()
					cancelled = true
				}
				xhr = Req.read(data.chains, data.fields, (e, resp)=>{
					when_page_loaded(()=>{
						handle_resp(e, resp)
					})
				}, true)
			}
		}
		
		function handle_error(message, e=null) {
			if (e)
				error(e, message)
			else
				console.error(message) //eh
			current_view = view = errorView
			view.render(message, e)
		}
		
		// one of these Handler functions gets called no matter what
		// they should all call `after()` at the end
		
		function handle_early_error(message, e=null) {
			cancel_request = ()=>{}
			when_page_loaded(()=>{
				cleanup()
				handle_error(message, e)
				after()
			})
		}
		
		function handle_quick(func) {
			if (cancelled)
				return
			cleanup()
			current_view = view
			try {
				func(view.render)
			} catch(e) {
				handle_error("render failed in view.quick", e)
			}
			after()
		}
		
		function handle_resp(e, resp) {
			if (cancelled)
				return
			cleanup()
			if (e) {
				handle_error("error 1")
			} else if (!data.check(resp, data.ext)) {
				handle_error("content not found?")
			} else {
				current_view = view
				try {
					view.render(resp, data.ext)
				} catch(e) {
					handle_error("render failed in view.render", e)
				}
			}
			after()
		}		
	},
	
	init() {
		// initialize all views
		Object.for(views, (view)=>{
			view.name = name
			view.init && view.init()
			// maybe we can just call these the first time the view is visited instead of right away,
			// though none of them should really take a significant amount of time, so whatver
		})
		
		init_done = true
		run_on_load.forEach((f)=>f())
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
