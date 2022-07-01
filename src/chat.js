'use strict'
//todo: read my old notes (in chat) about how to handle edited messages
// ex: when a message is moved between rooms,

class MessageList {
	constructor(element, pid, edit) {
		this.elem = element
		this.elem.classList.add('message-list') // todo: just create a new elem <message-list> ?
		this.pid = pid
		this.parts = new Map()
		this.total_parts = 0
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
		if (!block)
			return null
		let content = block.querySelector('message-contents')
		let part = content[newer?'lastChild':'firstChild']
		if (!part)
			return null
		let id = part.x_data.id
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
	display_message(message, backwards) {
		if (message.deleted) {
			this.remove_message(message.id)
			return null
		}
		let old = this.parts.get(message.id)
		if (old) {
			let part = Draw.message_part(message)
			old.elem.replaceWith(part)
			this.parts.set(message.id, {elem:part, data:message})
			return part
		}
		let contents
		// check whether message can be merged
		let block = this.elem[backwards?'firstChild':'lastChild']
		if (block) {
			// if the prev block has message-contents
			let oldcontents = block.querySelector('message-contents')
			if (oldcontents) {
				// and the merge-hashes match
				let oldhash = block.dataset.merge
				let newhash = message.Author.merge_hash
				if (oldhash == newhash) {
					// aand the time isn't > 5 minutes
					let last = oldcontents[backwards?'firstChild':'lastChild']
					if (last) {
						if (!last.x_data) {
							alert("wrong element in message-contents:", last.nodeName)
						} else {
							let oldtime = last.x_data.createDate2
							if (Math.abs(message.createDate2-oldtime) <= 1000*60*5)
								contents = oldcontents
						}
					}
				}
			}
		}
		// otherwise create a new message-block
		if (!contents) {
			;[block, contents] = Draw.message_block(message) // TODO: the time will be wrong, if we are displaying backwards!!
			this.elem[backwards?'prepend':'append'](block)
		}
		// draw+insert the new message-part
		let part = Draw.message_part(message)
		contents[backwards?'prepend':'append'](part)
		this.parts.set(message.id, {elem:part, data:message})
		this.total_parts++
		return part
	}
	remove_message(id) {
		let part = this.parts.pop(id)
		if (!part)
			throw new RangeError("Tried to remove nonexistant message-part, id:"+id)
		
		let contents = part.parentNode // <message-contents>
		part.elem.remove()
		
		if (!contents.hasChildNodes())
			contents.parentNode.remove() // remove <message-block> if empty
	}
	over_limit() {
		return this.parts.size > this.max_parts
	}
	limit_messages() {
		if (this.over_limit())
			for (let id of this.parts.keys()) {
				this.remove_message(id)
				if (!this.over_limit())
					break
			}
	}

	static show_controls(elem) {
		if (elem == this.controls_message)
			return
		if (elem) // this must be the element where .x_data is set
			elem.before(this.controls)
		else
			this.controls.remove()
		this.controls_message = elem
	}
	static onload() {
		this.controls = Draw.message_controls(()=>{
			alert(JSON.stringify(this.controls_message.x_data, null, 1)) // <small heart>
		}, ()=>{
			if (this.controls_message) {
				let ev = new Event('edit_message', {bubbles: true, cancellable: true})
				this.controls_message.dispatchEvent(ev)
			}
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
