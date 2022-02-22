let View = Object.create(null)
with(View)((window)=>{"use strict";Object.assign(View,{
	
	cancel_request: null,
	// this will always be the currently rendered view
	// (set before `render` is called, and unset before `cleanUp` is called)
	// current_view.cleanUp should always be correct!
	current_view: null,
	
	initDone: false,
	runOnLoad: [],
	realTitle: null,
	faviconElement: null,
	
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
				setTitle("Testing")
			},
		},
		test_error: {
			render() {
				throw new Error("heck")
			}
		},
		// alright, so, the way this works
		// first, .start is called. this will usually make an API request.
		// if this fails or something bad happens, it should be handled I think
		// .render will be called IF everything succeeds
		// the first parameter will always exist.
		users: {
			start(id, query, render) {
				return Req.read([
					['user'],
				], {}, (e, resp)=>{
					if (!e)
						render(resp.user)
				}, true)
			},
			className: 'users',
			render(users) {
				setTitle("Users")
				$memberList.childs = users.map((user)=>{
					let bar = Draw.entity_title_link(user)
					bar.className += " linkBar bar rem2-3"
					return bar
				})
			},
			cleanUp() {
				$memberList.childs = null
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
			setTitle(message)
			$errorMessage.textContent = error ? error+"\n"+error.stack : ""
		},
		cleanUp() {
			$errorMessage.textContent = ""
		}
	},
	
	// handle redirects
	getView(name, id, query) {
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
	
	setEntityTitle(entity) {
		$pageTitle.childs = Draw.icon_title(entity)
		document.title = entity.name
		realTitle = entity.name
		changeFavicon(false)
	},
	setTitle(text) {
		$pageTitle.textContent = text
		document.title = text
		realTitle = text
		changeFavicon(false)
	},
	
	setPath(path) {
		$path.childs = Draw.title_path(path)
	},
	setEntityPath(page) {
		if (!page) {
			setPath([])
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
		setPath(path)
	},
	
	loadStart() {
		flag('loading', true)
	},
	loadEnd() {
		flag('loading', false)
	},
	
	flags: {},
	flag(flag, state) {
		if (!flags[flag] != !state) {
			if (state)
				flags[flag] = true
			else
				delete flags[flag]
			document.documentElement.classList[state?'add':'remove']("f-"+flag)
		}
	},
	
	updateMyUser(user) {
		if (user.id != Req.uid)
			return //uh oh
		Req.me = user //This probably shouldn't be handled by View...
		// if this gets called too early, the sidebar isnt even rendered yet
		if (Sidebar.myAvatar) {
			let icon = Draw.icon(user)
			Sidebar.myAvatar.childs = icon
		}
	},
	
	handleView(type, id, query, callback) {
		if (cancel_request) {
			cancel_request()
			cancel_request = null
		}
		let view
		
		let cleanUp = ()=>{
			if (current_view && current_view.cleanUp) {
				try {
					current_view.cleanUp(type, id, query)
				} catch(e) {
					// we ignore this error, because it's probably not important
					// and also cleanUp gets called during error handling so we don't want to get into a loop of errors
					error(e, "error in cleanup function")
				}
			}
			current_view = null
			$main.scrollTop = 0
		}
		
		let after = ()=>{
			// goal: instead of hiding things, we should
			// use the .slide system for all pages etc.
			document.querySelectorAll("v-b").forEach((e)=>{
				e.hidden = !e.hasAttribute("data-view-"+view.className)
			})
			View.flag('splitView', view.splitView==true)
			View.flag('viewReady', true)
			View.flag('mobileSidebar', false) //bad (should be function on Sidebar)
			Lp.set_listening(ChatRoom.listening_rooms())
			Lp.set_statuses(ChatRoom.generateStatus())
			Lp.refresh()
			
			callback && callback()
			// todo: scroll to fragment element
		}
		
		let errorRender = (message, error)=>{
			cleanUp()
			current_view = view = errorView
			view.render(message, error)
			after()
		}
		
		let cancelled = false
		
		let whenPageLoaded = (callback)=>{
			if (cancelled)
				return
			if (initDone)
				callback()
			else {
				console.log("deferring render")
				runOnLoad.push(callback)
			}
		}
		
		try {
			let got_redirect
			;[type, id, query, got_redirect] = getView(type, id, query)
			view = views[type]
			if (got_redirect) {
				Nav.set_location(type, id, query)
			}
		} catch(e) {
			window.ee=e
			error(e, "error during redirect")
			whenPageLoaded(()=>{
				errorRender("error during redirect", e)
			})
			return // ??
		}
		
		let quick= (ren)=>{
			cleanUp()
			current_view = view
			try {
				ren(id, query)
				after()
			} catch(e) {
				errorRender("render failed", e)
			}
			loadEnd()
		}
		
		let xhr
		
		if (!view) {
			whenPageLoaded(()=>{
				errorRender("Unknown page type: \""+type+"\"")
			})
		} else if (view.start) {
			whenPageLoaded(loadStart)
			try { // this catches errors in view.start, NOT the callbacks inside here
				xhr = view.start(id, query, (...args)=>{ // needed because arguments
					let ok = args[0]
					whenPageLoaded(()=>{
						if (cancelled)
							return
						cleanUp()
						if (!ok) {
							let msg = ok==false ? "error 1" : "content not found?"
							errorRender(msg)
						} else {
							current_view = view
							try {
								view.render(...args)
								after()
							} catch(e) {
								errorRender("render failed", e)
							}
						}
						loadEnd()
					})
				}, (e)=>{
					whenPageLoaded(()=>{
						quick(e)
					})
				})
			} catch(e) {
				errorRender("render failed 1", e)
				loadEnd()
			}
		} else {
			whenPageLoaded(()=>{
				loadStart()
				quick(view.render)
			})
		}
		
		cancel_request = ()=>{
			loadEnd()
			xhr && xhr.abort && xhr.abort()
			cancelled = true
		}
		
	},
	
	onLoad() {
		document.querySelectorAll("a[data-static-path]").forEach((elem)=>{
			Nav.link(elem.dataset.staticPath, elem)
		})
		document.querySelectorAll("button:not([data-noreplace])").forEach((button)=>{
			let container = document.createElement("div")
			container.className = "buttonContainer"
			button.replaceWith(container)
			container.className += " "+button.className
			button.className = ""
			if (button.hasAttribute('data-static-link')) {
				button.setAttribute('tabindex', "-1")
				let a = document.createElement('a')
				container.append(a)
				container = a
			}
			container.append(button)
		})
		
		Object.for(views, (view)=>{
			view.name = name
			view.init && view.init()
			// maybe we can just call these the first time the view is visited instead of right away,
			// though none of them should really take a significant amount of time, so whatver
		})
		
		initDone = true
		runOnLoad.forEach((f)=>f())
		runOnLoad = null
		
		// video player does not fire 'click' events so instead
		// need to detect when the video is played
		// using a custom event
		document.addEventListener('videoclicked', (e)=>{
			imageFocusClickHandler(e.target, true)
		})
		document.onmousedown = (e)=>{
			if (!e.button && e.target) // 0 or none (prevent right click etc.)
				imageFocusClickHandler(e.target)
		}
		
		let embiggenedImage
		// clicking outside an image shrinks it
		// maybe could block this if the click is on a link/button?
		document.onclick = (e)=>{
			let element = e.target
			if (!(element instanceof HTMLTextAreaElement)) {
				if (embiggenedImage && element != embiggenedImage) {
					embiggenedImage.removeAttribute('data-big')
					embiggenedImage = null
				}
			}
		}
		
		function imageFocusClickHandler(element, growOnly) {
			if (element.hasAttribute('data-shrink')) {
				// if click on image that's already big:
				if (embiggenedImage && embiggenedImage == element) {
					if (!growOnly) {
						embiggenedImage.removeAttribute('data-big')
						embiggenedImage = null
					}
				} else if (element != embiggenedImage) { // if click on new iamge
					embiggenedImage && embiggenedImage.removeAttribute('data-big')
					element.setAttribute('data-big', "")
					embiggenedImage = element
				}
			}
		}
		
		Sidebar.init()
	},
	
	addView(name, data) {
		data.name = name
		views[name] = data
		initDone && data.init && data.init()
	},
	
	attachPaste(callback) {
		document.addEventListener('paste', (event)=>{
			let data = event.clipboardData
			if (data && data.files) {
				let file = data.files[0]
				if (file && (/^image\//).test(file.type))
					callback(file)
			}
		})
	},
	
	// should be a class (actually nevermind the syntax is gross)
	attachResize(element, tab, horiz, dir, save, callback) {
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
			s && update_size(+s)
		}
		
		function event_pos(e) {
			if (e.touches)
				return e.touches[0][horiz?'pageX':'pageY']
			else
				return e[horiz?'clientX':'clientY']
		}
		function down(e) {
			e.preventDefault()
			tab.setAttribute('dragging',"")
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
			tab.removeAttribute('dragging')
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
	
	commentTitle(comment) {
		titleNotification(comment.content, Draw.avatar_url(comment.createUser, "size=120&crop=true"))
	},
	
	titleNotification(text, icon) {
		if (!Req.me)
			return;
		if (text == false) {
			document.title = realTitle
			changeFavicon(false)
		} else {
			document.title = text
			changeFavicon(icon || false)
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
	
	changeFavicon(src) {
		if (!faviconElement) {
			if (src == false)
				return
			document.head.querySelectorAll("link[data-favicon]").forEach(e=>e.remove())
			faviconElement = document.createElement('link')
			faviconElement.rel = "icon"
			document.head.append(faviconElement)
		} else if (faviconElement.href == src)
			return
		if (src == false)
			src = "resource/icon16.png"
		faviconElement.href = src
	}
	
})<!-- PRIVATE })

0<!-- View ({
})(window)


// todo: id can be a string now,
// so, we need to test if it is valid + in range (positive) in many places
// and handle invalid ids consistently
// so now there are 4 error conditions
// unknown page type
// connection error
// resource not found
// invalid id
