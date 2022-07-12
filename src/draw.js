'use strict'
// HTML RENDERING
const Draw = Object.seal({
	// TODO: rewrite the css/layout for these
	// also, update the icons for the current site's features
	//📥 content‹Content›
	//📤 ‹ParentNode›
	content_label: function(content, block) {
		let e = this[block?1:0]()
		if (block)
			e.href = Nav.entity_link(content)
		
		let hidden = !Entity.has_perm(content.permissions, 0, 'R')
		let bg
		if (content.contentType!=CODES.page)
			bg = 'resource/unknownpage.png'
		else if (content.literalType=='category')
			bg = 'resource/category.png'
		else if (hidden)
			bg = 'resource/hiddenpage.png'
		else
			bg = 'resource/page-resource.png'
		let icon = e.firstChild
		icon.style.backgroundImage = `url("${bg}")`
		
		e.lastChild.textContent = content.name
		
		return e
	}.bind([
		𐀶`
<span class='item icon iconBg' role=img alt=""></span>
<span class='textItem entity-title pre'>...</span>
`,
		𐀶`
<a class='bar rem1-5 linkBar'>
	<span class='item icon iconBg' role=img alt=""></span>
	<span class='textItem entity-title pre'>...</span>
</a>
`,
	]),
	
	//📥 text‹String›
	//📤 ‹ParentNode›
	text_item: function(text) {
		let e = this()
		e.textContent = text
		return e
	}.bind(𐀶`<span class='textItem pre'>`),
	
	// user: User / Author
	avatar_url(user, size=100) {
		if (!user || !user.avatar)
			return "resource/avatar.png"
		return Req.file_url(user.avatar, "size="+size+"&crop=true")
	},
	
	//📥 user‹User›
	//📤 ‹ParentNode›
	avatar: function(user) {
		let e = this()
		e.src = Draw.avatar_url(user)
		return e
	}.bind(𐀶`<img class='item avatar' width=100 height=100 alt="">`),
	
	// used by activity
	//📥 user‹User›
	//📤 ‹ParentNode›
	link_avatar: function(user) {
		let a = this()
		a.href = Nav.entity_link(user)
		a.title = user.username
		a.append(Draw.avatar(user))
		return a
	}.bind(𐀶`<a tabindex=-1 role=gridcell>`),
	
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
			e.onclick = e=>{onclick(file, e)} // bad
		return e
	}.bind(𐀶`<div class='fileThumbnail item'><img></div>`),
	
	//📥 user‹User›
	//📤 ‹ParentNode›
	userlist_avatar: function(user, status) {
		let e = this()
		e.href = Nav.entity_link(user)
		e.firstChild.src = Draw.avatar_url(user)
		e.firstChild.title = user.username
		e.dataset.uid = user.id
		if (status == "idle")
			e.classList.add('status-idle')
		return e
	}.bind(𐀶`<a tabindex=-1><img class='avatar' width=100 height=100 alt="">`),
	
	//📥 comment‹Message›
	//📤 ‹ParentNode›
	message_block: function(comment) {
		let e = this.block()
		
		let author = comment.Author
		
		e.dataset.uid = comment.createUserId
		e.nonce = comment.Author.merge_hash
		
		let avatar
		if (author.bigAvatar) {
			avatar = this.big_avatar()
			let url = Req.file_url(author.bigAvatar, "size=500")
			avatar.style.backgroundImage = `url("${url}")`
		} else {
			avatar = this.avatar()
			avatar.src = Draw.avatar_url(author)
		}
		e.prepend(avatar)
		
		let name = e.querySelector('message-username') // todo: is queryselector ok?
		let username
		if (author.nickname == null) {
			username = author.username
		} else {
			username = author.nickname
			if (author.bridge)
				name.append(this.bridge())
			else {
				let nickname = this.nickname()
				nickname.querySelector('span.pre').textContent = author.username
				name.append(nickname)
			}
		}
		name.firstChild.textContent = username
		
		let time = e.querySelector('time')
		time.dateTime = comment.createDate
		time.textContent = Draw.time_string(comment.createDate2)
		
		return [e, e.lastChild]
	}.bind({
		block: 𐀶`
<message-block>
	<message-header>
		<message-username><span class='username pre'></span>:</message-username>
		<time></time>
	</message-header>
	<message-contents></message-contents>
</message-block>`,
		nickname: 𐀶` <span class='real-name-label'>(<span class='pre'></span>)</span>`,
		bridge: 𐀶` <span class='real-name-label'>[discord bridge]</span>`,
		avatar: 𐀶`<img class='avatar' width=100 height=100 alt="">`,
		big_avatar: 𐀶`<div class='bigAvatar'></div>`,
	}),
	
	//📥 comment‹Message›
	//📤 ‹ParentNode›
	message_part: function(comment) {
		let e = this()
		
		if (comment.edited)
			e.className += " edited"
		
		e.dataset.id = comment.id
		e.nonce = comment.createDate2.getTime()
		Markup.convert_lang(comment.text, comment.values.m, e, {intersection_observer: View.observer})
		return e
	}.bind(𐀶`<message-part role=listitem tabindex=-1>`),
	
	//📥 date‹Date›
	//📤 ‹String›
	time_string(date) {
		// time string as something like: (depends on locale)
		// today: "10:37 AM"
		// older: "December 25, 2021, 4:09 PM"
		let options
		if (Date.now()-date.getTime() > 1000*60*60*12)
			options = {year:'numeric', month:'long', day:'numeric', hour:'numeric', minute:'2-digit'}
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
		
		let pg = Draw.content_label(parent, !false)
		outer.prepend(pg)
		
		let inner = outer.lastChild
		
		let list = new MessageList(inner, comment.contentId)
		list.single_message(comment)
		
		let ne = Draw.button2("Load Newer", ev=>{
			// todo: make these buttons part of the message-list class
			list.draw_messages_near(true, 10, (ok)=>{
				if (!ok)
					ev.currentTarget.disabled = true
			})
		})
		
		inner.before(Draw.button2("Load Older", ev=>{
			list.draw_messages_near(false, 10, (ok)=>{
				if (!ok)
					ev.currentTarget.disabled = true
			})
		}))
		
		inner.after(ne)
		
		return outer
	}.bind(𐀶`
<div class='bottomBorder'>
	<message-list></message-list>
</div>
`), // todo: it would be nice to put the older/newer buttons to the left of the message so they dont waste vertical space. or maybe have an initial "load surrounding' button next to the page link?
	
	//todo; like, request_button which disables/enables automatically
	button: function(label, onclick) {
		let e = this()
		e.append(label)
		e.onclick = onclick
		return e
	}.bind(𐀶`<button>`),
	
	// UNUSED
	// <div class='pageInfoPane rem2-3 bar'>
	//   [author box] [vote box]
	// </div>
	page_info(page) {
		let e = document.createElement('div')
		e.className = 'pageInfoPane rem2-3 bar'
		e.append(Draw.author_box(page), vote_box(page))
		return e
	},
	
	// UNUSED
	// [page_edited_time] [entity_title_link]
	// ? [page_edited_time] [entity_title_link]
	// ? [page_edited_time]
	author_box(page) {
		let elem = document.createDocumentFragment()
		if (!page)
			return elem
		elem.append(
			Draw.page_edited_time("Author:", page.createDate2), " ",
			entity_title_link(page.createUser, true)
		)
		if (page.editUserId != page.createUserId) {
			elem.append(
				" ", Draw.page_edited_time("Edited by:", page.lastRevisionDate),
				" ", entity_title_link(page.editUser, true)
			)
		} else if (page.createDate != page.lastRevisionDate) { //edited by same user
			elem.append(" ", Draw.page_edited_time("Edited", page.lastRevisionDate))
		}
		return elem
	},
	
	// UNUSED
	// <span class='item'>
	//   <div class='half half-label'>...</div>
	//   <??? class='... half'>???<???>
	// </span>
	page_edited_time(label, time) {
		let b = document.createElement('span')
		b.className = 'item'
		
		let a = b.child('div', 'half half-label')
		a.textContent = label
		
		a = Draw.time_ago(time)
		b.append(a)
		a.className += " half"
		return b
	},
	
	time_ago: function(time) {
		let e = this()
		e.setAttribute('datetime', time.toISOString())
		e.textContent = Draw.time_ago_string(time)
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
		let row = document.createElement('tr')
		row.dataset.id = id
		// remove button
		if (id) {
			//let b = Draw.button()
			b[1].textContent = "remove"
			b[1].onclick = ()=>{ row.remove() }
			row.child('td').append(b[0])
		} else
			row.child('td')
		// name label
		let name
		if (!id)
			name = Draw.text_item("Default")
		else
			name = entity_title_link(user, true)
		name.className += " bar rem1-5"
		row.child('th').append(name)
		// checkboxes
		for (let p of ['r', 'c', 'u', 'd']) {
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
		let elem = document.createElement('user-select')
		elem.className = 'bar rem1-5'
		let input = elem.child('input', 'item')
		input.placeholder = "Search Username"
		let dropdown = elem.child('select', 'item')
		let placeholder = document.createElement('option')
		placeholder.textContent = "select user..."
		placeholder.disabled = true
		placeholder.hidden = true
		
		let placeholder2 = document.createElement('option')
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
	
	sidebar_comment: function(comment) {
		let d = this()
		d.dataset.id = comment.id
		
		// for bridge messages, display nicknames instead of username
		let author = comment.Author
		let name = author.bridge ? author.nickname+"*" : author.username
		
		d.title = `${name} in ${comment.contentId}:\n${comment.text}`
		// todo: page name 🥺  oh︕ emojis render in italic? don't remember adding that...   we should store refs to pages but like intern them so its not a memory leak...
		
/*todo: fix,		if (comment.editDate && comment.editUserId!=comment.createUserId) {
			d.append(
				entity_title_link(comment.editUser),
				" edited ",
			)
			}*/
		let link = d.firstChild
		link.href = "#user/"+comment.createUserId
		link.firstChild.src = Draw.avatar_url(author)
		link.lastChild.textContent = name
		
		d.append(comment.text.replace(/\n/g, "  "))
		
		return d
	}.bind(𐀶`
<div class='bar rem1-5 sidebarComment ellipsis'>
	<a tabindex=-1>
		<img class='item icon avatar' width=100 height=100>
		<span class='textItem entity-title pre'></span>
	</a>:&#32;
</div>
`),
	
	user_label: function(user) {
		let e = this()
		let link = e.firstChild
		link.href = "#user/"+user.id
		link.firstChild.src = Req.avatar_url(user)
		link.lastChild.textContent = user.username
		return e
	}.bind(𐀶`
<div class='bar rem1-5'>
	<a tabindex=-1>
		<img class='item icon avatar' width=100 height=100>
		<span class='textItem entity-title pre'></span>
	</a>
</div>
`),
})
