<!--/* trick indenter
var View = Object.create(null)
with (View) (function($) { "use strict"//*/
Object.assign(View, { 

cancelRequest: null,
// this will always be the currently rendered view
// (set before `render` is called, and unset before `cleanUp` is called)
// currentView.cleanUp should always be correct!
currentView: null,

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
		className: 'testMode',
		render() {
			setTitle("Testing")
		},
	},
	// alright, so, the way this works
	// first, .start is called. this will usually make an API request.
	// if this fails or something bad happens, it should be handled I think
	// .render will be called IF everything succeeds
	// the first parameter will always exist.
	users: {
		start(id, query, render) {
			return Req.read([
				"user",
			], {}, (e, resp)=>{
				if (!e)
					render(resp.user)
			}, true)
		},
		className: 'membersMode',
		render(users) {
			setTitle("Users")
			$memberList.childs = users.map((user)=>{
				let bar = Draw.entityTitleLink(user)
				bar.className += " linkBar bar rem2-3"
				return bar
			})
		},
		cleanUp() {
			$memberList.childs = null
		},
		init() {
			$memberNav.append(Draw.navButtons().element)
		}
	},
	pages: {
		redirect: 'page'
	},
},
errorView: {
	className: 'errorMode',
	render(message, error) {
		setTitle(message)
		$errorMessage.textContent = error ? error+"\n"+error.stack : ""
	},
	cleanUp() {
		$errorMessage.textContent = ""
	}
},
getView(name) {
	let view = views[name]
	while (view && view.redirect) //danger!
		view = views[view.redirect]
	return view
},

setEntityTitle(entity) {
	$pageTitle.childs = Draw.iconTitle(entity)
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
	$path.childs = Draw.titlePath(path)
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

updateUserAvatar(user) {
	ChatRoom.updateUserAvatar(user) //todo: don't hardcode this
	if (user.id == Req.uid)
		updateMyUser(user)
},

updateMyUser(user) {
	if (user.id != Req.uid)
		return //uh oh
	Req.me = user //This probably shouldn't be handled by View...
	let icon = Draw.icon(user)
	Sidebar.myAvatar.childs = icon
	//$loggedIn.replaceChildren(Draw.entityTitleLink(user, true))
},

handleView(type, id, query, callback) {
	if (cancelRequest) {
		cancelRequest()
		cancelRequest = null
	}
	let view = getView(type)
	
	function cleanUp() {
		if (currentView && currentView.cleanUp) {
			try {
				currentView.cleanUp(type, id, query)
			} catch(e) {
				console.error("error in cleanup function", e)
			} finally {
				currentView = null
			}
		}
		$main.scrollTop = 0
	}
	
	let xhr
	let cancelled = false
	if (!view) {
		whenPageLoaded(()=>{
			cleanUp()
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
						currentView = view
						try {
							view.render(...args)
							after()
						} catch(e) {
							// cleanUp() maybe?
							errorRender("render failed", e)
						}
					}
					loadEnd()
				})
			}, (e)=>{
				whenPageLoaded(()=>{quick(e)})
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
	
	function whenPageLoaded(callback) {
		if (cancelled)
			return
		if (initDone)
			callback()
		else {
			console.log("deferring render")
			runOnLoad.push(callback)
		}
	}
	
	function quick(ren) {
		cleanUp()
		currentView = view
		try {
			ren(id, query)
			after()
		} catch(e) {
			errorRender("render failed", e)
		}
		loadEnd()
	}
	
	function errorRender(message, error) {
		cleanUp()
		currentView = view = errorView
		view.render(message, error)
		after()
	}
	
	cancelRequest = ()=>{
		loadEnd()
		xhr && xhr.abort && xhr.abort()
		cancelled = true
	}
	
	function after() {
		//$.document.body.className = view.className
		document.querySelectorAll("v-b").forEach((e)=>{
			e.hidden = !e.hasAttribute("data-view-"+view.className)
		})
		View.flag('splitView', view.splitView==true)
		View.flag('viewReady', true)
		View.flag('mobileSidebar', false) //bad (should be function on Sidebar)
		
		Lp.lastListeners = ChatRoom.generateListeners(Lp.lastListeners)
		Lp.statuses = ChatRoom.generateStatus()
		Lp.refresh()
		
		callback && callback()
		// todo: scroll to fragment element
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
				embiggenedImage.removeAttribute('bigImage')
				embiggenedImage = null
			}
		}
	}
	
	function imageFocusClickHandler(element, growOnly) {
		if (element.hasAttribute('shrink')) {
			// if click on image that's already big:
			if (embiggenedImage && embiggenedImage == element) {
				if (!growOnly) {
					embiggenedImage.removeAttribute('bigImage')
					embiggenedImage = null
				}
			} else if (element != embiggenedImage) { // if click on new iamge
				if (embiggenedImage)
					embiggenedImage.removeAttribute('bigImage')
				element.setAttribute('bigImage', "")
				embiggenedImage = element
			}
		}
	}
	Sidebar.onLoad()
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
	
	// should be a class
attachResize(element, tab, horiz, dir, save, callback) {
	let startX,startY,held,startW,startH,size = null
	function getPos(e) {
		if (e.touches)
			return {x:e.touches[0].pageX, y:e.touches[0].pageY}
		else
			return {x:e.clientX, y:e.clientY}
	}
	function down(e) {
		tab.setAttribute('dragging',"")
		let pos = getPos(e)
		startX = pos.x
		startY = pos.y
		startW = element.offsetWidth
		startH = element.offsetHeight
		held = true
	}
	function up() {
		held = false
		tab.removeAttribute('dragging')
		if (save && size != null)
			Store.set(save, size)
	}
	function update_size(px) {
		element.style[horiz ? 'width' : 'height'] = px+"px"
	}
	function move(e) {
		if (!held)
			return
		let pos = getPos(e)
		if (horiz) {
			let vx = (pos.x - startX) * dir
			size = Math.max(0, startW+vx)
		} else {
			let vy = (pos.y - startY) * dir
			size = Math.max(0, startH+vy)
		}
		update_size(size)
		callback && callback(size)
	}
	tab.addEventListener('mousedown', down)
	document.addEventListener('mouseup', up)
	document.addEventListener('mousemove', move)
	
	tab.addEventListener('touchstart', (e)=>{
		e.preventDefault()
		down(e)
	}, {passive:true}) //todo: prevent scrolling on mobile
	document.addEventListener('touchend', up)
	document.addEventListener('touchmove', move)
	if (save) {
		size = Store.get(save)
		if (size) {
			size = Math.max(0, +size)
			update_size(size)
			if (callback) callback(size)
		}
	}
},

commentTitle(comment) {
	titleNotification(comment.content, Draw.avatarURL(comment.createUser, "size=120&crop=true"))
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

<!--/* 
}) //*/

<!--/*
}(window)) //*/


//todo: rename resource to avoid collision with request.js

// todo: id can be a string now,
// so, we need to test if it is valid + in range (positive) in many places
// and handle invalid ids consistently
// so now there are 4 error conditions
// unknown page type
// connection error
// resource not found
// invalid id
