'use strict'
//todo: read my old notes (in chat) about how to handle edited messages
// ex: when a message is moved between rooms,
// kinda annoying, basically what we need to do is
// if we get an edited message: check every room to see if it has
// that message id, since it mightve been moved /from/ that room
// then, we need to insert that message in the middle of the list, in the current room

class MessageList {
	constructor(element, pid, edit) {
		this.$list = element
		this.$list.classList.add('message-list') // todo: just create a new elem <message-list> ?
		this.pid = pid
		
		this.parts = new Map()
		this.first = this.last = null
		
		// this listens for events created by the message edit/info buttons
		// and modifies the event to add the message data
		this.$list.addEventListener('message_control', ev=>{
			let data = this.parts.get(+ev.target.dataset.id).data
			ev.detail.data = data // eeehehe
		}, {capture: true})
		
		Object.seal(this)
	}
	
	check_merge(message, before) {
		if (before.Author.merge_hash==message.Author.merge_hash)
			if (Math.abs(message.Author.date.getTime() - before.Author.date.getTime())<=1e3*60*5)
				return true
		return false
	}
	
	remove(id, part=this.parts.get(id)) {
		// remove from map
		this.parts.set(id, null)
		// update linked list
		if (part.prev)
			part.prev.next = part.next
		else if (part==this.first)
			this.first = part.next // hm what if we renamed this.prev to this.next, then just `(part.prev||this).next = part.next` lol.. hm actually that would make this a kind of   circular linked list? where the MessageList fills in the gap...
		else
			throw new TypeError("broken linked list!")
		if (part.next)
			part.next.prev = part.prev
		else if (part==this.last)
			this.last = part.prev
		else
			throw new TypeError("broken linked list!")
		// remove element
		let elem = part.elem
		if (elem.nextSibling || elem.previousSibling)
			elem.remove()
		else // remove the message block
			elem.parentNode.parentNode.remove()
	}
	
	display_only(msg) {
		let elem = this.draw_part(msg)
		let node = {data:msg, elem, prev:null, next:null}
		this.parts.set(msg.id, this.first = this.last = node)
		this.$list.append(MessageList.draw_block(msg, elem))
		return node
	}
	display_first(msg, next=this.first) {
		let elem = this.draw_part(msg)
		let node = {data:msg, elem, prev:null, next}
		this.parts.set(msg.id, this.first = next.prev = node)
		if (this.check_merge(next.data, msg))
			next.elem.before(elem) // todo: timestamp
		else
			this.$list.prepend(MessageList.draw_block(msg, elem))
		return node
	}
	display_last(msg, prev=this.last) {
		let elem = this.draw_part(msg)
		let node = {data:msg, elem, prev, next:null}
		this.parts.set(msg.id, this.last = prev.next = node)
		if (this.check_merge(msg, prev.data))
			prev.elem.after(elem)
		else
			this.$list.append(MessageList.draw_block(msg, elem))
		return node
	}
	
	replace_existing(msg, existing=this.parts.get(msg.id)) {
		let id = msg.id
		// deleted from this room
		if (msg.deleted) {
			this.remove(id, existing)
			return null
		}
		// moved to other room
		if (msg.contentId!=this.pid) { 
			if (!msg.edited)
				print("warning: impossible? ", id)
			this.remove(id, existing)
			return null
		}
		// normal edited message?
		if (!msg.edited)
			print("warning: duplicate message ", id)
		if (msg.Author.merge_hash != existing.data.Author.merge_hash)
			print("unimplemented: merge hash changed: ", id)
		let elem = this.draw_part(msg)
		existing.elem.replaceWith(elem)
		existing.elem = elem
		existing.data = msg
		return existing
	}
	
	display_live(msg, cb=null) {
		let id = msg.id
		
		let existing = this.parts.get(id)
		if (existing) {
			cb && cb()
			return this.replace_existing(msg, existing)
		}
		
		// deleted, or for another room
		if (msg.deleted || msg.contentId!=this.pid)
			return null
		
		let prev = this.last
		if (!prev) {
			cb && cb()
			return this.display_only(msg)
		}
		if (id>prev.data.id) {
			cb && cb()
			return this.display_last(msg, prev)
		}
		
		if (!msg.edited)
			print("warning: out of order: ", id)
		
		// old message
		if (id < first.data.id)
			return null
		
		// rethreaded from another room
		print("unimplemented: rethread ", id)
		//this.rethread(msg)
	}
	
	display_edge(msg, top=false) {
		let id = msg.id
		
		let existing = this.parts.get(id)
		if (existing) {
			print('warning: duplicate message? '+id)
			return this.replace_existing(msg, existing)
		}
		
		let next = top ? this.first : this.last
		if (!next)
			return this.display_only(msg)
		if (top) {
			if (id<next.data.id)
				return this.display_first(msg, next)
		} else // owo
			if (id>next.data.id)
				return this.display_last(msg, next)
		
		throw new Error("messages out of order?")
	}
	
	// todo
	// need to prevent this from loading messages multiple times at once
	// and inserting out of order...x
	load_messages_near(top, amount, callback) {
		let node = top ? this.first : this.last
		if (!node)
			return
		let id = node.data.id
		//
		let order = top ? 'id_desc' : 'id'
		let query = `contentId = @pid AND id ${newer?">":"<"} @last AND !notdeleted()`
		Lp.chain({
			values: {last: id, pid: this.pid},
			requests: [
				{type:'message', fields:'*', query, order, limit:amount},
				{type:'user', fields:'*', query:"id in @message.createUserId"},
			],
		}, resp=>{
			let first = true
			for (let c of resp.message) {
				let part = this.display_edge(c, !newer)
				if (part && first) {
					part.elem.classList.add("boundary-"+(newer?"top":"bottom"))
					first = false
				}
			}
			callback(resp.message.length != 0)
		})
	}
	
	over_limit() {
		return this.parts.length > this.max_parts
	}
	limit_messages() {
		let over = this.parts.length - this.max_parts
		for (let i=0; i<over; i++)
			this.remove(this.last.data.id, this.last)
	}
	draw_part(comment) {	
		let e = MessageList.part_template()
		
		if (comment.edited)
			e.className += " edited"
		
		e.dataset.id = comment.id
		Markup.convert_lang(comment.text, comment.values.m, e, {intersection_observer: View.observer})
		return e
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
	
	static init() {
		// draw the message controls
		this.controls = document.createElement('message-controls')
		// draw the things
		let handler = ev=>{
			let action = ev.currentTarget.dataset.action
			let ev2 = new CustomEvent('message_control', {
				bubbles: true, cancellable: true,
				detail: {data: null, action},
			})
			this.controls_message.dispatchEvent(ev2)
		}
		// yeah
		let btn = (action, label)=>{
			let btn = document.createElement('button')
			btn.onclick = handler
			btn.dataset.action = action
			btn.tabIndex=-1
			btn.append(label)
			this.controls.append(btn)
		}
		btn('info', "⚙️")
		btn('edit', "✏️")
		
		let listen = (ev, fn)=>{
			document.addEventListener(ev, fn, {passive: true})
		}
		
		// todo: fix this so focusing shows controls again.
		// the issue is that clicking the buttons can alter focus
		// and on mobile, there are other issues too
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
		
		// show controls when hovering over a <message-part>
		
		// This works on mobile, because touches trigger mouseover.
		// the touch creates a virtual cursor which stays there,
		// until you touch somewhere else (which then triggers mouseleave)
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
MessageList.part_template = 𐀶`<message-part role=listitem tabindex=-1>`
MessageList.controls = null
MessageList.controls_message = null
MessageList.prototype.max_parts = 500
MessageList.draw_block = function(comment, part) {
	let e = this.block()
	
	let author = comment.Author
	
	e.dataset.uid = comment.createUserId
	
	let avatar = e.firstChild
	avatar.src = Draw.avatar_url(author)
	if (author.bigAvatar)
		avatar.className = "bigAvatar"
	
	let header = avatar.nextSibling
	
	let name = header.firstChild
	if (author.nickname == null) {
		name.firstChild.textContent = author.username
	} else {
		name.firstChild.textContent = author.nickname
		if (author.bridge)
			name.appendChild(this.bridge())
		else {
			let nickname = this.nickname()
			nickname.querySelector('span.pre').textContent = author.username
			name.appendChild(nickname)
		}
	}
	
	let time = header.lastChild
	time.dateTime = comment.createDate
	time.textContent = Draw.time_string(comment.Author.date)
	
	e.lastChild.appendChild(part)
	
	return e
}.bind({
	block: 𐀶`
<message-block>
	<img class='avatar' width=100 height=100 alt="">
	<message-header>
		<message-username><span class='username pre'></span>:</message-username>
		<time></time>
	</message-header>
	<message-contents></message-contents>
</message-block>`,
	nickname: 𐀶` <span class='real-name-label'>(<span class='pre'></span>)</span>`,
	bridge: 𐀶` <span class='real-name-label'>[discord bridge]</span>`,
})

MessageList.init()
Object.seal(MessageList)

document.addEventListener('message_control', e=>{
	if (e.detail.action=='info')
		alert(JSON.stringify(e.detail.data, null, 1)) // <small heart>
})
