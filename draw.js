// HTML RENDERING

<!--/* trick indenter
var Draw = Object.create(null)
with (Draw) (function($) { "use strict"
Object.assign(Draw, { //*/

avatarURL: function(user, params) {
	if (!user || !user.avatar)
		return "resource/avatar.png"
	return Req.fileURL(user.avatar, params)
}

largeIcon: function(entity) {
	var element = document.createElement('img')
	if (entity.type == 'user')
		element.src = avatarURL(entity) // todo: big
	else
		element.src = "resource/unknown.png"
	return entity
},

icon: function(entity) {
	var element = document.createElement('img')
	if (entity.type == 'user')
		element.src = avatarUrl(entity)
	else if (entity.type == 'category')
		element.src = "resource/category.png"
	else if (entity.type == 'page') {
		// todo: hidden icon
		element.src = "resource/page.png"
	} else
		element.src = "resource/unknown.png"
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

<!--/*
}(window)) //*/ // pass external values

