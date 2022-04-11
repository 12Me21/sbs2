function 𐀶([html]) {
	let temp = document.createElement('template')
	temp.innerHTML = html.replace(/\n\s*/g,"")
	let node = temp.content
	if (node.childNodes.length==1)
		node = node.firstChild
	return node.cloneNode.bind(node, true)
}

// HTML RENDERING
let Draw = Object.create(null)
with(Draw)((window)=>{"use strict";Object.assign(Draw,{
	
	avatar_url(user, params) {
		if (!user || !user.avatar)
			return "resource/avatar.png"
		return Req.file_url(user.avatar, params)
	},
	
	// todo: these are all kinda gross
	// I thought it was clever but now it's like
	// why do i have the same function for drawing user labels and page/category... idk
	
	// icon + name
	icon_title(entity, reverse) {
		let elem = F()
		let title = EC('span', 'textItem pre entity-title')
		title.textContent = entity ? entity.name : "MISSINGNO."
		let i = icon(entity)
		if (reverse)
			elem.append(title, i)
		else
			elem.append(i, title)
		return elem
	},
	
	entity_link(entity) {
		let path = Nav.entityPath(entity)
		let element = E`a`
		if (path)
			element.href = "#"+path
		return element
	},
	
	// page (or category) wiht user
	page_bar(page) {
		let bar = entity_title_link(page)
		/*if (page.createUser) {
			let usr = entity_title_link(page.createUser, true)
			usr.className += ' rightAlign'
			bar.append(usr)
		}*/
		return bar
	},
	
	entity_title_link(entity, reverse) {
		let element = entity_link(entity)
		let icon = icon_title(entity, reverse)
		element.append(icon)
		return element
	},
	
	text_item: function(text) {
		let e = this()
		e.textContent = text
		return e
	}.bind(𐀶`<span class='textItem pre'>`),
	
	sidebar_debug: function(text) {
		let e = this()
		e.textContent = text
		return e
	}.bind(𐀶`<div class='debugMessage pre'>`),
	
	link_avatar: function(user) {
		let a = this()
		a.href = Nav.entityPath(user)
		a.title = user.username
		a.append(avatar(user))
		return a
	}.bind(𐀶`<a>`),
	
	avatar: function(user) {
		let e = this()
		e.src = avatar_url(user, "size=100&crop=true")
		return e
	}.bind(𐀶`<img class='item avatar' width=100 height=100 alt="">`),
	
	file_thumbnail: function(file, onclick) {
		let e = this()
		e.dataset.id = file.id
		let img = e.firstChild
		img.src = Req.file_url(file.id, "size=50")
		img.alt = file.name
		img.title = file.name
		if (onclick)
			e.onclick = (event) => { onclick(file, event) } // bad
		return e
	}.bind(𐀶`<div class='fileThumbnail item'><img>`),
	
	bg_icon: function(url) {
		let e = this()
		e.style.backgroundImage = `url("${url}")`
		return e
	}.bind(𐀶`<span class='item icon iconBg' role=img alt="">`), //todo:alt
	
	// ? <img class='item icon avatar' src=... width=100 height=100>
	// ? [bg-icon]
	icon(entity) {
		let element
		let type = entity && entity.Type
		if (type == 'user') {
			element = EC('img', 'item icon avatar')
			element.src = avatar_url(entity, "size=100&crop=true")
			element.width = element.height = 100
		} else if (type=='content') {
			let hidden = !Entity.has_perm(entity.permissions, 0, 'r')
			if (hidden) {
				element = bg_icon('resource/hiddenpage.png')
			} else { //TODO: make this better!
				let pageType = entity.type
				if (['chat','documentation','program','resource','tutorial','userpage'].includes(pageType))
					element = bg_icon('resource/page-'+pageType+'.png')
				else
					element = bg_icon('resource/unknownpage.png')
			}
		} else if (type=='category') {
			element = bg_icon('resource/category.png')
		} else {
			element = bg_icon('resource/unknownpage.png')
		}
		return element
	},
	
	// returns a documentFragment
	markup(page) {
		let lang = page.values ? page.values.markupLang : null
		return Markup.convert_lang(page.text, lang, undefined)
	},
	
	title_path(path) {
		let element = F()
		if (!path)
			return element
		path.forEach((item, i, path)=>{
			if (item) { //todo: use entities here instead
				let link = E`a`
				link.href = item[0]
				link.textContent = item[1]
				link.className += ' textItem pre entity-title'
				element.append(link)
			}
			if (i < path.length-1) {
				let slash = element.child('span', 'pathSeparator textItem')
				slash.textContent = "/"
			}
		})
		return element
	},
	
	chat_pane: function(page) {
		let e = this.block()
		// page element
		let page1 = e.firstChild
		let page2 = page1.lastChild
		// resize handle
		let resize = e.querySelector('resize-handle')
		let height = null
		height = 0
		View.attach_resize(page1, resize, false, 1, 'setting--divider-pos-'+page.id, null, height)
		// userlist
		let list1 = e.querySelector('.userlist')
		let list2 = list1.firstChild
		let [b0,b1] = button()
		b1.textContent = "Hide"
		b0.className += " rightAlign item loggedIn"
		list1.append(b0)
		// scroller
		let outer = e.lastChild
		let inner = outer.firstChild
		return [e, page1, page2, outer, inner, list2, b1]
	}.bind({
		block: 𐀶`
<chat-pane class='resize-box'>
	<scroll-outer class='sized page-container'>
		<div class='pageContents'></div>
	</scroll-outer>
	<resize-handle></resize-handle>
	<div class='bar rem2-3 userlist'><span>...</span></div>
	<scroll-outer class='grow'>
		<scroll-inner class='chatScroller'></scroll-inner>
	</scroll-outer>
</chat-pane>
`}),
//		<div class='pageInfoPane rem2-3 bar'></div>
	
	userlist_avatar: function(status) {
		let e = this()
		e.href = `#user/${status.user.id}`
		e.firstChild.src = Req.file_url(status.user.avatar, "size=100&crop=true")
		if (status.status == "idle")
			e.classList.add('status-idle')
		return e
	}.bind(𐀶`<a><img class='item avatar' width=100 height=100 alt="">`),
	
	message_block: function(comment) {
		let e = this.block()
		
		let author = comment.Author
		
		e.dataset.uid = comment.createUserId
		e.dataset.merge = Entity.comment_merge_hash(comment)
		
		let avatar
		if (author.bigAvatar) {
			avatar = this.big_avatar()
			avatar.style.backgroundImage = `url("${Req.file_url(author.bigAvatar, "size=500")}")`
		} else {
			avatar = this.avatar()
			avatar.src = Req.file_url(author.avatar, "size=100&crop=true")
		}
		e.prepend(avatar)
		
		let name = e.querySelector('message-username') // todo: is queryselector ok?
		let username
		if (author.nickname == null) {
			username = author.username
		} else {
			username = author.nickname
			let nickname = this.nickname()
			nickname.querySelector('.pre').textContent = author.realname
			name.append(nickname)
		}
		name.firstChild.textContent = username
		
		let time = e.querySelector('time')
		time.setAttribute('datetime', comment.createDate)
		time.textContent = timeString(comment.createDate2)
		
		return [e, e.lastChild]
	}.bind({
		block: 𐀶`
<message-block>
	<message-header>
		<message-username><span class='pre username'></span>:</message-username>
		<time></time>
	</message-header>
	<message-contents></message-contents>
</message-block>`,
		nickname: 𐀶` <span class='real-name-label'>(<span class='pre'></span>)</span>`,
		avatar: 𐀶`<img class='avatar' width=100 height=100 alt="">`,
		big_avatar: 𐀶`<div class='bigAvatar'></div>`,
	}),
	
	message_part: function(comment) {
		let e = this()
		
		if (comment.editDate)
			e.className += " edited"
		
		// this is a hack, maybe
		e.x_data = comment
		
		e.dataset.id = comment.id
		e.dataset.time = comment.createDate2.getTime()
		Markup.convert_lang(comment.text, comment.values.m, e)
		return e
	}.bind(𐀶`<message-part tab-index=0>`),
	
	// date: Date
	// return: String
	timeString(date) {
		// time string as something like: (depends on locale)
		// today: "10:37 AM"
		// older: "December 25, 2021, 4:09 PM"
		let options
		if (Date.now()-date.getTime() > 1000*60*60*12)
			options = {year:'numeric',month:'long',day:'numeric',hour:'numeric', minute:'2-digit'}
		else
			options = {hour:'numeric', minute:'2-digit'}
		return date.toLocaleString([], options)
	},
	
	// block: Element
	// comment: Comment
	// time: Date
	can_merge_comment(block, comment, time) {
		if (block) {
			let hash = block.dataset.merge
			return hash && hash==Entity.comment_merge_hash(comment) && (!time || comment.createDate2-time <= 1000*60*5)
		}
		return false
	},
	
	// elem: Element - container to insert message blocks into
	// part: Element - new message part
	// comment: Comment - data used to generate `part`
	// time: Date - date of last message
	// backwards: Boolean - whether to insert at beginning
	insert_comment_merge(elem, part, comment, time, backwards) { // too many args
		// todo: get the time from the block itself
		let block = elem[backwards?'firstChild':'lastChild']
		let contents
		if (can_merge_comment(block, comment, time))
			contents = block.getElementsByTagName('message-contents')[0]// not great...
		if (!contents) {
			let block
			([block, contents] = message_block(comment))
			elem[backwards?'prepend':'append'](block)
		}
		contents[backwards?'prepend':'append'](part)
	},
	
	// this needs to be improved
	search_comment(comment) {
		let outer = EC('div', 'bottomBorder')
		let pg = entity_title_link(comment.parent)
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
				Req.get_older_comments(comment.contentId, firstId, 10).then(resp=>{
					for (let c of resp.comment) {
						firstId = c.id
						if (c.deleted)
							continue
						let d = message_block(c)
						d[1].append(message_part(c))
						outer.insertBefore(d[0], firstElem)
						firstElem = d[0]
					}
				})
			}
		}
		
		let d = message_block(comment)
		d[1].append(message_part(comment))
		outer.append(d[0])
		firstElem = lastElem = d[0]
		
		{
			let b = button()
			b[1].textContent = "Load Newer"
			outer.append(b[0])
			b[1].onclick = ()=>{
				Req.get_newer_comments(comment.contentId, lastId, 10).then(resp=>{
					for (let c of resp.comment) {
						lastId = c.id
						if (c.deleted)
							continue
						let d = message_block(c)
						d[1].append(message_part(c))
						outer.insertBefore(d[0], b[0]) // yes
					}
				})
			}
		}
		
		return outer
	},
	
	button: function() { // BAD 
		let e = this()
		return [e, e.firstChild]
	}.bind(𐀶`<button-container><button>`),
	
	// <div class='pageInfoPane rem2-3 bar'>
	//   [author box] [vote box]
	// </div>
	page_info(page) {
		let e = EC('div', 'pageInfoPane rem2-3 bar')
		//e.append(author_box(page), vote_box(page))
		return e
	},
	
	// <button role=tab aria-selected=false id=... aria-controls=...>
	//   ...
	// </button>
	sidebar_tabs: function(list, callback) {
		let btns = []
		let frag = F()
		let x = {
			elem: frag,
			select: (i)=>{
				list.forEach((item, i2)=>{
					btns[i2].setAttribute('aria-selected', i==i2)
					item.elem.classList.toggle('shown', i==i2)
				})
			},
		}
		list.forEach((item, i)=>{
			item.elem.setAttribute('role', "tabpanel")
			item.elem.setAttribute('aria-labelledby', "sidebar-tab-"+i)
			
			let btn = this()
			frag.append(btn)
			btn.id = "sidebar-tab-"+i
			btn.setAttribute('aria-controls', "sidebar-panel-"+i) // um did i forgot the corresponding property? TODO
			btns[i] = btn
			btn.onclick = ()=>{ x.select(i) }
			btn.append(item.label)
		})
		return x
	}.bind(𐀶`<button role=tab aria-selected=false>`),
	
	activity_item: function(item) {
		let e = this()
		e.href = Nav.entityPath(item.content)
		e.firstChild.append(icon_title(item.content))
		
		let userContainer=e.lastChild.firstChild
		let time = time_ago(item.lastDate)
		time.className += " textItem"
		
		for (let u of item.users)
			if (u && u.user)
				userContainer.append(link_avatar(u.user))
		
		return e
	}.bind(𐀶`
<a class='activity-page'>
	<div class='bar rem1-5 ellipsis'></div>
	<div class='bar rem1-5'> 
		<activity-users class='rightAlign'></activity-users>
	</div>
<a>
`),
	
	activity_item(item) {
		let outer = entity_link(item.text)
		outer.className += " activity-page"
		
		let bar = outer.child('div', 'bar rem1-5 ellipsis')
		bar.append(icon_title(item.text))
		
		let bar2 = outer.child('div', 'bar rem1-5')
		
		let userContainer = bar2.child('activity-users', 'rightAlign')
		
		let time = time_ago(item.lastDate)
		time.className += " textItem"
		userContainer.append(time, " ")
		
		for (let u of item.users) {
			if (u && u.user) {
				let l = entity_link(u.user)
				l.append(icon(u.user))
				userContainer.append(l)
			}
		}
		
		return outer
	},
	
	// todo: create a special system for pagination
	nav_buttons(callback) {
		let prev = button()
		prev[0].className += " item"
		prev[1].textContent = "<"
		let next = button()
		next[0].className += " item"
		next[1].textContent = ">"
		let page = text_item()
		page.textContent = 1
		let e = F()
		e.append(prev[0], next[0], page)
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
	
	// [page_edited_time] [entity_title_link]
	// ? [page_edited_time] [entity_title_link]
	// ? [page_edited_time]
	author_box(page) {
		let elem = F()
		if (!page)
			return elem
		elem.append(
			page_edited_time("Author:", page.createDate2), " ",
			entity_title_link(page.createUser, true))
		if (page.editUserId != page.createUserId) {
			elem.append(
				" ", page_edited_time("Edited by:", page.lastRevisionDate),
				" ", entity_title_link(page.editUser, true))
		} else if (page.createDate != page.lastRevisionDate) { //edited by same user
			elem.append(" ", page_edited_time("Edited", page.lastRevisionDate))
		}
		return elem
	},
	
	// <span class='item'>
	//   <div class='half half-label'>...</div>
	//   <??? class='... half'>???<???>
	// </span>
	page_edited_time(label, time) {
		let b = EC('span', 'item')
		
		let a = b.child('div', 'half half-label')
		a.textContent = label
		
		a = time_ago(time)
		b.append(a)
		a.className += " half"
		return b
	},
	
	time_ago: function(time) {
		let e = this()
		e.setAttribute('datetime', time.toISOString())
		e.textContent = time_ago_string(time)
		e.title = time.toString()
		return e
	}.bind(𐀶`<time class='time-ago'>`),
	
	time_ago_string(date) {
		let seconds = (Date.now() - date.getTime()) / 1000
		let desc = [
			[31536000, 1, "year", "years"],
			[2592000, 1, "month", "months"],
			[86400, 1, "day", "days"],
			[3600, 0, "hour", "hours"],
			[60, 0, "min", "min"],
		].find(desc => seconds > desc[0]*0.96)
		if (!desc)
			return "Just now"
		let round = (seconds/desc[0]).toFixed(desc[1]).replace(/\.0$/,"") // only works with 0 or 1 digit of precision oops
		let units = +round==1 ? desc[2] : desc[3]
		return `${round} ${units} ago`
		/*if (seconds <= -0.5)
		  return " IN THE FUTURE?"
		  return Math.round(seconds) + " seconds ago"*/
	},
	
	// todo: switch to grid layout here?
	// <tr data-id=...>
	//   <td>...</td>
	//   <th>
	//     ? Default
	//     ? [entity title link]
	//   </th>
	//   <td><input type=checkbox checked=... value=r></td>
	//   <td><input type=checkbox checked=... value=c></td>
	//   <td><input type=checkbox checked=... value=u></td>
	//   <td><input type=checkbox checked=... value=d></td>
	// </tr>
	permission_row(user, perms) {
		let id = user.id
		let row = E`tr`
		row.dataset.id = id
		// remove button
		if (id) {
			let b = button()
			b[1].textContent = "remove"
			b[1].onclick = ()=>{ row.remove() }
			row.child('td').append(b[0])
		} else
			row.child('td')
		// name label
		let name
		if (!id)
			name = text_item("Default")
		else
			name = entity_title_link(user, true)
		name.className += " bar rem1-5"
		row.child('th').append(name)
		// checkboxes
		for (let p of ['r','c','u','d']) {
			let inp = row.child('td').child('input')
			inp.type = 'checkbox'
			inp.checked = perms.indexOf(p)>=0
			inp.value = p
		}
		//
		return row
	},
	
	//
	user_selector() {
		let elem = EC('user-select', 'bar rem1-5')
		let input = elem.child('input', 'item')
		input.placeholder = "Search Username"
		let dropdown = elem.child('select', 'item')
		let placeholder = E`option`
		placeholder.textContent = "select user..."
		placeholder.disabled = true
		placeholder.hidden = true
		
		let placeholder2 = E`option`
		placeholder2.textContent = "loading..."
		placeholder2.disabled = true
		placeholder2.hidden = true
		
		let submit = elem.child('button', 'item')
		submit.textContent = "select"
		submit.disabled = true
		
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
			dropdown.fill(placeholder2)
			placeholder2.selected = true
			results = true
			Req.searchUsers(x.searchText).then(({user_map})=>{
				dropdown.fill()
				results = user_map
				submit.disabled = false
				let found = false
				for (let [id, user] of user_map) {
					let option = dropdown.child('option')
					option.value = user.id
					option.textContent = user.name
					found = true
				}
				if (!found) {
					let option = dropdown.child('option')
					option.value = "0"
					option.textContent = "(no results)"
					option.disabled = true
					dropdown.value = "0"
					input.focus()
				}
			}, (e, resp)=>{
				dropdown.fill()
				x.searchText = null //error
			})
		}
		let reset = ()=>{
			if (results) {
				submit.disabled = true
				dropdown.fill(placeholder)
				placeholder.selected = true
				results = null
				x.searchText = null
			}
		}
		submit.onclick = ()=>{
			let uid = +dropdown.value
			if (uid) {
				x.onchange(results[uid])
				input.focus()
				input.value = ""
				reset()
			}
		}
		results = true
		reset()
		return x
	},
	
	message_controls: function(info, edit) {
		let e = this()
		e.firstChild.onclick = info
		e.lastChild.onclick = edit
		return {elem: e}
	}.bind(𐀶`<message-controls><button tab-index=-1>⚙</button><button tab-index=-1>✏</button>`),
	
	// todo: replace this
	settings(settings) {
		let get = {}
		let update = (name)=>{
			let value = get[name]()
			settings.change(name, value)
		}
		let x = {
			elem: F(),
			update_all() {
				Object.for(get, (func, key)=>{
					update(key)
				})
			}
		}
		Object.for(settings.fields, (data, name)=>{
			let type = data.type
			let label = x.elem.child('label')
			label.textContent = data.name+": "
			let elem
			if (type=='select') {
				elem = E`select`
				for (let option of data.options) {
					let opt = elem.child('option')
					opt.value = option
					opt.textContent = option
				}
			} else if (type=='textarea') {
				elem = E`textarea`
			} else if (type=='text') {
				elem = E`input`
			}
			
			get[name] = ()=>{
				return elem.value
			}
			
			let value = settings.values[name]
			elem.value = value
			
			if (data.autosave != false)
				elem.onchange = ()=>{
					update(name)
				}
			
			elem && x.elem.append(elem)
			x.elem.child('br')
		})
		return x
	},
	
	// <div class='bar rem1-5 sidebarComment ellipsis'>
	//   ? [entity-title-link] edited
	//   [entity-title-link] : ...
	// </div>
	sidebar_comment: function(comment) {
		let d = this()
		d.dataset.id = comment.id
		
		let author = comment.Author
		d.title = `${author.username} in ${comment.contentId}:\n${comment.text}` // todo: page name 🥺  oh︕ emojis render in italic? don't remember adding that...   we should store refs to pages but like intern them so its not a memory leak...
		
/*		if (comment.editDate && comment.editUserId!=comment.createUserId) {
			d.append(
				entity_title_link(comment.editUser),
				" edited ",
			)
			}*/
		let nl = d.firstChild
		nl.href = "#user/"+comment.createUserId
		nl.firstChild.src = Req.file_url(author.avatar, "size=100&crop=true")
		nl.lastChild.textContent = author.username
		
		d.append(comment.text.replace(/\n/g, "  "))
		//entity_title_link(comment.createUser),
		return d
	}.bind(𐀶`<div class='bar rem1-5 sidebarComment ellipsis'><a><img class='item icon avatar' width=100 height=100><span class='textItem pre entity-title'></span></a>: </div>`),
	
	//todo:
	sidebarPageLabel(content) {
		
	},
	
	// FIXME: There is no live updating of the vote count. It only adds
	// the user's count to the user vote when the user votes,
	// which is clearly an awful way of doing things. I don't
	// understand how listener is implemented 	in this, so I don't
	// feel like touching it.
	
	// @@ who wrote this comment??
	vote_button(disptext, state, page) {
		let b = button()
		b[0].className += ' item'
		b[1].className += ' voteButton'
		if (page.about.myVote == state)
			b[1].dataset.selected = ""
		b[1].dataset.vote = state
		
		let label = b[1].child('div')
		label.textContent = disptext
		
		let count = b[1].child('div', 'voteCount')
		count.dataset.vote = state
		count.textContent = page.about.votes[state].count
		
		return b[0]
	},
	
	// <div class='item rightAlign'>
	//   [vote-button] [vote-button] [vote-button]
	// </div>
	vote_box(page) {
		let element = EC('div', 'item rightAlign')
		
		if (!page)
			return element
		
		let buttonStates = [['-', 'b'], ['~', 'o'], ['+', 'g']]
		let buttons = buttonStates.map(x => vote_button(x[0], x[1], page))
		
		for (let x of buttons) {
			element.append(x)
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
				Req.setVote(page.id, vote).then((resp)=>{
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
							replaceVote('.voteCount[data-vote="' + oldButton.dataset.vote + '"]', -1)
						}
						button.dataset.selected = ""
						replaceVote('.voteCount[data-vote="' + state + '"]', 1)
					}
				}).finally(()=>{
					button.disabled = false
				})
			}
		}
		return element
	},
	
	// update the timestamps in the sidebar activity list
	// (todo: should we update them everywhere else on the site too?)
	update_timestamps(element) {
		for (let e of element.querySelectorAll("time.time-ago"))
			e.textContent = time_ago_string(new Date(e.getAttribute('datetime')))
	},
	
	// <div>
	//   [entity title link]
	//   <div class='category-childs'>
	//     ...
	//   </div>
	// </div>
	nav_category(cat) {
		let elem = E`div`
		let label = entity_title_link(cat)
		label.className += " bar rem1-5 linkBar"
		elem.append(label)
		let elem2 = elem.child('div', 'category-childs')
		cat.children && elem2.fill(
			cat.children.map((c) => nav_category(c))
		)
		return elem
	}
	
})<!-- PRIVATE })
Object.seal(Draw)

let F = document.createDocumentFragment.bind(document)
function E(name) {
	return document.createElement(name[0])
}
function EC(name, classes) {
	let elem = document.createElement(name)
	elem.className = classes
	return elem
}

0<!-- Draw ({
})(window)
