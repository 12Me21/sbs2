// HTML RENDERING
var Draw = Object.create(null)
with (Draw) (function($) { "use strict"
Object.assign(Draw, { //*/

avatarURL: (user, params)=>{
	if (!user || !user.avatar)
		return "resource/avatar.png"
	return Req.fileURL(user.avatar, params)
},

largeIcon: (entity)=>{
	let element = document.createElement('img')
	if (entity.Type == 'user') {
		element.src = avatarURL(entity, "size=400&crop=true")
		element.width = element.height = 400
	} else
		element.src = "resource/unknown.png"
	return element
},

// icon + name
iconTitle: (entity, reverse)=>{
	let element = document.createDocumentFragment()
	if (reverse) {
		element.append(title(entity))
		//element.appendChild(document.createTextNode(" "))
		element.append(icon(entity))
	} else {
		element.append(icon(entity))
		//element.appendChild(document.createTextNode(" "))
		element.append(title(entity))
	}
	return element
},

entityLink: (entity)=>{
	let path = Nav.entityPath(entity)
	let element
	if (path)
		element = Nav.link(path)
	else
		element = document.createElement('span')
	return element
},

// page (or category) wiht user
pageBar: (page)=>{
	let bar = entityTitleLink(page)
	if (page.createUser) {
		let usr = entityTitleLink(page.createUser, true)
		usr.className += " rightAlign"
		bar.append(usr)
	}
	return bar
},

entityTitleLink: (entity, reverse)=>{
	let element = entityLink(entity)
	let icon = iconTitle(entity, reverse)
	element.append(icon)
	return element
},

title: (entity)=>{
	let element = document.createElement('span')
	element.textContent = entity ? entity.name : "MISSINGNO."
	element.className = 'textItem pre entity-title'
	return element
},

textItem: (text)=>{
	let element = document.createElement('span')
	element.textContent = text
	element.className = 'textItem pre'
	return element
},

iconURL: (entity)=>{
	if (entity.Type == 'user') {
		return 
	} else if (entity.Type == 'category')
		return "resource/category.png"
	else if (entity.Type == 'content') {
		if (!hasPerm(entity.permissions, 0, 'r'))
			return "resource/hiddenpage.png"
		// todo: hidden icon
		return "resource/page.png"
	}
	return "resource/unknown.png"
},

chatMessagePane: ()=>{
	let outer = document.createElement('scroll-outer')
	outer.className = "grow chatScroller"
	outer.hidden = true
	let inner = document.createElement('scroll-inner')
	outer.append(inner)
	return [outer, inner]
},

userList: function() {
	let outer = document.createElement('div')
	outer.className = "bar rem2-3 userlist"
	let inner = document.createElement('span')
	outer.append(inner)
	let b = button()
	b[1].textContent = "Hide"
	b[0].className += " rightAlign item loggedIn"
	outer.append(b[0])
	return [outer, inner, b[1]]
},

userListAvatar: (status)=>{
	let a = linkAvatar(status.user)
	if (status.status == "idle")
		a.className += " status-idle"
	return a
},

sidebarDebug: (text)=>{
	let x = document.createElement('div')
	x.className = 'debugMessage pre'
	x.textContent = text
	return x
},

linkAvatar: (user)=>{
	let a = entityLink(user)
	a.append(avatar(user))
	a.title = user.username
	return a
},

avatar: (user)=>{
	let element = document.createElement('img')
	element.className += "item avatar"
	element.src = avatarURL(user, "size=100&crop=true")
	element.width = element.height = 100
	return element
},

fileThumbnail: (file, onclick)=>{
	let div = document.createElement('div')
	div.className = "fileThumbnail item"
	/*div.onclick = function() {
	  selectFile(file)
	  }*/
	div.dataset.id = file.id
	let img = document.createElement('img')
	img.src = Req.fileURL(file.id, "size=50")
	img.alt = file.name
	img.title = file.name
	div.append(img)
	if (onclick) {
		div.onclick = (e)=>{
			onclick(file, e)
		}
	}
	return div
},

bgIcon: (url)=>{
	let element = document.createElement('span')
	element.setAttribute('role', 'img')
	element.className = "item icon iconBg"
	element.style.backgroundImage = 'url("'+url+'")'
	return element
},

icon: (entity)=>{
	let element
	let type = entity && entity.Type
	if (type == 'user') {
		element = document.createElement('img')
		element.className += "item icon avatar"
		element.src = avatarURL(entity, "size=100&crop=true")
		element.width = element.height = 100
	} else if (type=='content') {
		let hidden = !hasPerm(entity.permissions, 0, 'r')
		if (hidden) {
			element = bgIcon('resource/hiddenpage.png')
		} else { //TODO: make this better!
			let pageType = entity.type
			if (Entity.CONTENT_TYPES.includes(pageType)) {
				element = bgIcon('resource/page-'+pageType+'.png')
			} else {
				element = bgIcon('resource/unknownpage.png')
			}
		}
	} else if (type=='category') {
		element = bgIcon('resource/category.png')
	} else {
		element = bgIcon('resource/unknown.png')
	}
	return element
},

markup: (page)=>{
	let lang = null
	if (page.values)
		lang = page.values.markupLang
	return Parse.parseLang(page.content, lang, true)
},

titlePath: (path)=>{
	let element = document.createDocumentFragment()
	if (!path)
		return element
	path.forEach((item, i, path)=>{
		if (item) { //todo: use entities here instead
			let link = Nav.link(item[0])
			link.textContent = item[1]
			link.className = "textItem pre entity-title"
			element.append(link)
		}
		
		if (i < path.length-1) {
			let slash = document.createElement('span')
			slash.textContent = "/"
			slash.className = "pathSeparator textItem"
			element.append(slash)
		}
	})
	return element
},
messageBlock: (comment)=>{
	let user = comment.createUser
	let date = comment.createDate
	
	let div = document.createElement('message-block')
	// time
	let timeStamp = document.createElement('time')
	timeStamp.setAttribute("datetime", date+"")
	timeStamp.textContent = timeString(date)
	div.append(timeStamp)
	// avatar
	if (user.bigAvatar) {
		let d = document.createElement('div')
		d.style.backgroundImage = "url("+Req.fileURL(user.bigAvatar, "size=500")+")"
		d.className += " bigAvatar"
		div.append(d)
	} else {
		div.append(avatar(user))
	}
	// username
	let name = document.createElement('span')
	name.className += " username-label"
	div.append(name)
	let link = entityLink(user)
	name.append(link)
	
	let n = document.createElement('span')
	n.className = "pre username"
	link.append(n)
	
	// if nickname is set, render as "nickname (realname):"
	if (user.nickname !== undefined) { // why !== here?
		n.textContent = user.nickname
		link.append(document.createTextNode(": ("))
		let n2 = document.createElement('span')
		n2.className = "pre"
		n2.textContent = user.realname
		link.append(n2)
		link.append(document.createTextNode(")"))
	} else {
		// otherwise render as "name:"
		n.textContent = user.name
		link.append(document.createTextNode(":"))
	}
	
	// contents
	let contentBox = document.createElement('message-contents')
	div.append(contentBox)
	div.dataset.uid = comment.createUserId
	div.dataset.merge = mergeHash(comment)
	return [div, contentBox]
},
mergeHash: (comment)=>{
	return comment.createUserId + "," + comment.createUser.avatar+","+(comment.createUser.bigAvatar||"") + "," + comment.createUser.name + " " + (comment.createUser.nickname || "")
},
// this needs to be improved
searchComment: (comment)=>{
	let outer = document.createElement('div')
	outer.className += " bottomBorder"
	let pg = entityTitleLink(comment.parent)
	pg.className += " bar rem1-5 linkBar"
	outer.append(pg)
	
	let firstId = comment.id
	let lastId = comment.id
	let firstElem
	let lastElem
	
	{
		let b = button()
		b[1].textContent = "Load Older"
		outer.append(b[0])
		b[1].onclick = function() {
			Req.getCommentsBefore(comment.parentId, firstId, 10, (comments)=>{
				if (!comments) return
				comments.forEach((c)=>{
					firstId = c.id
					let d = messageBlock(c)
					d[1].append(messagePart(c))
					outer.insertBefore(d[0], firstElem)
					firstElem = d[0]
				})
			})
		}
	}
	
	let d = messageBlock(comment)
	d[1].append(messagePart(comment))
	outer.append(d[0])
	firstElem = lastElem = d[0]
	
	{
		let b = button()
		b[1].textContent = "Load Newer"
		outer.appendChild(b[0])
		b[1].onclick = ()=>{
			Req.getCommentsAfter(comment.parentId, lastId, 10, (comments)=>{
				if (!comments) return
				comments.forEach((c)=>{
					lastId = c.id
					let d = messageBlock(c)
					d[1].append(messagePart(c))
					outer.insertBefore(d[0], b[0]) // yes
				})
			})
		}
	}
	
	return outer
},
messagePart: (comment)=>{
	let element = document.createElement('message-part')
	element.className = "markup-root"
	element.dataset.id = comment.id
	element.setAttribute('tabindex', "0")
	
	let contents = Parse.parseLang(comment.content, comment.meta.m, false)
	if (comment.createDate.getTime() != comment.editDate.getTime())
		element.className += " edited"
	element.append(contents)
	return element
},
timeString: (date)=>{
	let options
	if (new Date()-date > 1000*60*60*12) {
		options = {year:'numeric',month:'long',day:'numeric',hour:'2-digit', minute:'2-digit'}
	} else {
		options = {hour:'2-digit', minute:'2-digit'}
	}
	return date.toLocaleString([], options)
},

button: ()=>{
	let container = document.createElement("div")
	container.className = "buttonContainer"
	let button = document.createElement("button")
	container.append(button)
	return [container, button]
}, // BAD ↕
linkButton: ()=>{
	let container = document.createElement("div")
	container.className = "buttonContainer"
	let a = document.createElement('a')
	container.append(a)
	let button = document.createElement("button")
	a.append(button)
	return [container, button]
},
pageInfo: (page)=>{
	let e = document.createElement('div')
	e.className = "pageInfoPane rem2-3 bar"
	//with(e){
	e.append(authorBox(page))
	e.append(voteBox(page))
	/*var b = linkButton()
	  b[1].textContent = "Edit Page"
	  Nav.link("editpage/"+page.id, b[1].parentNode)
	  b[0].className += " item rightAlign"
	  e.appendChild(b[0])*/
	return e
},
sidebarTabs: (list, callback)=>{
	let btns = []
	let r = document.createDocumentFragment();
	let x = {
		elem: r,
		select: (i)=>{
			list.forEach((item, i2)=>{
				btns[i2].setAttribute('aria-selected', i==i2)
				item.elem.hidden = i!=i2
			})
		},
	}
	list.forEach((item, i)=>{
		item.elem.setAttribute('role', "tabpanel")
		item.elem.setAttribute('aria-labelledby', "sidebar-tab-"+i)
		item.elem.hidden = true
		
		let btn = document.createElement('button')
		btn.setAttribute('role', "tab")
		btn.setAttribute('aria-selected', "false")
		btn.id = "sidebar-tab-"+i
		btn.setAttribute('aria-controls', "sidebar-panel-"+i)
		r.append(btn)
		btn.append(item.label)
		btns[i] = btn
		btn.onclick = ()=>{
			x.select(i)
		}
	})
	return x
},
setBgImage: (element, url)=>{
	element.style.backgroundImage = ""
	if (url)
		element.style.backgroundImage = "url(\""+url+"\")" //todo: escape chars in url!
},
activityItem: (item)=>{
	let outer = entityLink(item.content)
	outer.className += " linkBar"
	
	let bar = document.createElement('div')
	bar.className += " ellipsis bar rem1-5"
	bar.append(iconTitle(item.content))
	
	let bar2 = document.createElement('div')
	bar2.className += " bar rem1-5"
	outer.append(bar)
	outer.append(bar2)
	
	let userContainer = bar2.createChild('activity-users')
	userContainer.className = "rightAlign"
	
	let time = timeAgo(item.lastDate)
	time.className += " textItem"
	userContainer.append(time)
	userContainer.append(document.createTextNode(" "))
	
	item.users.forEach((u)=>{
		if (u && u.user) {
			let l = entityLink(u.user)
			l.append(icon(u.user))
			userContainer.append(l)
		}
	})
	return outer
},
navButtons(callback) {
	let prev = button()
	prev[0].className += " item"
	let next = button()
	next[0].className += " item"
	let page = textItem()
	prev[1].textContent = "<"
	next[1].textContent = ">"
	page.textContent = 1
	let e = document.createDocumentFragment()
	e.append(prev[0])
	e.append(next[0])
	e.append(page)
	let x = {
		value: 1,
		element: e,
		onchange: ()=>{},
		set: (p)=>{
			x.value = p
			page.textContent = p
		}
	}
	let change = (d)=>{
		if (x.value+d < 1)
			return
		x.value += d
		x.onchange(x.value)
	}
	prev[1].onclick = ()=>{
		change(-1)
	}
	next[1].onclick = ()=>{
		change(1)
	}
	return x
},

authorBox: (page)=>{
	let element = document.createDocumentFragment()
	if (!page)
		return element
	element.append(pageEditedTime("Author:", page.createDate))
	element.append(document.createTextNode(" "))
	element.append(entityTitleLink(page.createUser, true))
	if (page.editUserId != page.createUserId) {
		element.append(document.createTextNode(" "))
		element.append(pageEditedTime("Edited by:", page.editDate))
		element.append(document.createTextNode(" "))
		element.append(entityTitleLink(page.editUser, true))
	} else if (page.createDate != page.editDate) { //edited by same user
		element.append(document.createTextNode(" "))
		element.append(pageEditedTime("Edited", page.editDate))
	}
	return element
},

pageEditedTime: (label, time)=>{
	let b = document.createElement('span')
	b.className = "item"
	
	let a = document.createElement('div')
	a.className = "half half-label"
	a.textContent = label
	b.append(a)
	
	a = timeAgo(time)
	a.className += " half"
	b.append(a)
	return b
},

timeAgo: (time)=>{
	let t = document.createElement('time')
	t.className += " time-ago"
	t.setAttribute('datetime', time.toISOString())
	t.textContent = timeAgoString(time)
	t.title = ""+time
	return t
},

timeAgoString: (date)=>{
	let seconds = Math.floor((Date.now() - date.getTime()) / 1000)
	let interval = Math.floor(seconds / 31536000)
	if (interval >= 1) return interval + " years ago"
	interval = Math.round(seconds / 2592000)
	if (interval >= 1) return interval + " months ago"
	interval = Math.round(seconds / 86400)
	if (interval >= 1) return interval + " days ago"
	interval = Math.round(seconds / 3600)
	if (interval >= 1) return interval + " hours ago"
	interval = Math.round(seconds / 60)
	if (interval >= 1) return interval + " minutes ago"
	return "Just now"
	/*if (seconds <= -0.5)
	  return " IN THE FUTURE?"
	  return Math.round(seconds) + " seconds ago"*/
},

categoryInput: ()=>{
	let elem = document.createElement('select')
	let categoryList = (node, ret, depth)=>{
		depth = depth || 0
		ret.push([">".repeat(depth)+" "+node.name, node.id])
		node.children && node.children.forEach((node)=>{
			categoryList(node, ret, depth+1)
		})
	}
	let x = {
		element: elem,
		set: (id)=>{ elem.value = id },
		get: ()=>{ return +elem.value },
		update: ()=>{
			elem.replaceChildren()
			let list = []
			categoryList(Entity.categoryMap[0], list)
			list.forEach((item)=>{
				let x = document.createElement('option')
				x.textContent = item[0]
				x.value = item[1]
				elem.append(x)
			})
		}
	}
	return x
},

permissionRow: (user, perms)=>{
	let id = user ? user.id : -1
	let row = document.createElement('tr')
	let name
	if (!id) {
		name = textItem("Default")
	} else
		name = entityTitleLink(user, true)
	name.className += " bar rem1-5"
	if (id) {
		let b = button()
		b[1].textContent = "remove"
		b[1].onclick = ()=>{ row.remove() }
		row.createChild('td').append(b[0])
	} else
		row.create('td')
	row.create('th').append(name)
	;['r','c','u','d'].forEach((p)=>{
		let inp = row.create('td').createChild('input')
		inp.type = 'checkbox'
		inp.checked = perms.indexOf(p)>=0
		inp.value = p
	})
	row.dataset.id = id
	return row
},

permissionInput: ()=>{
	let elem = document.createElement('div')
	
	let input = Draw.userSelector()
	
	
	let table = elem.createChild('table')
	table.className += " permission-table"
	let header = table.createChild('thead').createChild('tr')
	header.createChild('th')
	header.createChild('th')
	header.createChild('th').textContent = "View"
	header.createChild('th').textContent = "Reply"
	header.createChild('th').textContent = "Edit"
	header.createChild('th').textContent = "Delete"
	let body = table.createChild('tbody')
	body.className += " permission-users"
	
	elem.append(input.elem)
	
	let x = {
		element: elem,
		set: (newPerms, users)=>{
			body.replaceChildren()
			let d = false
			newPerms.forEach((p, id)=>{
				id = +id
				body.append(permissionRow(users[id] || {Type:'user', id:id}, p))
				if (id==0)
					d=true
				//ok we really need to fix the problem with null users
				// one solution is to have a user map lookup function which returns a placeholder object if the user is not found, to store the 2 important (and known) properties, Type and id, just to avoid losing that information.
			})
			if (!d) {
				body.append(permissionRow(users[0] || {Type:'user', id:0}, ""))
			}
		},
		get: function() {
			let ret = {}
			body.childNodes.forEach((row)=>{
				let perm = ""
				row.querySelectorAll('input').forEach((check)=>{
					if (check.checked)
						perm += check.value
				})
				ret[+row.dataset.id] = perm
			})
			return ret
		}
	}
	
	input.onchange = (user)=>{
		body.append(permissionRow(user, "cr"))
	}
	
	return x
},

userSelector: ()=>{
	let elem = document.createElement('user-select')
	elem.className = "bar rem1-5"
	let input = document.createElement('input')
	input.placeholder = "Search Username"
	input.className = "item"
	let dropdown = document.createElement('select')
	dropdown.className = "item"
	let placeholder = document.createElement('option')
	placeholder.textContent = "select user..."
	placeholder.disabled = true
	placeholder.hidden = true
	
	let placeholder2 = document.createElement('option')
	placeholder2.textContent = "loading..."
	placeholder2.disabled = true
	placeholder2.hidden = true
	
	let submit = document.createElement('button')
	submit.textContent = "select"
	submit.disabled = true
	submit.className = "item"
	
	let results = null
	
	let x = {
		elem: elem,
		searchText: null,
	}
	input.oninput = ()=>{
		reset()
	}
	View.bind_enter(input, ()=>{
		dropdown.focus()
	})
	View.bind_enter(dropdown, ()=>{
		if (dropdown.value)
			submit.click()
	})
	dropdown.onfocus = ()=>{
		if (input.value == x.searchText)
			return
		x.searchText = input.value
		dropdown.replaceChildren(placeholder2)
		placeholder2.selected = true
		results = true
		Req.searchUsers(x.searchText, (users)=>{
			dropdown.replaceChildren()
			if (!users) {
				x.searchText = null //error
				return
			}
			results = users
			submit.disabled = false
			let found = false
			users.forEach((user)=>{
				let option = document.createElement('option')
				option.value = user.id
				option.textContent = user.username
				dropdown.append(option)
				found = true
			})
			if (!found) {
				let option = document.createElement('option')
				option.value = "0"
				option.textContent = "(no results)"
				option.disabled = true
				dropdown.append(option)
				dropdown.value = "0"
				input.focus()
			}
		})
	}
	let reset = ()=>{
		if (results) {
			submit.disabled = true
			dropdown.replaceChildren(placeholder)
			placeholder.selected = true
			results = null
			x.searchText = null
		}
	}
	submit.onclick = ()=>{
		let uid = dropdown.value
		if (uid) {
			x.onchange(results[uid])
			input.focus()
			input.value=""
			reset()
		}
	}
	elem.append(input)
	elem.append(dropdown)
	elem.append(submit)
	results = true
	reset()
	return x
},

messageControls: ()=>{
	var elem = document.createElement('message-controls')
	var x = {
		elem: elem
	}
	var btn = button()
	elem.appendChild(btn[0])
	btn[1].onclick = function() {
		x.onclick()
	}
	btn[1].tabIndex = "-1"
	btn[1].textContent = "edit"
	btn[0].className += " rightAlign loggedIn"
	return x
},

settings: function(settings, onchange) {
	var get = {}
	var set = {}
	var change = function(name) {
		var value = get[name]()
		Store.set("setting-"+name, JSON.stringify(value))
		onchange(name, value)
	}
	var x = {
		elem: document.createDocumentFragment(),
		get: function() {
			var ret = {}
			get.forEach(function(func, key) {
				ret[key] = func()
			})
			return ret
		},
		set: function(data) {
			set.forEach(function(func, key) {
				func(data[key])
			})
		},
		saveAll: function() {
			get.forEach(function(func, key) {
				change(key);
			})
		}
	}
	settings.forEach(function(data, name) {
		var type = data.type
		var elem
		var label = document.createElement('label')
		label.textContent = data.name+": "
		x.elem.appendChild(label)
		if (type=='select') {
			elem = document.createElement('select')
			data.options.forEach(function(option) {
				var opt = elem.createChild('option')
				opt.value = option
				opt.textContent = option
			})
		} else if (type=='textarea') {
			elem = document.createElement('textarea')
		} else {
			console.error("settings field '"+name+"' has invalid selection type '"+type+"'", data)
			return // invalid setting field type
		}
		get[name] = function() {
			return elem.value
		}
		set[name] = function(value) {
			elem.value = value
		}
		
		var value = Store.get("setting-"+name)
		if (value != null) {
			value = JSON.safeParse(value)
			set[name](value)
			onchange(name, value)
		}
		if (data.autosave != false) {
			elem.onchange = function() {
				change(name);
			}
		}
		
		if (elem)
			x.elem.appendChild(elem)
		x.elem.createChild('br')
	})
	return x
},

galleryLabel: function(entity) {
	var element = entityLink(entity)
	element.className += " bar rem1-5"
	
	var icon = iconTitle(entity)
	element.appendChild(icon)
	
	/*var author = entityTitleLink(entity.createUser, true)
	  var b = document.createElement('div')
	  b.appendChild(author)
	  b.className += " rightAlign"
	  element.appendChild(b)*/
	
	return element
},

sidebarComment: function(comment) {
	var d = document.createElement('div')
	d.className += " bar rem1-5 sidebarComment ellipsis"
	if (comment.editUserId != comment.createUserId) {
		d.appendChild(entityTitleLink(comment.editUser))
		d.appendChild(document.createTextNode(" edited "))
	}
	d.appendChild(entityTitleLink(comment.createUser))
	d.appendChild(document.createTextNode(": "))
	d.appendChild(document.createTextNode(comment.content.replace(/\n/g, "  ")))
	d.setAttribute('data-id', comment.id)
	d.setAttribute('title', comment.createUser.username+" in "+comment.parentId+":\n"+comment.content)
	return d
},

//todo:
sidebarPageLabel: function(content) {
	
},

// FIXME: There is no live updating of the vote count. It only adds
// the user's count to the user vote when the user votes,
// which is clearly an awful way of doing things. I don't
// understand how listener is implemented 	in this, so I don't
// feel like touching it.
voteButton: function(disptext, state, page) {
	var b = button()
	b[0].className += ' item'
	b[1].className += ' voteButton'
	if (page.about.myVote == state)
		b[1].setAttribute('data-selected', "")
	b[1].setAttribute('data-vote', state)
	
	var label = document.createElement('div')
	label.textContent = disptext
	b[1].appendChild(label)
	
	var count = document.createElement('div')
	count.className = ' voteCount'
	count.setAttribute('data-vote', state)
	count.textContent = page.about.votes[state].count
	b[1].appendChild(count)
	
	return b[0]
},

voteBox: function (page) {
	var element = document.createElement('div')
	element.className += ' item rightAlign'
	
	if (!page)
		return element
	
	var buttonStates = [
		['-', 'b'], ['~', 'o'], ['+', 'g']
	]
	var buttons = new Array()
	buttonStates.forEach(function(x) {
		buttons.push(voteButton(x[0], x[1], page))
	})
	
	buttons.forEach(function(x) {
		x.onclick = function(e) {
			if (!Req.auth)
				return
			
			var button = e.currentTarget.querySelector('button')
			var state = button.getAttribute('data-vote')
			var vote = state
			var oldButton = element.querySelector('button[data-selected]')
			// disable button so that it won't increment multiple times while
			// query is happening
			button.disabled = true
			// check if vote was already toggled
			if (oldButton &&
				 oldButton.hasAttribute('data-selected') &&
				 button.hasAttribute('data-selected'))
				vote=undefined
			Req.setVote(page.id, vote, function(e, resp) {
				// in case the vote fails when user is blocked from voting
				if (!e) {
					// if the vote was already toggled, then remove highlight
					var replaceVote = function(q, x) {
						var c = element.querySelector(q)
						c.textContent = String(Number(c.textContent) + x)
					}
					if (!vote) {
						button.removeAttribute('data-selected')
						replaceVote('.voteCount[data-vote="' + state + '"]', -1)
					}
					// otherwise, we want to remove the highlight from the
					// button that was already pressed before and highlight
					// the new button
					else {
						if (oldButton) {
							oldButton.removeAttribute('data-selected')
							replaceVote('.voteCount[data-vote="' + oldButton.getAttribute('data-vote') + '"]', -1)
						}
						button.setAttribute('data-selected', "")
						replaceVote('.voteCount[data-vote="' + state + '"]', 1)
					}
				}
				button.disabled = false
			})
		}
		element.appendChild(x)
	})
	return element
},

updateTimestamps: function(element) {
	element.querySelectorAll("time.time-ago").forEach(function(e) {
		e.textContent = timeAgoString(new Date(e.getAttribute('datetime')))
	})
},

navCategory: function(cat) {
	var elem = document.createElement('div')
	var label = entityTitleLink(cat)
	label.className += " bar rem1-5 linkBar"
	elem.appendChild(label)
	var elem2 = document.createElement('div')
	elem.appendChild(elem2)
	elem2.className += " category-childs"
	if (cat.children)
		cat.children.forEach(function(c) {
			elem2.appendChild(navCategory(c))
		})
	return elem
}

}) //*/

function hasPerm(perms, id, perm) {
	return perms && perms[id] && perms[id].indexOf(perm) != -1
}

}(window)) //*/
