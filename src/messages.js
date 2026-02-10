'use strict'

function censorSpoilerText(text) {
	if ("".startsWith.call(text, "\\h"))
		text = text.replace(/^\\h(\[.*?\])?[^]*/, "<spoiler $1>")
	return text
}

class MessageList {
	constructor(element, pid, edit) {
		this.$list = element
		this.$list.classList.add('message-list') // todo: just create a new elem <message-list> ?
		this.pid = pid
		
		this.parts = new Map()
		// `this` is a node in the linked list!
		// top, bottom
		this.next = this.prev = this
		
		// this listens for events created by the message edit/info buttons
		// and modifies the event to add the message data
		this.$list.addEventListener('message_control', ev=>{
			let part = this.parts.get(+ev.target.dataset.id)
			if (part)
				ev.detail.data = part.data // eeehehe
		}, {capture: true})
		
		Object.seal(this)
	}
	
	check_merge(top, bottom) {
		if (top.Author.merge_hash==bottom.Author.merge_hash)
			if (Math.abs(bottom.Author.date.getTime() - top.Author.date.getTime())<=1e3*60*5)
				return true
		return false
	}
	
	remove(part) {
		if (part==this)
			throw new TypeError('tried to remove list terminator')
		let {prev, next, elem, data:{id}} = part
		// remove from map
		this.parts.delete(id)
		// update linked list
		prev.next = next
		next.prev = prev
		// remove element
		if (elem == MessageList.controls_message)
			MessageList.show_controls(null)
		if (elem.nextSibling || elem.previousSibling) {
			elem.remove()
		} else {
			// remove the message block
			elem.parentNode.parentNode.remove()
			// was first or last message block
			if (next==this || prev==this)
				return
			// merge surrounding blocks, if needed
			if (this.check_merge(prev.data, next.data)) {
				let die = next.elem.parentNode
				prev.elem.parentNode.append(...die.childNodes)
				die.parentNode.remove()
			}
		}
	}

	get_reply_message(id) {
		return new Promise((resolve, reject) => {
			const replyMessage = this.parts.get(id)

			if (replyMessage) {
				resolve(replyMessage.data)
				return
			}

			// here's to hoping that it captures the element in the closure during a promise...
			Req.chain({
				values: {
					key: id
				},
				requests: [
					{ type: 'message', fields: '*', query: 'id = @key' },
					{ type: 'user', fields: '*', query: 'id in @message.createUserId' }
				]
			}).do = (resp, err) => {
				if (err) {
					reject(err)
				}
				resolve(resp.message[~id])
			}
		})
	}
	
	// msg: Message being replied to
	// target: reply block link
	draw_reply_block(target, msg=undefined) {
		let [avatar, name, content] = target.children
		
		if (!msg) {
			content.textContent = "Not Available"
			return
		}
		
		target.href = `#comments?ids=${msg.id}`
		avatar.src = Draw.avatar_url(msg.Author)
		const text = censorSpoilerText(msg.text)
		name.textContent = msg.Author.username
		content.textContent = text
	}
	
	// draw a message
	// msg: Message
	// return: Element
	draw_part(msg) {	
		let e = MessageList.part_template()
		e.dataset.id = msg.id
		if (msg.edited)
			e.className += " edited"
		if (msg.module !== null && msg.uidsInText.length > 0)
			msg.LinkedUsers.forEach(user => {
				msg.text = msg.text.replace(new RegExp(`%${user.id}%`, "g"), user.username)
			})
		Markup.convert_lang(msg.text, msg.values.m, e.firstElementChild, {intersection_observer: View.observer})
		if (msg.values.replyingTo) {
			const { replyingTo } = msg.values
			const replyBlock = MessageList.reply_template()
			const replyLink = replyBlock.lastElementChild
			// reply is already chained and linked
			if (msg.Author.reply) {
				this.draw_reply_block(replyLink, msg.Author.reply)
			} else {
				// find existing message
				this.get_reply_message(replyingTo).then((resp) => {
					this.draw_reply_block(replyLink, resp)
				}).catch((err) => {
					console.error(err)
					this.draw_reply_block(replyLink)
				})				
			}
			e.prepend(replyBlock)
		}
		return e
	}
	// draw a message and insert it into the linked list
	// msg: Message
	// prev,next: Part - surrounding list nodes
	add_part(msg, prev, next) {
		let elem = this.draw_part(msg)
		let part = {data:msg, elem, prev, next}
		this.parts.set(msg.id, next.prev = prev.next = part)
		return part
	}
	// display the first message in the list
	display_only(msg) {
		let part = this.add_part(msg, this, this)
		this.$list.append(MessageList.draw_block(msg, part.elem))
		return part
	}
	// display a new message at the top of the list
	display_top(msg) {
		let next = this.next
		let part = this.add_part(msg, this, next)
		if (this.check_merge(part.data, next.data))
			next.elem.before(part.elem) // todo: timestamp
		else
			this.$list.prepend(MessageList.draw_block(msg, part.elem))
		return part
	}
	// display a new message at the bottom of the list
	display_bottom(msg) {
		let prev = this.prev
		let part = this.add_part(msg, prev, this)
		if (this.check_merge(prev.data, part.data))
			prev.elem.after(part.elem)
		else
			this.$list.append(MessageList.draw_block(msg, part.elem))
		return part
	}
	
	// `relative`: the message to display the message `msg` around
	// `where`: where around the message? either 'before'/'after'
	display_around(relative, msg, where = 'before') {
		const [prev, next] = where == 'before'
			? [relative.prev, relative]
			: [relative, relative.next]
		// know: `where` doesn't matter anymore
		
		if (next == this) return this.display_bottom(msg)
		if (prev == this) return this.display_top(msg)
		// know: the [prev/next]s are not the ends, so they'll have `elem`s
		
		const same_block = prev.elem.parentNode == next.elem.parentNode
		
		const part = this.add_part(msg, prev, next)
		if (this.check_merge(msg, next.data)) {
			// print('new message part can be part of next message block')
			next.elem.before(part.elem)
			return part
		}
		
		if (this.check_merge(prev.data, msg)) {
			// print('new message part can be part of prev message block')
			prev.elem.after(part.elem)
			return part
		}
		
		const next_block = next.elem.parentNode.parentNode
		// Are `prev` and `next` effectively in separate message blocks?
		// (Can't use `prev.elem` in the expr because it might be null)
		if (!same_block) {
			// print('cannot merge with either, so create a new block before next message block')
			next_block.before(MessageList.draw_block(msg, part.elem))
		} else {
			// print('splice (create a block inside an existing block, splitting it into two)...')
			const block_containing_msg = MessageList.draw_block(msg, part.elem)
			const parts = Array.from(next.elem.parentNode.children)
			const next_index = parts.indexOf(next.elem)
			next_block.after(block_containing_msg)
			const splice_block = MessageList.draw_block(next.data)
			block_containing_msg.after(splice_block)
			Element.prototype.append.apply(splice_block.lastChild, parts.splice(next_index))
		}
		
		return part
	}
	
	// existing: Part - the part to replace
	// msg: Message - the new message data
	replace(existing, msg) {
		if (existing==this)
			throw new TypeError('tried to replace list terminator')
		let id = msg.id
		// deleted from this room
		if (msg.deleted) {
			this.remove(existing)
			return null
		}
		// moved to other room
		if (msg.contentId!=this.pid) { 
			if (!msg.edited)
				print("warning: impossible? ", id)
			this.remove(existing)
			return null
		}
		// normal edited message?
		if (!msg.edited)
			print("warning: duplicate message ", id)
		// fancy edited message?
		if (msg.Author.merge_hash != existing.data.Author.merge_hash) {
			let next = existing.next
			this.remove(existing)
			return this.display_around(next, msg, 'before')
		}
		let elem = this.draw_part(msg)
		existing.elem.replaceWith(elem)
		existing.elem = elem
		existing.data = msg
		return existing
	}
	
	// display a Message at the bottom of the list
	// ONLY use this for messages from live message_events
	// if cb is set, it will be called before a message is inserted
	// return: (todo improve this. rn we only use it for updating the title notif.)
	// true - new message added at bottom
	// false - replaced/removed an edited/deleted/rethreaded message
	// null - nothing
	display_live(msg, cb=null) {
		let id = msg.id
		
		let existing = this.parts.get(id)
		if (existing) {
			cb && cb()
			this.replace(existing, msg)
			return false
		}
		
		// deleted, or for another room
		if (msg.deleted || msg.contentId!=this.pid)
			return null
		
		let prev = this.prev
		if (prev==this) {
			cb && cb()
			// note: if message is edited, this isn't really safe
			// because it could be an old edited message
			// but, in practice, this only happens if the page
			// has no messages at all, because otherwise
			// we would've loaded initial messages
			/// but technically, we should check against the page's
			// lastmessageid, if we /aren't/ loading initial messages
			// to make sure the edited message is new message.
			this.display_only(msg)
			return true
		}
		if (id>prev.data.id) {
			cb && cb()
			this.display_bottom(msg)
			return true
		}
		
		if (!msg.edited)
			print("warning: out of order: ", id)
		
		// old message
		if (id < this.next.data.id)
			return null
		
		// rethreaded from another room
		this.rethread(msg)
		return false
	}
	
	// display a Message at the top or bottom of the list
	display_edge(msg) {
		let id = msg.id
		
		let existing = this.parts.get(id)
		if (existing) {
			print('warning: duplicate message? '+id)
			return this.replace(existing, msg)
		}
		
		if (this.next==this)
			return this.display_only(msg)
		if (id>this.prev.data.id)
			return this.display_bottom(msg)
		if (id<this.next.data.id)
			return this.display_top(msg)
		
		throw new Error("messages out of order?")
	}
	
	// todo
	// need to prevent this from loading messages multiple times at once
	// and inserting out of order...x
	load_messages_near(top, amount, callback) {
		let part = top ? this.next : this.prev
		if (part==this)
			return
		let id = part.data.id
		//
		let order = top ? 'id_desc' : 'id'
		let query = `contentId = @pid AND id ${top?"<":">"} @last AND !notdeleted()`
		Lp.chain({
			values: {last: id, pid: this.pid},
			requests: [
				{type:'message', fields:'*', query, order, limit:amount},
				{name:'replies', type:'message', fields:'*', query:'id in @message.values.replyingTo'},
				{type:'user', fields:'*', query:"id in @message.createUserId OR id IN @replies.createUserId"},
			],
		}, resp=>{
			let first = true
			for (let c of resp.message) {
				let part = this.display_edge(c)
				if (part && first) {
					part.elem.classList.add("boundary-"+(top?"bottom":"top"))
					first = false
				}
			}
			callback(resp.message.length != 0)
		})
	}
	// limiting number of displayed messages
	over_limit() {
		return this.parts.length > this.max_parts
	}
	limit_messages() {
		let over = this.parts.length - this.max_parts
		for (let i=0; i<over; i++)
			this.remove(this.next)
	}
	
	rethread(msg) {
		let pivot = this.prev
		while (pivot != this && pivot.data.id > msg.id) pivot = pivot.prev
		return this.display_around(pivot, msg, 'after')
	}

	// elem: <message-part> or null
	static show_controls(elem) {
		if (elem == this.controls_message) // shouldn't happen?
			return
		if (elem) {
			elem.before(this.controls)
		} else
			this.controls.remove()
		this.controls_message = elem
		// pick them
		if (elem) {
			let block = elem.closest("message-block")
			let me = block && +block.dataset.uid == Req.uid
			this.control_buttons.reply.hidden = me
			this.control_buttons.edit.hidden = !me
		}
	}
	static send_mce(action, data, target) {
		let ev2 = new CustomEvent('message_control', {
			bubbles: true, cancellable: true,
			detail: {data, action},
		})
		target.dispatchEvent(ev2)
	}
	static init() {
		// draw the message controls
		this.controls = document.createElement('message-controls')
		this.control_buttons = {__proto__:null}
		// draw the things
		// yeah
		let btn = (action, label)=>{
			let btn = document.createElement('button')
			btn.onclick = ev=>{ this.send_mce(action, null, this.controls_message) }
			btn.dataset.action = action
			btn.tabIndex=-1
			btn.append(label)
			this.controls.append(btn)
			this.control_buttons[action] = btn
		}
		btn('info', "🗺️")
		btn('edit', "✏️")
		btn('reply', "⤴️")
		
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
		let enter = ev=>{
			let elem = ev.target.closest("message-part, message-controls, .message-list")
			if (!elem || elem.classList.contains('message-list'))
				this.show_controls(null)
			else if (elem.tagName=='MESSAGE-PART')
				this.show_controls(elem)
			// otherwise, the element is <message-controls> so we do nothing
		}
		
		if (IOS_SAFARI) {
			listen('click', enter)
			listen('touchstart', ev=>{
				if (!this.controls_message)
					return
				if (this.controls.contains(ev.target))
					return
				if (this.controls_message.contains(ev.target))
					;//return
				this.show_controls(null)
			})
		} else {
			listen('mouseover', enter)
			listen('mouseleave', ev=>{ this.show_controls(null) })
		}
	}
}
MessageList.part_template = 𐀶`<message-part role=listitem><div></div></message-part>`
MessageList.reply_template = 𐀶`
<reply-block class='bar ellipsis'>
⤴️ <b>Reply to</b>&#32;
<a>
<img class='item avatar'> <span class='entity-title pre'></span>: <span>Loading...</span>
</a>
</reply-block>
`
MessageList.controls = null
MessageList.controls_message = null
MessageList.prototype.max_parts = 500
MessageList.draw_block = function(comment, part) {
	let e = this.block()
	
	let author = comment.Author
	const module = comment.module
	
	e.dataset.uid = comment.createUserId
	if (module === null) {
		/** @type {HTMLImageElement} */	
		const avatar = this.avatar()
		e.prepend(avatar)
		avatar.src = Draw.avatar_url(author)
	
		if (author.bigAvatar) {
			avatar.className = "bigAvatar"
			// for now we don't support both
		} else {
			if (author.avatar_pixel) {
				avatar.classList.add("apx")
				if (Settings.values.pixel_art=='on') {
					// TODO: what if setting is turned off while image is loading?
					if (avatar.naturalWidth) {
						recalc_image_scale(avatar)
					} else {
						avatar.decode().then(ok=>{
							recalc_image_scale(avatar)
						})
					}
				}
			}
		}
	} else {
		e.classList.add("module")
		const module_name = this.module_name()
		module_name.textContent = comment.module
		e.prepend(module_name)
	}
	
	let header = e.firstChild.nextSibling
	
	let name = header.firstChild
	if (module !== null) {
		name.firstChild.textContent = module
		name.firstChild.classList.add('module-name')
		const module_elem = this.module()
		const module_avatar = module_elem.lastChild.firstElementChild
		const module_user = module_elem.lastChild.lastElementChild
		module_avatar.src = Draw.avatar_url(author)
		module_user.textContent = author.username
		name.appendChild(module_elem)
	} else if (author.nickname == null) {
		name.firstChild.textContent = author.username
	} else {
		name.firstChild.textContent = author.nickname
		if (author.bridge)
			name.appendChild(this.bridge())
		else {
			let nickname = this.nickname()
			let realname = nickname.lastChild.lastElementChild
			realname.textContent = author.username
			name.appendChild(nickname)
		}
	}
	
	let time = header.lastChild
	//time.dateTime = comment.createDate
	time.textContent = "\t­\t"+Draw.time_string(comment.Author.date)
	
	if (part) e.lastChild.appendChild(part)
	
	return e
}.bind({
	block: 𐀶`
<message-block>
	<message-header>
		<span><b class='pre'></b>:</span>
		<span role=time></span>
	</message-header>
	<div></div>
</message-block>`,
	nickname: 𐀶` <i>(<span class='pre'></span>)</i>`,
	bridge: 𐀶` <i>[discord bridge]</i>`,
	module: 𐀶` <i><img class='avatar module-avatar' width=50 height=50> <span class='pre'></span></i>`,
	avatar: 𐀶`<img class='avatar' width=50 height=50 alt="----">`,
	module_name: 𐀶`<span class='module-name'></span>`,
})

MessageList.init()
Object.seal(MessageList)

// fallback message_control handler, if events arent handled by the View
document.addEventListener('message_control', ev=>{
	if (ev.detail.action=='info' || ev.detail.action=='raw')
		alert(JSON.stringify(ev.detail.data, null, 1)) // <small heart>
	if (ev.detail.action=='link') {
		navigator.clipboard.writeText(`sbs:comments?ids=${ev.detail.data.id}`)
		print("copied link")
	}
})
