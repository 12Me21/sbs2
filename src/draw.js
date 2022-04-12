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
	
	//📥 content‹Content›
	//📤 ‹ParentNode›
	content_link: function(content) {
		let e = this()
		e.href = Nav.entity_link(content)
		let hidden = !Entity.has_perm(content.permissions, 0, 'R')
		let bg
		if (hidden)
			bg = 'resource/hiddenpage.png'
		else
			bg = 'resource/page-resource.png'
		let icon = e.firstChild
		icon.style.backgroundImage = `url("${bg}")`
		
		e.lastChild.textContent = content.name
		
		return e
	}.bind(𐀶`
<a>
	<span class="item icon iconBg" role="img" alt=""></span>
	<span class="textItem pre entity-title">...</span>
</a>
`),
	
	//📥 user‹User›
	//📥 params‹String›
	//📤 ‹String›
	avatar_url(user, params) {
		if (!user || !user.avatar)
			return "resource/avatar.png"
		return Req.file_url(user.avatar, params)
	},
	
	//📥 text‹String›
	//📤 ‹ParentNode›
	text_item: function(text) {
		let e = this()
		e.textContent = text
		return e
	}.bind(𐀶`<span class='textItem pre'>`),
	
	//📥 text‹String›
	//📤 ‹ParentNode›
	sidebar_debug: function(text) {
		let e = this()
		e.textContent = text
		return e
	}.bind(𐀶`<div class='debugMessage pre'>`),
	
	//📥 user‹User›
	//📤 ‹ParentNode›
	link_avatar: function(user) {
		let a = this()
		a.href = Nav.entityPath(user)
		a.title = user.username
		a.append(avatar(user))
		return a
	}.bind(𐀶`<a>`),
	
	//📥 user‹User›
	//📤 ‹ParentNode›
	avatar: function(user) {
		let e = this()
		e.src = avatar_url(user, "size=100&crop=true")
		return e
	}.bind(𐀶`<img class='item avatar' width=100 height=100 alt="">`),
	
	//📥 file‹Content›
	//📥 onclick‹Function›
	//📤 ‹ParentNode›
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
	
	//📥 page‹Content›
	//📤 ‹ParentNode›
	markup(page) {
		let lang = page.values ? page.values.markupLang : null
		return Markup.convert_lang(page.text, lang, undefined)
	},
	
	//📥 path‹???›
	//📤 ‹ParentNode›
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
	
	//📥 page‹Content›
	//📤 ...
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
		let b = button2("Hide", null)
		b.className += " rightAlign item loggedIn"
		list1.append(b)
		// scroller
		let outer = e.lastChild
		let inner = outer.firstChild
		return [e, page1, page2, outer, inner, list2, b.firstChild/*hack*/]
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
	
	//📥 user‹User›
	//📤 ‹ParentNode›
	userlist_avatar: function(user) {
		let e = this()
		e.href = Nav.entity_link(user)
		e.firstChild.src = Req.file_url(user.avatar, "size=100&crop=true")
		//if (status.status == "idle")
		//	e.classList.add('status-idle')
		return e
	}.bind(𐀶`<a><img class='item avatar' width=100 height=100 alt="">`),
	
	//📥 comment‹Message›
	//📤 ‹ParentNode›
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
		time.dateTime = comment.createDate
		time.textContent = time_string(comment.createDate2)
		
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
	
	//📥 comment‹Message›
	//📤 ‹ParentNode›
	message_part: function(comment) {
		let e = this()
		
		if (Entity.is_edited_comment(comment))
			e.className += " edited"
		
		// this is a hack, maybe
		e.x_data = comment
		
		e.dataset.id = comment.id
		e.dataset.time = comment.createDate2.getTime()
		Markup.convert_lang(comment.text, comment.values.m, e)
		return e
	}.bind(𐀶`<message-part tab-index=0>`),
	
	//📥 date‹Date›
	//📤 ‹String›
	time_string(date) {
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
	
	//📥 elem‹ParentNode› - container to insert message blocks into
	//📥 comment‹Message› - comment to insert
	//📥 backwards‹Boolean› - whether to insert at beginning
	//📤 ‹ParentNode› - the newly drawn message-part
	insert_comment_merge(elem, comment, backwards) { // too many args
		let contents
		// check whether comment can be merged
		let block = elem[backwards?'firstChild':'lastChild']
		if (block) {
			// if the prev block has message-contents
			let oldcontents = block.querySelector('message-contents')
			if (oldcontents) {
				// and the merge-hashes match
				let oldhash = block.dataset.merge
				let newhash = Entity.comment_merge_hash(comment)
				if (oldhash == newhash) {
					// aand the time isn't > 5 minutes
					let last = oldcontents[backwards?'firstChild':'lastChild']
					let oldtime = last.x_data.createDate2
					if (Math.abs(comment.createDate2-oldtime) <= 1000*60*5)
						contents = oldcontents
				}
			}
		}
		// otherwise create a new message-block
		if (!contents) {
			;[block, contents] = message_block(comment)
			elem[backwards?'prepend':'append'](block)
		}
		// draw+insert the new message-part
		let part = message_part(comment)
		contents[backwards?'prepend':'append'](part)
		return part
	},
	
	// this needs to be improved
	search_comment(comment, parent) {
		let outer = EC('div', 'bottomBorder')
		let pg = content_link(parent)
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
				ChatRoom.load_messages_near(comment.contentId, firstId, false, 10, resp=>{
					for (let c of resp.message) {
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
				ChatRoom.load_messages_near(comment.contentId, lastId, true, 10, resp=>{
					for (let c of resp.message) {
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
	
	button2: function(label, onclick) {
		let e = this()
		let btn = e.firstChild
		btn.append(label)
		btn.onclick = onclick
		return e
	}.bind(𐀶`<button-container><button>`),
	
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
	
	// update the timestamps in the sidebar activity list
	// (todo: should we update them everywhere else on the site too?)
	update_timestamps(element) {
		for (let e of element.querySelectorAll("time.time-ago"))
			e.textContent = time_ago_string(new Date(e.dateTime))
	},
	
	// <div>
	//   [entity title link]
	//   <div class='category-childs'>
	//     ...
	//   </div>
	// </div>
	nav_category(cat) {
		let elem = E`div`
		let label = content_link(cat)
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
