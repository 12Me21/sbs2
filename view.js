<!--/* trick indenter
var View = Object.create(null)
with (View) (function($) { "use strict"
Object.assign(View, { //*/

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
		init: function() {
			$testButton.onclick = function() {
				var c = $testTextarea.value
				$testOut.textContent="Starting..."
				try {
					var res = eval(c)
					$testOut.textContent="Finished:\n"+res
				} catch(e) {
					$testOut.textContent="Error:\n"+e
				}
			}
		},
		className: 'testMode',
		render: function() {
			setTitle("Testing")
		},
	},
	// alright, so, the way this works
	// first, .start is called. this will usually make an API request.
	// if this fails or something bad happens, it should be handled I think
	// .render will be called IF everything succeeds
	// the first parameter will always exist.
	users: {
		start: function(id, query, render) {
			return Req.getUsersView(render)
		},
		className: 'membersMode',
		render: function(users) {
			setTitle("Users")
			users.forEach(function(user) {
				var bar = Draw.entityTitleLink(user)
				bar.className += " linkBar bar rem2-3"
				$memberList.appendChild(bar)
			})
		},
		cleanUp: function() {
			$memberList.replaceChildren()
		},
		init: function() {
			var nav = $memberNav
			nav.appendChild(Draw.navButtons().element)
		}
	},
	pages: {
		redirect: 'page'
	},
},
errorView: {
	className: 'errorMode',
	render: function(message, error) {
		setTitle(message)
		if (error)
			$errorMessage.textContent = error+"\n"+error.stack
		else
			$errorMessage.textContent = ""
	},
	cleanUp: function() {
		$errorMessage.replaceChildren()
	}
},
getView: function(name) {
	var view = views[name]
	while (view && view.redirect) //danger!
		view = views[view.redirect]
	return view
},

setEntityTitle: function(entity) {
	$pageTitle.replaceChildren(Draw.iconTitle(entity))
	$.document.title = entity.name
	realTitle = entity.name
	changeFavicon(false)
},
setTitle: function(text) {
	$pageTitle.textContent = text
	$.document.title = text
	realTitle = text
	changeFavicon(false)
},

setPath: function(path) {
	$path.replaceChildren(Draw.titlePath(path))
},
setEntityPath: function(page) {
	if (!page) {
		setPath([])
		return
	}
	if (page.Type == 'category')
		var node = page
	else
		node = page.parent
	var path = []
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

loadStart: function() {
	flag('loading', true)
},
loadEnd: function() {
	flag('loading', false)
},

flags: {},
flag: function(flag, state) {
	if (!flags[flag] != !state) {
		if (state)
			flags[flag] = true
		else
			delete flags[flag]
		var cls = ""
		for (flag in flags)
			cls += " f-"+flag
		$.document.documentElement.className = cls
	}
},

updateUserAvatar: function(user) {
	ChatRoom.updateUserAvatar(user) //todo: don't hardcode this
	if (user.id == Req.uid)
		updateMyUser(user)
},

updateMyUser: function(user) {
	if (user.id != Req.uid)
		return //uh oh
	Req.me = user //This probably shouldn't be handled by View...
	$loggedIn.replaceChildren(Draw.entityTitleLink(user, true))
},

handleView: function(type, id, query, callback) {
	if (cancelRequest) {
		cancelRequest()
		cancelRequest = null
	}
	var view = getView(type)
	
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

	var cancelled = false
	if (!view) {
		whenPageLoaded(function() {
			cleanUp()
			errorRender("Unknown page type: \""+type+"\"")
		})
	} else if (view.start) {
		whenPageLoaded(function() {
			loadStart()
		})
		try { // this catches errors in view.start, NOT the callbacks inside here
			var xhr = view.start(id, query, function(ok) {
				var args = arguments
				whenPageLoaded(function() {
					if (cancelled)
						return
					cleanUp()
					if (!ok) {
						if (ok == false)
							var msg = "error 1"
						else
							var msg = "content not found?"
						errorRender(msg)
					} else {
						currentView = view
						try {
							view.render.apply(null, args)
							after()
						} catch(e) {
							// cleanUp() maybe?
							errorRender("render failed", e)
						}
					}
					loadEnd()
				})
			}, function(e) {
				whenPageLoaded(function() {
					quick(e)
				})
			})
		} catch(e) {
			errorRender("render failed 1", e)
			loadEnd()
		}
	} else {
		whenPageLoaded(function() {
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
	
	cancelRequest = function() {
		loadEnd()
		if (xhr && xhr.abort) {
			xhr.abort()
		}
		cancelled = true
	}

	function after() {
		//$.document.body.className = view.className
		document.querySelectorAll("v-b").forEach(function(e) {
			e.hidden = !e.hasAttribute("data-view-"+view.className)
		})
		View.flag('splitView', view.splitView==true)
		View.flag('viewReady', true)
		View.flag('mobileSidebar', false) //bad (should be function on Sidebar)

		Req.lpLastListeners = ChatRoom.generateListeners(Req.lpLastListeners)
		Req.lpStatuses = ChatRoom.generateStatus()
		Req.lpRefresh()
		
		callback && callback()
		// todo: scroll to fragment element
	}
},

onLoad: function() {
	document.querySelectorAll("a[data-static-path]").forEach(function(elem) {
		Nav.link(elem.getAttribute('data-static-path'), elem)
	})
	document.querySelectorAll("button:not([data-noreplace])").forEach(function(button) {
		var container = document.createElement("div")
		container.className = "buttonContainer"
		button.parentNode.replaceChild(container, button)
		container.className += " "+button.className
		button.className = ""
		if (button.hasAttribute('data-static-link')) {
			button.setAttribute('tabindex', "-1")
			var a = document.createElement('a')
			container.appendChild(a)
			container = a
		}
		container.appendChild(button)
	})
	
	for (var n in views) {
		views[n].name = n
		if (views[n].init)
			views[n].init()
		// maybe we can just call these the first time the view is visited instead of right away,
		// though none of them should really take a significant amount of time, so whatver
	}
	initDone = true
	runOnLoad.forEach(function(f) {
		f()
	})
	runOnLoad = null

	// video player does not fire 'click' events so instead
	// need to detect when the video is played
	// using a custom event
	document.addEventListener('videoclicked', function(e) {
		imageFocusClickHandler(e.target)
	})
	document.onmousedown = function(e) {
		if (!e.button && e.target) // 0 or none (prevent right click etc.)
			imageFocusClickHandler(e.target)
	}
	var embiggenedImage
	function imageFocusClickHandler(element) {
		if (element.hasAttribute('shrink')) {
			// if click on image that's already big:
			if (embiggenedImage && embiggenedImage == element) {
				embiggenedImage.removeAttribute('bigImage')
				embiggenedImage = null
			} else if (element != embiggenedImage) { // if click on new iamge
				if (embiggenedImage)
					embiggenedImage.removeAttribute('bigImage')
				element.setAttribute('bigImage', "")
				embiggenedImage = element
			}
		} else if (!(element instanceof HTMLTextAreaElement)) {
			if (embiggenedImage && element != embiggenedImage) {
				embiggenedImage.removeAttribute('bigImage')
				embiggenedImage = null
			}
		}
	}
	Sidebar.onLoad()
},

addView: function(name, data) {
	data.name = name
	views[name] = data
	initDone && data.init && data.init()
},

attachPaste: function(callback) {
	document.addEventListener('paste', function(event) {
		var data = event.clipboardData
		if (data && data.files) {
			var file = data.files[0]
			if (file && (/^image\//).test(file.type))
				callback(file)
		}
	})
},

attachResize: function(element, tab, horiz, dir, save) {
	var startX,startY,held,startW,startH,size = null
	function getPos(e) {
		if (e.touches)
			return {x:e.touches[0].pageX, y:e.touches[0].pageY}
		else
			return {x:e.clientX, y:e.clientY}
	}
	function down(e) {
		tab.setAttribute('dragging',"")
		var pos = getPos(e)
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
	function move(e) {
		if (!held)
			return
		var pos = getPos(e)
		if (horiz) {
			var vx = (pos.x - startX) * dir
			size = Math.max(0, startW+vx)
			element.style.width = size+"px"
		} else {
			var vy = (pos.y - startY) * dir
			size = Math.max(0, startH+vy)
			element.style.height = size+"px"
		}
	}	
	tab.addEventListener('mousedown', down)
	document.addEventListener('mouseup', up)
	document.addEventListener('mousemove', move)
	
	tab.addEventListener('touchstart', function(e) {
		e.preventDefault()
		down(e)
	}) //todo: prevent scrolling on mobile
	document.addEventListener('touchend', up)
	document.addEventListener('touchmove', move)
	if (save) {
		size = Store.get(save)
		if (size) {
			size = Math.max(0, +size)
			if (horiz)
				element.style.width = size+"px"
			else
				element.style.height = size+"px"
		}
	}
},

commentTitle: function(comment) {
	var user = comment.createUser
	var av = +comment.meta.a
	if (av)
		user = Object.create(user, {
			avatar: {value: av}
		})
	//todo: I saw this fail for a user without an avatar, somehow
	titleNotification(comment.content, Draw.avatarURL(user, "size=120&crop=true"))
},

titleNotification: function(text, icon) {
	if (text == false) {
		$.document.title = realTitle
		changeFavicon(false)
		return
	}
	$.document.title = text
	changeFavicon(icon || false)
},

changeFavicon: function(src) {
	if (!faviconElement) {
		if (src == false)
			return
		document.head.querySelectorAll("link[data-favicon]").forEach(function(e) {
			e.remove()
		})
		faviconElement = document.createElement('link')
		faviconElement.rel = "icon"
		document.head.appendChild(faviconElement)
	} else if (faviconElement.href == src)
		return
	if (src == false)
		src = "resource/icon16.png"
	faviconElement.href = src
}

<!--/* 
}) //*/

// create private variables here
// these will override public vars


<!--/*
}(window)) //*/ // pass external values


//todo: rename resource to avoid collision with request.js

// todo: id can be a string now,
// so, we need to test if it is valid + in range (positive) in many places
// and handle invalid ids consistently
// so now there are 4 error conditions
// unknown page type
// connection error
// resource not found
// invalid id
