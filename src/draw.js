'use strict'
// HTML RENDERING
const Draw = NAMESPACE({
	// TODO: rewrite the css/layout for these
	// also, update the icons for the current site's features
	//📥 content‹Content›
	//📤 ‹ParentNode›
	content_label: function(content, link) {
		let e = this()
		// choose icon
		let hidden = !Entity.has_perm(content.permissions, 0, 'R')
		let bg
		if (content.contentType==CODES.file) {
			bg = Req.file_url(content.hash, "size=100&crop=true")
		} else if (content.contentType!=CODES.page)
			bg = 'resource/unknownpage.png'
		else if (content.literalType=='category')
			bg = 'resource/category.png'
		else if (hidden)
			bg = 'resource/hiddenpage.png'
		else
			bg = 'resource/page-resource.png'
		let icon = e.firstChild
		icon.style.backgroundImage = `url("${bg}")`
		// label
		e.lastChild.textContent = content.name2
		
		return e
	}.bind(𐀶`
<entity-label>
	<span class='item icon iconBg' role=img alt=""></span>
	<span class='textItem entity-title pre'>...</span>
</entity-label>
`),
	
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
	
	button: function(label, onclick) {
		let e = this()
		e.append(label)
		e.onclick = onclick
		return e
	}.bind(𐀶`<button>`),
	
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
	
	user_label: function(user) {
		let e = this()
		e.href = "#user/"+user.id
		e.firstChild.src = Draw.avatar_url(user)
		e.lastChild.textContent = user.username
		return e
	}.bind(𐀶`
<a tabindex=-1 class='bar rem1-5 user-label'>
	<img class='item icon avatar' width=100 height=100>
	<span class='textItem entity-title pre'></span>
</a>
`),
	
	// opt: todo: what if instead of passing the func to the callback
	// we just pass elem and let the user run elem.disabled=false?
	event_lock(callback) {
		return ev=>{
			let elem = ev.currentTarget
			if (elem.disabled) return
			elem.disabled = true
			callback(()=>{elem.disabled = false}, elem)
		}
	}
})



class StatusDisplay {
	constructor(id, element) {
		this.id = id
		this.$elem = element
		this.my_status = undefined
		Object.seal(this)
	}
	redraw() {
		if (!this.$elem)
			return
		this.$elem.fill()
		Object.for(this.statuses(), (status, id)=>{
			let user = StatusDisplay.get_user(id)
			this.$elem.append(StatusDisplay.draw_avatar(user, status))
		})
	}
	// set your own status
	set_status(s) {
		// todo: maybe there's a better place to filter this
		if (s==this.my_status)
			return
		this.my_status = s
		Lp.set_status(this.id, s)
	}
	// when a user's avatar etc. changes
	redraw_user(user) {
		if (this.statuses[user.id])
			this.redraw()
	}
	// get statuses for this room
	statuses() {
		return StatusDisplay.statuses[this.id] || {__proto__:null}
	}
	
	// lookup a user from the cache
	static get_user(id) {
		let user = this.users[~id]
		if (!user)
			throw new TypeError("can't find status user "+id)
		return user
	}
	// called during `userlistupdate`
	static update(statuses, objects) {
		Object.assign(this.statuses, statuses)
		Object.assign(this.users, objects.user)
		//
		let li = Events.userlist
		Object.for(statuses, (st, pid)=>{
			li.fire_id(pid, st)
		})
	}
	// called during `user_event` (i.e. when a user is edited)
	static update_user(user) {
		if (this.users[~user.id])
			this.users[~user.id] = user
	}
	// download userlist for this page if we're not already tracking it
	static prepare(pid) {
		if (this.statuses[pid])
			return
		Lp.userlist(resp=>{
			if (this.statuses[pid])
				return
			this.update(resp.statuses, resp.objects)
		})
	}
}
// map(contentId -> map(userId -> status))
StatusDisplay.statuses = {__proto__:null}
// todo: this is never cleared, so technically it leaks memory.
// but unless there are thousands of users, it won't matter
// map(userId -> user)
StatusDisplay.users = {__proto__:null}

StatusDisplay.draw_avatar = function(user, status) {
	let e = this()
	e.href = Nav.entity_link(user)
	e.firstChild.src = Draw.avatar_url(user)
	e.firstChild.title = user.username
	e.dataset.uid = user.id
	if (status == "idle")
		e.classList.add('status-idle')
	return e
}.bind(𐀶`<a tabindex=-1><img class='avatar' width=100 height=100 alt="[fuck]">`)



class ResizeBar {
	constructor(element, tab, side, save=null, def=null) {
		this.$elem = element
		this.$handle = tab
		this.horiz = side=='left'||side=='right'
		this.dir = side=='top'||side=='left' ? 1 : -1
		this.save = save
		
		this.start_pos = null
		this.start_size = null
		this.size = null
		
		let down = ev=>this.start(ev)
		tab.addEventListener('mousedown', down)
		tab.addEventListener('touchstart', down)
		
		if (this.save) {
			let s = localStorage.getItem(this.save)
			if (s)
				def = +s
		}
		if (def!=null)
			this.update_size(def)
		
		Object.seal(this)
	}
	event_pos(ev) {
		if (ev.touches)
			return ev.touches[0][this.horiz?'pageX':'pageY']
		return ev[this.horiz?'clientX':'clientY']
	}
	start(ev) {
		let target = ev.target
		if (target instanceof Text)
			target = target.parentNode
		if (target!==this.$handle)
			return
		ev.preventDefault()
		ResizeBar.grab(this)
		this.$handle.dataset.dragging = ""
		this.start_pos = this.event_pos(ev)
		this.start_size = this.$elem.getBoundingClientRect()[this.horiz?'width':'height']
	}
	move(ev) {
		let v = (this.event_pos(ev) - this.start_pos) * this.dir
		this.update_size(this.start_size + v)
	}
	finish(ev) {
		delete this.$handle.dataset.dragging
		if (this.save && this.size!=null)
			localStorage.setItem(this.save, this.size)
	}
	update_size(px) {
		this.size = Math.max(px, 0)
		this.$elem.style[this.horiz?'width':'height'] = this.size+"px"
	}
	
	static grab(bar) {
		this.current && this.current.finish(null)
		this.current = bar
	}
	static move(ev) {
		this.current && this.current.move(ev)
	}
	static init() {
		this.current = null
		let up = ev=>this.grab(null)
		document.addEventListener('mouseup', up, {passive:true})
		document.addEventListener('touchend', up, {passive:true})
		let move = ev=>this.move(ev)
		document.addEventListener('mousemove', move, {passive:true})
		document.addEventListener('touchmove', move, {passive:true})
	}
}
ResizeBar.init()



let button_template = 𐀶`<button role=tab aria-selected=false>`

class Tabs {
	constructor(def, elem=document.createElement('tab-list'), name=Tabs.id++) {
		this.tabs = []
		this.$elem = elem
		this.name = name
		
		this.$elem.setAttribute('role', 'tablist')
		for (let data of def)
			this.add(data)
	}
	select(name) {
		let tab = this.tabs.find(tab=>tab.name==name)
		if (tab)
			switch_tab(tab.btn, true)
	}
	add(data) {
		this.tabs.push(data)
		
		let panel = data.panel
		if (!panel.id)
			panel.id = this.name+"-panel-"+data.name
		
		let btn = data.btn = button_template()
		this.$elem.append(btn)
		
		btn.id = this.name+"-tab-"+data.name
		btn.setAttribute('aria-controls', panel.id)
		btn.tabIndex = -1
		btn.dataset.name = data.name
		btn.onclick = ev=>{
			switch_tab(btn)
			data.onswitch && data.onswitch() // todo: make this an event listener or something on panel instead
		}
		if (data.shadow)
			btn.classList.add('text-shadow')
		btn.append(data.label)
		if (data.accesskey)
			btn.accessKey = data.accesskey
		
		panel.setAttribute('role', "tabpanel")
		panel.setAttribute('aria-labelledby', btn.id)
	}
}
Tabs.id = 1
