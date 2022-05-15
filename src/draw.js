// HTML RENDERING
let Draw = Object.create(null)
with(Draw)((window)=>{"use strict";Object.assign(Draw,{
	
	//📥 content‹Content›
	//📤 ‹ParentNode›
	content_label: function(content, block) {
		let e = this[block?1:0]()
		if (block)
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
	}.bind([𐀶`
<span class="item icon iconBg" role="img" alt=""></span>
<span class="textItem entity-title" 🪧>...</span>
`,
𐀶`
<a class='bar rem1-5 linkBar'>
<span class="item icon iconBg" role="img" alt=""></span>
<span class="textItem entity-title" 🪧>...</span>
</a>
`
]),
	
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
	}.bind(𐀶`<span class='textItem' 🪧>`),
	
	//📥 thing‹???›
	//📤 ‹ParentNode›
	sidebar_debug: function(thing) {
		let e = this.message()
		let text = "<???>"
		try {
			if (thing instanceof Error) {
				let s = this.stack()
				s.textContent = thing.stack.split("\n").reverse().join("\n↓")
				e.append(s)
			}
			text = String(thing)
		} catch (error) {
			let type = Object.getPrototypeOf(thing)
			if (type && type.constructor) {
				let c = type.constructor
				if (c && c.name && typeof c.name == 'string')
					text = `<${cname}>`
			}
		} finally {
			e.append(text)
			return e
		}
	}.bind({message:𐀶`<div class='debugMessage' 🪧>`, stack:𐀶`<pre>`}),
	
	//📥 user‹User›
	//📤 ‹ParentNode›
	link_avatar: function(user) {
		let a = this()
		a.href = Nav.entity_link(user)
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
				link.className += ' textItem entity-title'
				link.setAttribute('🪧', "")
				element.append(link)
			}
			if (i < path.length-1) {
				let slash = element.child('span', 'pathSeparator textItem')
				slash.textContent = "/"
			}
		})
		return element
	},
	
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
	
	single_message(comment) {
		let [block, contents] = message_block(comment)
		contents.append(message_part(comment))
		return block
	},
	
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
			nickname.querySelector('[🪧]').textContent = author.realname
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
		<message-username><span class='username' 🪧></span>:</message-username>
		<time></time>
	</message-header>
	<message-contents></message-contents>
</message-block>`,
		nickname: 𐀶` <span class='real-name-label'>(<span 🪧></span>)</span>`,
		avatar: 𐀶`<img class='avatar' width=100 height=100 alt="">`,
		big_avatar: 𐀶`<div class='bigAvatar'></div>`,
	}),
	
	//📥 comment‹Message›
	//📤 ‹ParentNode›
	message_part: function(comment) {
		let e = this()
		
		if (comment.edited)
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
	
	// this needs to be improved
	search_comment: function(comment, parent) {
		let outer = this()
		
		let pg = content_label(parent, true)
		outer.prepend(pg)
		
		let inner = outer.lastChild
		
		let pid = comment.contentId
		
		inner.before(button2("Load Older", function() {
			load_messages_near(pid, inner, false, 10, (ok)=>{
				if (!ok)
					this.disabled = true
			})
		}))
		
		inner.append(single_message(comment))
		
		inner.after(button2("Load Newer", function() {
			load_messages_near(pid, inner, true, 10, (ok)=>{
				if (!ok)
					this.disabled = true
			})
		}))
		
		return outer
	}.bind(𐀶`
<div class='bottomBorder'>
	<message-list></message-list>
</div>
`),
	
	//todo; like, request_button which disables/enables automatically
	button2: function(label, onclick) {
		let e = this()
		e.append(label)
		e.onclick = onclick
		return e
	}.bind(𐀶`<button>`),
	
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
	
	update_activity_page: function(item) {
		item.elem.href = Nav.entity_link(item.content)
		item.page_elem.fill(content_label(item.content))
		
		/*let userlist = e.lastChild.lastChild
		
		let users = Object.values(item.users)
		users.sort((a, b)=> -(a.date - b.date))
		for (let u of users) {
			if (u.user) {
				let x = link_avatar(u.user)
				x.title += "\n"+time_ago_string(u.date)
				userlist.append(x)
			}
		}
		
		let time = e.lastChild.firstChild
		//let time = time_ago(item.date)*/
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
		let round = (seconds/desc[0]).toFixed(desc[1]).replace(/[.]0/, "")
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
	}.bind(𐀶`<div class='bar rem1-5 sidebarComment ellipsis'><a><img class='item icon avatar' width=100 height=100><span class='textItem entity-title' 🪧></span></a>: </div>`),
	
	//todo:
	sidebarPageLabel(content) {
		
	},
	
	// update the timestamps in the sidebar activity list
	// (todo: should we update them everywhere else on the site too?)
	update_timestamps(element) {
		for (let e of element.querySelectorAll("time.time-ago")) {
			e.textContent = time_ago_string(new Date(e.dateTime))
		}
	},
	
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
