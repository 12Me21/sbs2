'use strict'

let AVATAR_SIZE = 100 //50 // 50 was causing issues with jpegs being too low quality, for now.
if (window.devicePixelRatio > 1)
	AVATAR_SIZE = 100

// HTML RENDERING
const Draw = NAMESPACE({
	// TODO: rewrite the css/layout for these
	// also, update the icons for the current site's features
	//📥 content‹Content›
	//📤 ‹ParentNode›
	content_label: function(content, isCategory) {
		// choose icon
		let bg
		if (content.contentType==CODES.file)
			bg = "url("+Req.image_url(content.hash, AVATAR_SIZE, true)+")"
		else if (content.contentType==CODES.userpage)
			bg = 'url(resource/page-userpage.png)'
		else if (content.contentType!=CODES.page)
			bg = 'url(resource/page-unknown.png)'
		else if (content.literalType=='category') {
			if (content.hash==='FAKE') // hack
				bg = 'url(resource/page-fakeparent.png)'
			else
				bg = 'url(resource/page-category.png)'
		} else
			bg = 'url(resource/page-resource.png)'
		// fake category
		if (isCategory && content.literalType!='category')
			bg = "url(resource/overlay-categoryfront.png), " + bg + ", url(resource/overlay-categoryback.png)"
		// non-public
		if (!Entity.has_perm(content.permissions, 0, 'R'))
			bg = "url(resource/hiddenpage.png), " + bg
		// draw
		let e = this()
		let icon = e.firstChild
		icon.style.backgroundImage = bg
		// label
		icon.textContent = content.name2
		return e
	}.bind(𐀶`
<entity-label>
	<span class='icon-title entity-title pre'>...</span>
</entity-label>
`),
	
	// user: User or Author
	avatar_url(user, size=AVATAR_SIZE) {
		if (!user || !user.avatar || user.avatar==="0")
			return "resource/avatar.png"
		return Req.image_url(user.avatar, size, true)
	},
	
	//📥 user‹User›
	//📤 ‹ParentNode›
	avatar: function(user) {
		let e = this()
		e.src = Draw.avatar_url(user)
		e.setAttribute("alt", user.username)
		return e
	}.bind(𐀶`<img class='item avatar' width=50 height=50 alt="">`),
	
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
	
	option(value, label=value) {
		let opt = document.createElement('option')
		opt.value = value
		opt.text = label
		return opt
	},
	
	options(opts, def) {
		let sel = document.createElement('select')
		let found = false
		for (let [val, label=val] of opts) {
			let opt = document.createElement('option')
			if (val == def)
				found = true
			opt.value = val
			opt.text = label
			sel.add(opt)
		}
		if (def!=undefined){ 
			if (!found) {
				let opt = document.createElement('option')
				opt.value = def
				opt.text = def+" ?"
				sel.add(opt)
			}
			sel.value = def
		}
		return sel
	},
	
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
		if (!date) return "When?"
		let t = date.getTime()
		if (t<0 || isNaN(t)) return "Never?"
		let seconds = (Date.now() - t) / 1000
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
	
	user_label: function(user, reverse=false) {
		let e = this()
		e.href = "#user/"+user.id
		e.firstChild.src = Draw.avatar_url(user)
		e.lastChild.textContent = user.username
		if (reverse)
			e.prepend(e.lastChild) // w
		return e
	}.bind(𐀶`
<a tabindex=-1 class='bar rem1-5 user-label'>
	<img class='item avatar' width=50 height=50>
	<span class='entity-title pre'></span>
</a>
`),
	category_item: function(content, user, isCategory=true) {
		const e = this()
		e.firstChild.href = "#category/"+content.id
		const label = Draw.content_label(content, isCategory)
		e.firstChild.append(...label.childNodes) //hack...
		let author = user[~content.createUserId]
		if (author)
			e.lastChild.replaceWith(Draw.user_label(author))
		return e
	}.bind(𐀶`
<a class='bar rem1-5 category-page'></a><span></span>
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



// todo: we should probably disconnect uhh
// - other user's status's display
// - reporting our own status
class StatusDisplay {
	constructor(id, element) {
		this.id = id
		this.$elem = element
		this.my_status = undefined
		this.initial = true
		Object.seal(this)
	}
	redraw() {
		if (!this.$elem)
			return
		let st = this.statuses()
		let ste = Object.entries(st)
		let j = 0
		let chs = [...this.$elem.childNodes]
		//log = "redrawing "+this.id
		for (let i=0; i<chs.length; i++) {
			let stx = ste[j]
			let ch = chs[i]
			let ex_uid = +ch.dataset.uid
			if (j >= ste.length || !(ex_uid >= stx[0])) {
				ch.remove()
				//log = "remove "+ex_uid
			} else {
				if (ex_uid == stx[0]) {
					// now try to update the icon if changed: todo: improve
					let user = StatusDisplay.get_user(stx[0])
					if (ch.dataset.avatar != user.avatar)
						ch.replaceWith(this.draw_avatar(...stx))
					else
						ch.dataset.status = stx[1]
				} else {// ex_uid > stx[0]
					//log = stx[0]+" insert before "+ex_uid
					ch.before(this.draw_avatar(...stx))
					i--
				}
				j++
			}
		}
		for (; j<ste.length; j++) {
			//log = ste[j][0]+" append"
			this.$elem.append(this.draw_avatar(...ste[j]))
		}
		this.initial = false
	}
	draw_avatar(uid, status) {
		//log = "draw avatar "+uid+" in "+this.id
		let user = StatusDisplay.get_user(uid)
		let e = StatusDisplay.draw_avatar(user, status)
		if (this.initial)
			e.dataset.initial = ""
		return e
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
		if (this.statuses[user.id]) {
			//log = 'redraw user?'
			this.redraw()
		}
	}
	// get statuses for this room
	statuses() {
		if (this.id==0)
			return Lp.online
		return Lp.statuses[this.id] || {__proto__:null}
	}
	
	// lookup a user from the cache
	static get_user(id) {
		let user = Lp.users[~id]
		if (!user)
			throw new TypeError("can't find status user "+id)
		return user
	}
	// called during `user_event` (i.e. when a user is edited)
	static update_user(user) {
		if (Lp.users[~user.id])
			Lp.users[~user.id] = user
	}
	// download userlist for this page if we're not already tracking it
	static prepare(pid) {
		if (Lp.statuses[pid])
			return
		Lp.userlist(resp=>{
			if (Lp.statuses[pid])
				return
			Lp.handle_statuses(resp.statuses, resp.objects)
		})
	}
}

StatusDisplay.draw_avatar = function(user, status) {
	let e = this()
	e.href = Nav.entity_link(user)
	e.firstChild.src = Draw.avatar_url(user)
	e.firstChild.title = user.username
	e.firstChild.setAttribute("alt", user.username)
	e.dataset.uid = user.id
	e.dataset.avatar = user.avatar
	e.dataset.status = status
	/*if (status == "idle")
		e.classList.add('status-idle')*/
	return e
}.bind(𐀶`<a tabindex=-1><img class='avatar' width=50 height=50>`)



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
	selected() {
		let tab = this.tabs.find(tab=>tab.btn.getAttribute('aria-selected')=='true')
		return tab ? tab.name : null
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
		if (data.hidden)
			btn.hidden = true
		
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
