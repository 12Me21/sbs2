// HTML RENDERING

<!--/* trick indenter
var Draw = Object.create(null)
with (Draw) (function($) { "use strict"
Object.assign(Draw, { //*/

avatarURL: function(user, params) {
	if (!user || !user.avatar)
		return "resource/avatar.png"
	return Req.fileURL(user.avatar, params)
},

largeIcon: function(entity) {
	var element = document.createElement('img')
	if (entity.type == 'user')
		element.src = avatarURL(entity, "size=400&crop=true")
	else
		element.src = "resource/unknown.png"
	return entity
},

// icon + name
iconTitle: function(entity, reverse) {
	var element = document.createDocumentFragment()
	if (reverse) {
		element.appendChild(title(entity))
		element.appendChild(icon(entity))
	} else {
		element.appendChild(icon(entity))
		element.appendChild(title(entity))
	}
	return element
},

entityLink: function(entity) {
	var path = Nav.entityPath(entity);
	if (path)
		var element = Nav.link(path)
	else
		element = document.createElement('span')
	return element
},

// page (or category) wiht user
pageBar: function(page) {
	var bar = entityTitleLink(page)
	if (page.createUser) {
		var usr = entityTitleLink(page.createUser, true)
		usr.className += " rightAlign"
		bar.appendChild(usr)
	}
	return bar
},

entityTitleLink: function(entity, reverse) {
	var element = entityLink(entity)
	var icon = iconTitle(entity, reverse)
	element.appendChild(icon)
	return element
},

title: function(entity) {
	return textItem(entity.name)
},

textItem: function(text) {
	var element = document.createElement('span')
	element.textContent = text
	element.className = 'textItem pre'
	return element
},

iconURL: function(entity) {
	if (entity.type == 'user') {
		return avatarURL(entity, "size=120&crop=true")
	} else if (entity.type == 'category')
		return "resource/category.png"
	else if (entity.type == 'content') {
		if (!hasPerm(entity.permissions, 0, 'r'))
			return "resource/hiddenpage.png"
		// todo: hidden icon
		return "resource/page.png"
	}
	return "resource/unknown.png"
},

icon: function(entity, element) {
	element = element || document.createElement('img')
	element.className = "item icon" // todo: force width to avoid jump when loading
	if (entity.type == 'user')
		element.className += " avatar"
	element.src = iconURL(entity)
	return element
},

markup: function(page) {
	if (page.values)
		var lang = page.values.markupLang
	return Parse.parseLang(page.content, lang, true)
},

titlePath: function(path) {
	var element = document.createDocumentFragment()
	if (!path)
		return element
	path.forEach(function(item, i, path) {
		if (item) {
			var link = Nav.link(item[0])
			link.textContent = item[1]
			link.className = "textItem pre"
			element.appendChild(link)
		}
		
		if (i < path.length-1) {
			var slash = document.createElement('span')
			slash.textContent = "/"
			slash.className = "pathSeparator textItem"
			element.appendChild(slash)
		}
	})
	return element
},
messageBlock: function(user, date) {
	user = user || {}
	var div = document.createElement('div')
	div.className = 'message'
	
	var timeStamp = document.createElement('time')
	timeStamp.className = 'messageTime'
	timeStamp.setAttribute("datetime", date+"")
	timeStamp.textContent = timeString(date)
	div.appendChild(timeStamp)

	div.appendChild(icon(user))

	var name = document.createElement('span')
	name.className = 'username'
	name.textContent = user.name+":"
	div.appendChild(name)
	
	var contentBox = document.createElement('div')
	contentBox.className = 'messageContents'
	div.appendChild(contentBox)
	return [div, contentBox]
},
messagePart: function(comment){
	var element = document.createElement('p')
	element.className = 'markup-root messagePart'
	element.setAttribute('data-id', comment.id)
	element.setAttribute('tabindex', "0")
	var contents = Parse.parseLang(comment.content, comment.meta.m, false)
	element.appendChild(contents)
	return element
},
timeString: function(date) {
	if (new Date()-date > 1000*60*60*12) {
		var options = {year:'numeric',month:'long',day:'numeric',hour:'2-digit', minute:'2-digit'}
	} else {
		options = {hour:'2-digit', minute:'2-digit'}
	}
	return date.toLocaleString([], options)
},

button: function() {
	var container = document.createElement("div")
	container.className = "buttonContainer"
	var button = document.createElement("button")
	container.appendChild(button)
	return [container, button]
},

navButtons: function(callback) {
	var prev = button()
	prev[0].className += " item"
	var next = button()
	next[0].className += " item"
	var page = textItem()
	prev[1].textContent = "<"
	next[1].textContent = ">"
	page.textContent = 1
	var e = document.createDocumentFragment()
	e.appendChild(prev[0])
	e.appendChild(next[0])
	e.appendChild(page)
	return e
}

<!--/* 
}) //*/

function hasPerm(perms, id, perm) {
	return perms && perms[id] && perms[id].indexOf(perm) != -1
}
	
<!--/*
}(window)) //*/ // pass external values

