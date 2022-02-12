// HTML RENDERING
const Draw = Object.create(null)
with (Draw) (function() { "use strict"
Object.assign(Draw, { //*/

	avatarURL(user, params) {
		if (!user || !user.avatar)
			return "resource/avatar.png"
		return Req.fileURL(user.avatar, params)
	},
	
	largeIcon(entity) {
		let element = E`img`
		if (entity.Type == 'user') {
			element.src = avatarURL(entity, "size=400&crop=true")
			element.width = element.height = 400
		} else
			element.src = "resource/unknown.png"
		return element
	},
	
	// icon + name
	iconTitle(entity, reverse) {
		let elem = F()
		if (reverse) {
			elem.append(title(entity), icon(entity))
		} else {
			elem.append(icon(entity), title(entity))
		}
		return elem
	},
	
	entityLink(entity) {
		let path = Nav.entityPath(entity)
		let element = path ? Nav.link(path) : E`span`
		return element
	},
	
	// page (or category) wiht user
	pageBar(page) {
		let bar = entityTitleLink(page)
		if (page.createUser) {
			let usr = entityTitleLink(page.createUser, true)
			usr.className += 'rightAlign'
			bar.append(usr)
		}
		return bar
	},
	
	entityTitleLink(entity, reverse) {
		let element = entityLink(entity)
		let icon = iconTitle(entity, reverse)
		element.append(icon)
		return element
	},
	
	title(entity) {
		let element = E`span`
		element.textContent = entity ? entity.name : "MISSINGNO."
		element.className = 'textItem pre entity-title'
		return element
	},
	
	textItem(text) {
		let element = E`span`
		element.textContent = text
		element.className = 'textItem pre'
		return element
	},
	
	iconURL(entity) {
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
	
	chatMessagePane() {
		let outer = E`scroll-outer`
		outer.className = "grow chatScroller"
		outer.hidden = true
		let inner = E`scroll-inner`
		outer.append(inner)
		return [outer, inner]
	},
	
	userList() {
		let outer = E`div`
		outer.className = "bar rem2-3 userlist"
		let inner = E`span`
		outer.append(inner)
		let b = button()
		b[1].textContent = "Hide"
		b[0].className += " rightAlign item loggedIn"
		outer.append(b[0])
		return [outer, inner, b[1]]
	},
	
	userListAvatar(status) {
		let a = linkAvatar(status.user)
		if (status.status == "idle")
			a.className += ' status-idle'
		return a
	},
	
	sidebarDebug(text) {
		let x = E`div`
		x.className = 'debugMessage pre'
		x.textContent = text
		return x
	},
	
	linkAvatar(user) {
		let a = entityLink(user)
		a.append(avatar(user))
		a.title = user.username
		return a
	},
	
	avatar(user) {
		let element = E`img`
		element.className += "item avatar"
		element.src = avatarURL(user, "size=100&crop=true")
		element.width = element.height = 100
		return element
	},
	
	fileThumbnail(file, onclick) {
		let div = E`div`
		div.className = 'fileThumbnail item'
		div.dataset.id = file.id
		let img = E`img`
		img.src = Req.fileURL(file.id, "size=50")
		img.alt = file.name
		img.title = file.name
		div.append(img)
		if (onclick)
			div.onclick = (e)=>{ onclick(file, e) }
		return div
	},
	
	bgIcon(url) {
		let element = E`span`
		element.setAttribute('role', 'img')
		element.className = "item icon iconBg"
		element.style.backgroundImage = 'url("'+url+'")'
		return element
	},
	
	icon(entity) {
		let element
		let type = entity && entity.Type
		if (type == 'user') {
			element = E`img`
			element.className += ' item icon avatar'
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
	
	markup(page) {
		let lang = page.values ? page.values.markupLang : null
		return Parse.parseLang(page.content, lang, true)
	},
	
	titlePath(path) {
		let element = F()
		if (!path)
			return element
		path.forEach((item, i, path)=>{
			if (item) { //todo: use entities here instead
				let link = Nav.link(item[0])
				link.textContent = item[1]
				link.className = 'textItem pre entity-title'
				element.append(link)
			}
			if (i < path.length-1) {
				let slash = E`span`
				slash.textContent = "/"
				slash.className = "pathSeparator textItem"
				element.append(slash)
			}
		})
		return element
	},
	messageBlock(comment) {
		let user = comment.createUser
		let date = comment.createDate
		
		let div = E`message-block`
		// time
		let timeStamp = E`time`
		timeStamp.setAttribute("datetime", date+"")
		timeStamp.textContent = timeString(date)
		div.append(timeStamp)
		// avatar
		if (user.bigAvatar) {
			let d = E`div`
			d.style.backgroundImage = "url("+Req.fileURL(user.bigAvatar, "size=500")+")"
			d.className += " bigAvatar"
			div.append(d)
		} else {
			div.append(avatar(user))
		}
		// username
		let name = E`span`
		name.className += " username-label"
		div.append(name)
		let link = entityLink(user)
		name.append(link)
		
		let n = E`span`
		n.className = "pre username"
		link.append(n)
		
		// if nickname is set, render as "nickname (realname):"
		if (user.nickname !== undefined) { // why !== here?
			n.textContent = user.nickname
			link.append(": (")
			let n2 = E`span`
			n2.className = "pre"
			n2.textContent = user.realname
			link.append(n2)
			link.append(")")
		} else {
			// otherwise render as "name:"
			n.textContent = user.name
			link.append(":")
		}
		
		// contents
		let contentBox = E`message-contents`
		div.append(contentBox)
		div.dataset.uid = comment.createUserId
		div.dataset.merge = mergeHash(comment)
		return [div, contentBox]
	},
	mergeHash(comment) {
		return comment.createUserId + "," + comment.createUser.avatar+","+(comment.createUser.bigAvatar||"") + "," + comment.createUser.name + " " + (comment.createUser.nickname || "")
	},
	// this needs to be improved
	searchComment(comment) {
		let outer = E`div`
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
			b[1].onclick = ()=>{
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
			outer.append(b[0])
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
	
	messagePart(comment) {
		let element = E`message-part`
		element.className = "markup-root"
		element.dataset.id = comment.id
		element.setAttribute('tabindex', "0")
		
		let contents = Parse.parseLang(comment.content, comment.meta.m, false)
		if (comment.createDate.getTime() != comment.editDate.getTime())
			element.className += " edited"
		element.append(contents)
		return element
	},
	timeString(date) {
		let options
		if (new Date()-date > 1000*60*60*12) {
			options = {year:'numeric',month:'long',day:'numeric',hour:'2-digit', minute:'2-digit'}
		} else {
			options = {hour:'2-digit', minute:'2-digit'}
		}
		return date.toLocaleString([], options)
	},
	
	button() {
		let container = E`div`
		container.className = "buttonContainer"
		let button = E`button`
		container.append(button)
		return [container, button]
	}, // BAD ↕
	linkButton() {
		let container = E`div`
		container.className = "buttonContainer"
		let a = E`a`
		container.append(a)
		let button = E`button`
		a.append(button)
		return [container, button]
	},
	pageInfo(page) {
		let e = E`div`
		e.className = "pageInfoPane rem2-3 bar"
		//with(e){
		e.append(authorBox(page))
		e.append(voteBox(page))
		/*var b = linkButton()
		  b[1].textContent = "Edit Page"
		  Nav.link("editpage/"+page.id, b[1].parentNode)
		  b[0].className += " item rightAlign"
		  e.append(b[0])*/
		return e
	},
	sidebarTabs(list, callback) {
		let btns = []
		let r = F();
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
			
			let btn = E`button`
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
	setBgImage(element, url) {
		element.style.backgroundImage = ""
		if (url)
			element.style.backgroundImage = "url(\""+url+"\")" //todo: escape chars in url!
	},
	activityItem(item) {
		let outer = entityLink(item.content)
		outer.className += " linkBar"
		
		let bar = E`div`
		bar.className += " ellipsis bar rem1-5"
		bar.append(iconTitle(item.content))
		
		let bar2 = E`div`
		bar2.className += " bar rem1-5"
		outer.append(bar)
		outer.append(bar2)
		
		let userContainer = bar2.child`activity-users`
		userContainer.className = "rightAlign"
		
		let time = timeAgo(item.lastDate)
		time.className += " textItem"
		userContainer.append(time)
		userContainer.append(" ")
		
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
		let e = F()
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
		prev[1].onclick = ()=>{change(-1)}
		next[1].onclick = ()=>{change(1)}
		return x
	},
	
	authorBox(page) {
		let elem = F()
		if (!page)
			return elem
		elem.append(
			pageEditedTime("Author:", page.createDate), " ",
			entityTitleLink(page.createUser, true))
		if (page.editUserId != page.createUserId) {
			elem.append(
				" ", pageEditedTime("Edited by:", page.editDate),
				" ", entityTitleLink(page.editUser, true))
		} else if (page.createDate != page.editDate) { //edited by same user
			elem.append(" ", pageEditedTime("Edited", page.editDate))
		}
		return elem
	},
	
	pageEditedTime(label, time) {
		let b = E`span`
		b.className = "item"
		
		let a = E`div`
		a.className = "half half-label"
		a.textContent = label
		b.append(a)
		
		a = timeAgo(time)
		a.className += " half"
		b.append(a)
		return b
	},
	
	timeAgo(time) {
		let t = E`time`
		t.className += " time-ago"
		t.setAttribute('datetime', time.toISOString())
		t.textContent = timeAgoString(time)
		t.title = time.toString()
		return t
	},
	
	timeAgoString(date) {
		let seconds = (Date.now() - date.getTime()) / 1000
		let desc = [
			[31536000, 1, "year", "years"],
			[2592000, 1, "month", "months"],
			[86400, 1, "day", "days"],
			[3600, 0, "hour", "hours"],
			[60, 0, "minute", "minutes"],
		].find(desc => seconds > desc[0]*0.9)
		if (!desc)
			return "Just now"
		let round = (seconds/desc[0]).toFixed(desc[1]).replace(/\.0$/,"") // only works with 0 or 1 digit of precision oops
		let units = +round==1 ? desc[2] : desc[3]
		return `${round} ${units} ago`
		/*if (seconds <= -0.5)
		  return " IN THE FUTURE?"
		  return Math.round(seconds) + " seconds ago"*/
	},
	
	categoryInput() {
		let input = new INPUTS.category({})
		return input
	},
	
	permissionRow(user, perms) {
		let id = user ? user.id : -1
		let row = E`tr`
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
			row.child`td`.append(b[0])
		} else
			row.child`td`
		row.child`th`.append(name)
		;['r','c','u','d'].forEach((p)=>{
			let inp = row.child`td`.child`input`
			inp.type = 'checkbox'
			inp.checked = perms.indexOf(p)>=0
			inp.value = p
		})
		row.dataset.id = id
		return row
	},
	
	permissionInput() {
		let input = new INPUTS.permissions({})
		return input
	},
	
	userSelector() {
		let elem = E`user-select`
		elem.className = "bar rem1-5"
		let input = E`input`
		input.placeholder = "Search Username"
		input.className = "item"
		let dropdown = E`select`
		dropdown.className = "item"
		let placeholder = E`option`
		placeholder.textContent = "select user..."
		placeholder.disabled = true
		placeholder.hidden = true
		
		let placeholder2 = E`option`
		placeholder2.textContent = "loading..."
		placeholder2.disabled = true
		placeholder2.hidden = true
		
		let submit = E`button`
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
					let option = E`option`
					option.value = user.id
					option.textContent = user.username
					dropdown.append(option)
					found = true
				})
				if (!found) {
					let option = E`option`
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
	
	messageControls() {
		let elem = E`message-controls`
		let x = {
			elem: elem
		}
		let btn = button()
		elem.append(btn[0])
		btn[1].onclick = ()=>{x.onclick()}
		btn[1].tabIndex = "-1"
		btn[1].textContent = "edit"
		btn[0].className += " rightAlign loggedIn"
		return x
	},
	
	settings(settings, onchange) {
		let get = {}
		let set = {}
		let change = (name)=>{
			var value = get[name]()
			Store.set("setting-"+name, JSON.stringify(value))
			onchange(name, value)
		}
		let x = {
			elem: F(),
			get() {
				let ret = {}
				get.forEach((func, key)=>{ret[key] = func()})
				return ret
			},
			set(data) {
				set.forEach((func, key)=>{func(data[key])})
			},
			saveAll() {
				get.forEach((func, key)=>{change(key)})
			}
		}
		settings.forEach((data, name)=>{
			let type = data.type
			let label = E`label`
			label.textContent = data.name+": "
			x.elem.append(label)
			let elem
			if (type=='select') {
				elem = E`select`
				data.options.forEach((option)=>{
					let opt = elem.child`option`
					opt.value = option
					opt.textContent = option
				})
			} else if (type=='textarea') {
				elem = E`textarea`
			} else {
				console.error("settings field '"+name+"' has invalid selection type '"+type+"'", data)
				return // invalid setting field type
			}
			get[name] = ()=>{
				return elem.value
			}
			set[name] = (value)=>{
				elem.value = value
			}
			
			let value = Store.get("setting-"+name)
			if (value != null) {
				value = JSON.safeParse(value)
				set[name](value)
				onchange(name, value)
			}
			if (data.autosave != false) {
				elem.onchange = ()=>{
					change(name);
				}
			}
			
			if (elem)
				x.elem.append(elem)
			x.elem.child`br`
		})
		return x
	},
	
	galleryLabel(entity) {
		let element = entityLink(entity)
		element.className += " bar rem1-5"
		
		let icon = iconTitle(entity)
		element.append(icon)
		
		/*var author = entityTitleLink(entity.createUser, true)
		  var b = E`div`
		  b.appendChild(author)
		  b.className += " rightAlign"
		  element.appendChild(b)*/
		
		return element
	},
	
	sidebarComment(comment) {
		let d = E`div`
		d.className += " bar rem1-5 sidebarComment ellipsis"
		if (comment.editUserId != comment.createUserId) {
			d.append(entityTitleLink(comment.editUser))
			d.append(" edited ")
		}
		d.append(entityTitleLink(comment.createUser))
		d.append(": ")
		d.append(comment.content.replace(/\n/g, "  "))
		d.dataset.id = comment.id
		d.title = comment.createUser.username+" in "+comment.parentId+":\n"+comment.content
		return d
	},
	
	//todo:
	sidebarPageLabel(content) {
		
	},
	
	// FIXME: There is no live updating of the vote count. It only adds
	// the user's count to the user vote when the user votes,
	// which is clearly an awful way of doing things. I don't
	// understand how listener is implemented 	in this, so I don't
	// feel like touching it.
	
	// @@ who wrote this comment??
	voteButton(disptext, state, page) {
		let b = button()
		b[0].className += ' item'
		b[1].className += ' voteButton'
		if (page.about.myVote == state)
			b[1].dataset.selected = ""
		b[1].dataset.vote = state
		
		let label = E`div`
		label.textContent = disptext
		b[1].append(label)
		
		let count = E`div`
		count.className = ' voteCount'
		count.dataset.vote = state
		count.textContent = page.about.votes[state].count
		b[1].append(count)
		
		return b[0]
	},
	
	voteBox(page) {
		let element = E`div`
		element.className += ' item rightAlign'
		
		if (!page)
			return element
		
		let buttonStates = [
			['-', 'b'], ['~', 'o'], ['+', 'g']
		]
		let buttons = buttonStates.map(x => voteButton(x[0], x[1], page))
		
		buttons.forEach((x)=>{
			x.onclick = (e)=>{
				if (!Req.auth)
					return
				
				let button = e.currentTarget.querySelector('button')
				let state = button.dataset.vote
				let vote = state
				let oldButton = element.querySelector('button[data-selected]')
				// disable button so that it won't increment multiple times while
				// query is happening
				button.disabled = true
				// check if vote was already toggled
				if (oldButton &&
					 oldButton.hasAttribute('data-selected') &&
					 button.hasAttribute('data-selected'))
					vote = undefined
				Req.setVote(page.id, vote, (e, resp)=>{
					// in case the vote fails when user is blocked from voting
					if (!e) {
						// if the vote was already toggled, then remove highlight
						let replaceVote = (q, x)=>{
							let c = element.querySelector(q)
							c.textContent = String(Number(c.textContent) + x)
						}
						if (!vote) {
							delete button.dataset.selected
							replaceVote('.voteCount[data-vote="' + state + '"]', -1)
						} else {
							// otherwise, we want to remove the highlight from the
							// button that was already pressed before and highlight
							// the new button
							if (oldButton) {
								delete oldButton.dataset.selected
								replaceVote('.voteCount[data-vote="' + oldButton.getAttribute('data-vote') + '"]', -1)
							}
							button.dataset.selected = ""
							replaceVote('.voteCount[data-vote="' + state + '"]', 1)
						}
					}
					button.disabled = false
				})
			}
			element.append(x)
		})
		return element
	},
	
	updateTimestamps(element) {
		element.querySelectorAll("time.time-ago").forEach((e)=>{
			e.textContent = timeAgoString(new Date(e.getAttribute('datetime')))
		})
	},
	
	navCategory(cat) {
		let elem = E`div`
		let label = entityTitleLink(cat)
		label.className += " bar rem1-5 linkBar"
		elem.append(label)
		let elem2 = E`div`
		elem.append(elem2)
		elem2.className += " category-childs"
		cat.children && cat.children.forEach((c)=>{
			elem2.append(navCategory(c))
		})
		return elem
	}

}) //*/

function hasPerm(perms, id, perm) {
	return perms && perms[id] && perms[id].includes(perm)
}
								  
let F = document.createDocumentFragment.bind(document)
function E(name) {
	return document.createElement(name[0])
}

}()) //*/
