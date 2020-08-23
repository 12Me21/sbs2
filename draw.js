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
iconTitle: function(entity) {
	var element = document.createDocumentFragment()
	element.appendChild(icon(entity))
	element.appendChild(title(entity))
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
		var usr = entityTitleLink(page.createUser)
		usr.className += " rightAlign"
		bar.appendChild(usr)
	}
	return bar
},

entityTitleLink: function(entity) {
	var element = entityLink(entity)
	element.appendChild(iconTitle(entity))
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

<!--/* 
}) //*/

function hasPerm(perms, id, perm) {
	return perms && perms[id] && perms[id].indexOf(perm) != -1
}
	
<!--/*
}(window)) //*/ // pass external values

