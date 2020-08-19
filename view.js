<!--/* trick indenter
var View = Object.create(null)
with (View) (function($) { "use strict"
Object.assign(View, { //*/

// create public variables here
views: {
	"": {
		className: 'homeMode',
		render: function() {
			setPath()
			var text = "Welcome to SmileBASIC Source 2!"
			var index = $.Math.random()*(text.length-1)|0
			text = text.substring(0,index)+text[index+1]+text[index]+text.substr(index+2)
			setTitle(text)
		}
	},
	login: {
		className: 'registerMode',
		render: function() {
			setPath()
			setTitle("Log-in or Create an Account")
		}
	},
	test: {
		className: 'testMode',
		render: function() {
			setPath()
			setTitle("Testing")
		}
	},
	user: {
		start: function(id, query, render) {
			return $.Req.getUserView(id, render)
		},
		className: 'userMode',
		render: function(user, userpage, activity, ca, content) {
			$userPageAvatar.src = ""
			if (!user)
				return //er
			setEntityTitle(user)
			$userPageAvatarLink.href = Req.fileURL(user.avatar)
			$userPageAvatar.src = Req.fileURL(user.avatar, "size=400&crop=true")
			setPath([["users","Users"], [Nav.entityPath(user), user.name]])
			$userPageContents.replaceChildren(Draw.markup(userpage))
		}
	},
	page: {
		start: function(id, query, render) {
			return $.Req.getPageView(id, render)
		},
		className: 'pageMode',
		render: function(page) {
			if (!page)
				return
			setEntityTitle(page)
			setEntityPath(page)
		}
	},
	category: {
		start: function(id, query, render) {
			return $.Req.getCategoryView(id, render)
		},
		className: 'categoryMode',
		render: function(category, cats, pages, pinned) {
			if (!category)
				return
			setEntityTitle(category)
			setEntityPath(category)
		}
	}
},
errorView: {
	className: 'errorMode',
	render: function(id, query, type) {
		setPath()
		setTitle("[404] I DON'T KNOW WHAT A \""+type+"\" IS")
		console.log(x)
	}
},
getView: function(name) {
	return views[name] || errorView
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
	$navPane.replaceChildren(Draw.titlePath(path))
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
		for (flag in flags) {
			cls += " f-"+flag
		}
		$.document.documentElement.className = cls
	}
},

<!--/* 
}) //*/

// create private variables here
// these will override public vars

var x = views

<!--/*
}(window)) //*/ // pass external values


//todo: rename resource to avoid collision with request.js
