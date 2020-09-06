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

// create public variables here
views: {
	"": {
		className: 'homeMode',
		render: function() {
			var text = "Welcome to SmileBASIC Source 2!"
			//var index = $.Math.random()*(text.length-1)|0
			//text = text.substring(0,index)+text[index+1]+text[index]+text.substr(index+2)
			setTitle(text)
		}
	},
	test: {
		className: 'testMode',
		render: function() {
			setTitle("Testing")
		}
	},
	user: {
		start: function(id, query, render) {
			if (typeof id == 'string' && id[0] == "@")
				id = id.substr(1)
			// todo: maybe username without @ should be invalid?
			// can potentially collide with id numbers
			return $.Req.getUserView(id, render)
		},
		className: 'userMode',
		render: function(user, userpage, activity, ca, content) {
			if (user.id == Req.uid)
				flag('myUserPage', true)
			setEntityTitle(user)
			/*$userPageAvatarLink.href = Draw.avatarURL(user)*/
			$userPageAvatar.src = Draw.avatarURL(user, "size=400&crop=true")
			//setPath([["users","Users"], [Nav.entityPath(user), user.name]])
			if (userpage)
				$userPageContents.replaceChildren(Draw.markup(userpage))
			else
				$userPageContents.replaceChildren()
		},
		cleanUp: function() { //todo: this probably needs more info to tell what next page is (so, whether to delete certain things)
			$userPageAvatar.src = ""
			$userPageContents.replaceChildren()
		}
	},
	// alright, so, the way this works
	// first, .start is called. this will usually make an API request.
	// if this fails or something bad happens, it should be handled I think
	// .render will be called IF everything succeeds
	// the first parameter will always exist.
	users: {
		start: function(id, query, render) {
			return $.Req.getUsersView(render)
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
			nav.appendChild(Draw.navButtons())
		}
	},
	page: {
		start: function(id, query, render) {
			return $.Req.getPageView(id, render)
		},
		className: 'pageMode',
		render: function(page) {
			Nav.link("chat/"+page.id, $pageChatLink)
			setEntityTitle(page)
			setEntityPath(page)
			$pageContents.replaceChildren(Parse.parseLang(page.content, page.values.markupLang))
			Nav.link("editpage/"+page.id, $editButton)
			if (/u/.test(page.myPerms))
				flag('canEdit', true)
		},
		cleanUp: function() {
			$pageContents.replaceChildren()
			flag('canEdit', false)
		}
	},
	category: {
		start: function(id, query, render) {
			return $.Req.getCategoryView(id, render)
		},
		className: 'categoryMode',
		render: function(category, cats, pages, pinned) {
			setEntityTitle(category)
			setEntityPath(category)
			$categoryDescription.replaceChildren(Parse.parseLang(category.description, category.values.markupLang))
			$categoryCategories.replaceChildren()
			Nav.link("editcategory/"+category.id, $editButton)
			category.children.forEach(function(child) {
				var bar = Draw.entityTitleLink(child)
				bar.className += " linkBar bar rem2-3"
				$categoryCategories.appendChild(bar)
			});
			pinned.forEach(function(page) {
				var bar = Draw.pageBar(page)
				bar.className += " linkBar bar rem2-3"
				$categoryCategories.appendChild(bar)
			})
			pages.forEach(function(page) {
				var bar = Draw.pageBar(page)
				bar.className += " linkBar bar rem2-3"
				$categoryPages.appendChild(bar)
			})
			$.Nav.link("editpage?cid="+category.id,$createPage)
			if (/u/.test(category.myPerms))
				flag('canEdit', true)
		},
		cleanUp: function() {
			$categoryCategories.replaceChildren()
			$categoryPages.replaceChildren()
			$categoryDescription.replaceChildren()
			flag('canEdit', false)
		},
		init: function() {
			var nav = $categoryNav
			nav.appendChild(Draw.navButtons())
		}
	},
	pages: {
		redirect: 'page'
	},
	template: {
		start: function(id, query, render) {
			// this should make a request for data from the api
			// and call `render` when it's finished
			// DO NOT MODIFY ANY HTML IN THIS FUNCTION
			// If you don't need to load anything asynchronously,
			// you can leave out this function and `render` will be
			// called immediately instead (with arguments (id, query, type))
			render(1,2,3,4)
		},
		className: 'templateMode', // the className of <body> is set to this
		render: function(a,b,c,d) {
			// this function is called after the data is recieved, and
			// should render the page
		},
		cleanUp: function() {
			// this is called before switching to another page,
			// to remove any unneeded content that was created by `render`
		},
		init: function() {
			// this is called when the page initially loads
			// (in the future, it may be deferred until the view is visited
			// for the first time)
		}
	},
},
errorView: {
	className: 'errorMode',
	render: function(message) {
		setTitle(message)
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
},
setTitle: function(text) {
	$pageTitle.textContent = text
	$.document.title = text
},

setPath: function(path) {
	$path.replaceChildren(Draw.titlePath(path))
},
setEntityPath: function(page) {
	if (page.type == 'category')
		var node = page
	else
		node = page.parent
	var path = []
	while (node) {
		path.unshift([Nav.entityPath(node), node.name])
		node = node.parent
	}
	if (page.type == 'category')
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

handleView: function(type, id, query, callback) {
	if (cancelRequest) {
		cancelRequest()
		cancelRequest = null
	}
	var view = getView(type)
	
	function cleanUp() {
		if (currentView && currentView.cleanUp) {
			try {
				currentView.cleanUp()
			} catch(e) {
				console.error("error in cleanup function", e)
			} finally {
				currentView = null
			}
		}
	}

	var cancelled = false
	if (!view) {
		cleanUp()
		errorRender("Unknown page type: \""+type+"\"")
	} else if (view.start) {
		loadStart()
		var xhr = view.start(id, query, function(ok) {
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
					view.render.apply(null, arguments)
					after()
				} catch(e) {
					// cleanUp() maybe?
					errorRender("render failed")
					console.error(e)
				}
			}
			loadEnd()
		}, quick)
	} else {
		loadStart()
		quick(view.render)
	}

	function quick(ren) {
		cleanUp()
		currentView = view
		try {
			ren(id, query)
			after()
		} catch(e) {
			errorRender("render failed")
		}
		loadEnd()
	}

	function errorRender(message) {
		cleanUp()
		currentView = view = errorView
		view.render(message)
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
		$.document.body.className = view.className
		callback && callback()
		// todo: scroll to fragment element
	}
},

onLoad: function() {
	document.querySelectorAll("a[data-static-path]").forEach(function(elem) {
		Nav.link(elem.getAttribute('data-static-path'), elem)
	})
	document.querySelectorAll("button").forEach(function(button) {
		var container = document.createElement("div")
		container.className = "buttonContainer"
		button.parentNode.replaceChild(container, button)
		container.className += " "+button.className
		button.className = ""
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

	$openSidebar.onclick = $closeSidebar.onclick = toggleSidebar
	attachResize($sidebar, $sidebarPinnedResize, true, -1, "sidebarWidth")
	attachResize($sidebarPinned, $sidebarPinnedResize, false, 1, "sidebarPinnedHeight")
	flag('sidebar', true)
},

addView: function(name, data) {
	data.name = name
	views[name] = data
	if (initDone && data.init)
		data.init()
},

toggleSidebar: function() {
	var fullscreen = isFullscreenSidebar()
	if (fullscreen) {
		flag('mobileSidebar', !flags.mobileSidebar)
	} else {
		flag('sidebar', !flags.sidebar)
		Store.set('sbs-sidebar', !!flags.sidebar)
	}
},

isFullscreenSidebar: function() {
	return !$.matchMedia || $.matchMedia("(max-width: 700px)").matches
},

	<!--/* 
			 }) //*/

// create private variables here
// these will override public vars

var x = views

function attachResize(element, tab, horiz,dir,save) {
	var startX,startY,held,startW,startH,size = null
	function getPos(e) {
		if (e.touches)
			return {x:e.touches[0].pageX,y:e.touches[0].pageY}
		else
			return {x:e.clientX,y:e.clientY}
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
	
	tab.addEventListener('touchstart', down)
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
}

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
