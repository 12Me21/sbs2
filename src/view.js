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

let View = Object.create(null)
with(View)((window)=>{"use strict"; Object.assign(View, {
	
	cancel_request: null,
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
			name: 'test',
			start() {
				return {quick: true}
			},
			quick() {
				set_title("Testing")
			},
		},
		pages: {
			redirect: (id, query) => ['page', id, query]
		},
	},
	// fake-ish
	errorView: {
		name: 'error',
		cleanup() {
			$errorMessage.textContent = ""
		}
	},
	
	// handle redirects
	get_view(location) {
		let view = views[location.type]
		let got = false
		while (view && view.redirect) {//danger!
			let ret = view.redirect(location.id, location.query)
			if (!ret) // oops no redirect
				break
			;[location.type, location.id, location.query] = ret
			view = views[location.type]
			got = true
		}
		return got
	},
	
	load_start() {
		flag('loading', true)
	},
	load_end() {
		flag('loading', false)
	},
	
	flags: {},
	flag(flag, state) {
		flags[flag] = state
		document.documentElement.classList.toggle("f-"+flag, state)
	},
	
	update_my_user(user) {
		if (user.id != Req.uid)
			return //uh oh
		Req.me = user
		let icon = Draw.avatar(Req.me)
		Sidebar.my_avatar.fill(icon)
	},
	
	cstate: null,
	cancel(newc) {
		if (cstate) {
			cstate.is = true
			load_end()
			cstate = newc
		}
	},
	
	cleanup(new_location) {
		if (current_view && current_view.cleanup)
			try {
				current_view.cleanup(new_location)
			} catch(e) {
				// we ignore this error, because it's probably not important
				// and also cleanup gets called during error handling so we don't want to get into a loop of errors
				console.error(e, "error in cleanup function")
			}
		current_view = null
	},
	
	async handle_view(location) {
		let cancel2 = {}
		let phase = "..."
		let view
		
		try {
			cancel(cancel2)
			
			load_start()
			phase = "getting view"
			let got_redirect = get_view(location)
			view = views[location.type]
			if (got_redirect)
				Nav.replace_url(location)
			if (!view)
				throw "can't find page"
			
			if (view.early) {
				phase = "view.early"
				view.early()
				view.early = null
			}
			phase = "view.start"
			let data = view.start(location.id, location.query)
			let render
			if (data.quick) {
				render = view.quick.bind(view, data.ext)
			} else {
				phase = "starting request"
				let x
				let resp = await {then:fn=>x=Lp.chain(data.chain, fn)}
				if (cancel2.is) return
				
				phase = "view.check"
				if (data.check && !data.check(resp, data.ext))
					throw "data not found"
				render = view.render.bind(view, resp, data.ext)
			}
			await do_when_ready
			if (cancel2.is) return
			cstate = null
			
			if (first)
				console.log("🌄 Rendering first page")
			if (view.init) {
				phase = "view.init"
				view.init()
				view.init = null
			}
			cleanup(location)
			phase = "render"
			render()
		} catch(e) {
			await do_when_ready
			if (cancel2.is) return
			cstate = null
			
			cleanup(location)
			view = errorView
			console.error("error during view handling", e)
			set_title("error during "+phase)
			$errorMessage.textContent = e ? e+"\n"+e.stack : ""
		}
		current_view = view
		load_end()
		for (let elem of $main_slides.children)
			elem.classList.toggle('shown', elem.dataset.slide == current_view.className)
		for (let elem of $titlePane.children) {
			let list = elem.dataset.view
			if (list)
				elem.classList.toggle('shown', list.split(",").includes(current_view.className))
		}
		View.flag('viewReady', true)
		View.flag('mobileSidebar', false) //bad (should be function on Sidebar)
		
		if (first) {
			console.log("☀️ First page rendered!")
			first = false
		}
	},
	
	add_view(name, data) {
		data.name = name
		if (!data.className)
			data.className = name
		views[name] = data
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
			return
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
			// remove the normal favicons
			for (let e of document.head.querySelectorAll("link[data-favicon]"))
				e.remove()
			// add our new one
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
		$pageTitle.fill(Draw.content_label(entity))
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
