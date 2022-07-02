'use strict'
//todo: read my old notes (in chat) about how to handle edited messages
// ex: when a message is moved between rooms,

document.addEventListener('message_control', e=>{
	if (e.detail.action=='info')
		alert(JSON.stringify(e.detail.data, null, 1)) // <small heart>
})

class MessageList {
	constructor(element, pid, edit) {
		this.elem = element
		this.elem.classList.add('message-list') // todo: just create a new elem <message-list> ?
		this.pid = pid
		this.parts = new Map()
		
		// this listens for events created by the message edit/info buttons
		// and modifies the event to add the message data
		this.elem.addEventListener('message_control', e=>{
			let data = this.part_data(e.target)
			e.detail.data = data // eeehehe
		}, {capture: true})
	}
	get_messages_near(last, newer, amount, callback) {
		let order = newer ? 'id' : 'id_desc'
		let query = `contentId = @pid AND id ${newer?">":"<"} @last`
		Lp.chain({
			values: {last: last, pid: this.pid},
			requests: [
				{type:'message', fields:'*', query, order, limit:amount},
				{type:'user', fields:'*', query:"id in @message.createUserId"},
			],
		}, callback)
	}
	// todo
	// need to prevent this from loading messages multiple times at once
	// and inserting out of order...x
	draw_messages_near(newer, amount, callback) {
		let block = this.elem[newer?'lastChild':'firstChild']
		if (!block || block.tagName!='MESSAGE-BLOCK')
			return null
		let content = block.querySelector('message-contents')
		let part = content[newer?'lastChild':'firstChild']
		if (!part)
			return null
		let id = +part.dataset.id
		return this.get_messages_near(id, newer, amount, resp=>{
			let first = true
			for (let c of resp.message) {
				let part = this.display_message(c, !newer)
				if (part && first) {
					part.className += " boundary-"+(newer?"top":"bottom")
					first = false
				}
			}
			callback(resp.message.length != 0)
		})
	}
	single_message(comment) {
		let [block, contents] = Draw.message_block(comment)
		let part = Draw.message_part(comment)
		this.parts.set(comment.id, {elem:part, data:comment})
		this.total_parts = 1
		contents.append(part)
		this.elem.append(block)
	}
	//optimize: createDate can really just like,
	// well ok let's put it in Author, and store it as milliseconds
	// that way we dont keep parsing createDate strings
	get_merge(message, backwards) {
		// check if there's a message-block we can merge with
		let block = this.elem[backwards?'firstChild':'lastChild']
		if (block && block.nonce==message.Author.merge_hash) {
			let contents = block.lastChild
			// see if there's a message-part within 5 minutes of new one
			let last = contents[backwards?'firstElementChild':'lastElementChild']
			// <message-controls> might be before the <message-part>
			if (backwards && last==MessageList.controls)
				last = last.nextElementSibling
			if (last && Math.abs(message.createDate2-last.nonce)<=1e3*60*5)
				return contents
		}
		return null
	}
	display_message(message, backwards) {
		if (message.deleted) {
			if (this.parts.has(message.id))
				this.remove_message(message.id)
			return null
		}
		// create new part
		let part = Draw.message_part(message)
		let old = this.parts.get(message.id)
		this.parts.set(message.id, {elem:part, data:message})
		// edited version of an existing message-part
		if (old) {
			old.elem.replaceWith(part)
			return part
		}
		// new message-part
		// try to find a message-block to merge with
		let contents = this.get_merge(message, backwards)
		if (!contents) {
			let block
			;[block, contents] = Draw.message_block(message)
			// TODO: the displayed time will be wrong, if we are going backwards!!
			this.elem[backwards?'prepend':'appendChild'](block)
		}
		contents[backwards?'prepend':'appendChild'](part)
		return part
	}
	remove_message(id) {
		let part = this.parts.pop(id)
		if (!part)
			throw new RangeError("Tried to remove nonexistant message-part, id:"+id)
		
		// remove edit buttons if they're on this message
		if (part == MessageList.controls_message)
			MessageList.show_controls(null)
		let contents = part.elem.parentNode // <message-contents>
		part.elem.remove()
		
		if (!contents.hasChildNodes())
			contents.parentNode.remove() // remove <message-block> if empty
	}
	over_limit() {
		return this.parts.size > this.max_parts
	}
	limit_messages() {
		if (this.over_limit())
			for (let id of [...this.parts.keys()].sort()) {
				this.remove_message(id)
				if (!this.over_limit())
					break
			}
	}
	part_data(elem) {
		return this.parts.get(+elem.dataset.id).data
	}
	
	// elem: <message-part> or null
	static show_controls(elem) {
		if (elem == this.controls_message) // shouldn't happen?
			return
		if (elem)
			elem.before(this.controls)
		else
			this.controls.remove()
		this.controls_message = elem
	}
	static onload() {
		this.controls = Draw.message_controls((e, action)=>{
			let ev = new CustomEvent('message_control', {bubbles: true, cancellable: true, detail:{data: null, action}})
			this.controls_message.dispatchEvent(ev)
		}).elem
		
		let listen = (ev, fn)=>{
			document.body.addEventListener(ev, fn, {passive: true})
		}
		
		/*listen('focusin', e=>{
		  let elem = e.target.closest("message-part, .message-list")
		  if (!elem)
		  this.show_controls(null)
		  else if (elem.tagName=='MESSAGE-PART')
		  this.show_controls(elem)
		  })
		  listen('focusout', e=>{
		  //if (e.target.closest(".message-list"))
		  // TODO: fix flickering when button is clicked
		  this.show_controls(null)
		  })*/
		
		// todo: check out relatedTarget?
		// TODO: this causes problems on mobile when clicking images/links etc.
		// probably need to like
		// replace this handler's event with one that doesn't capture touches
		// and then add a separate touchstart etc. handler which doesnt accept click and etc. maybe we need to cancel click (or check if it's been handled?) somewhere somehow beforehand
		listen('mouseover', e=>{
			let elem = e.target.closest("message-part, message-controls, .message-list")
			if (!elem || elem.classList.contains('message-list'))
				this.show_controls(null)
			else if (elem.tagName=='MESSAGE-PART')
				this.show_controls(elem)
			// otherwise, the element is <message-controls> so we do nothing
		})
		listen('mouseleave', e=>{
			this.show_controls(null)
		})
	}
}
MessageList.controls = null
MessageList.controls_message = null
MessageList.prototype.max_parts = 500

Object.seal(MessageList)



class StatusDisplay {
	constructor(id, element) {
		this.id = id
		this.$elem = element
		this.my_status = undefined
	}
	redraw() {
		this.$elem.fill()
		Object.for(this.statuses(), (status, id)=>{
			let user = StatusDisplay.get_user(id)
			this.$elem.append(Draw.userlist_avatar(user, status))
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
		// TODO: this is a hack .. we need a way to send signals to pages to tell them to redraw userlists.
		this.global.redraw()
		Object.for(PageView.rooms, room=>room.userlist.redraw())
	}
	// called during `user_event` (i.e. when a user is edited)
	static update_user(user) {
		// if we don't need this avatar,
		if (!this.users[~user.id])
			return
		this.users[~user.id] = user
		this.global.redraw_user(user)
		Object.for(PageView.rooms, room=>room.userlist.redraw_user(user))
	}
}
StatusDisplay.statuses = {__proto__:null}
// todo: this is never cleared, so technically it leaks memory.
// but unless there are thousands of users, it won't matter
StatusDisplay.users = {__proto__:null}
StatusDisplay.global = new StatusDisplay(0, null)
do_when_ready(()=>{
	StatusDisplay.global.$elem = $sidebarUserList
})
