'use strict'
//todo: read my old notes (in chat) about how to handle edited messages
// ex: when a message is moved between rooms,

class MessageList {
	constructor(element, pid, edit) {
		this.elem = element
		this.elem.classList.add('message-list') // todo: just create a new elem <message-list> ?
		this.pid = pid
		this.parts = Object.create(null)
		this.total_parts = 0
		this.edit_callback = edit
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
		block.dataset.merge = this.merge_hash(comment)
		let part = Draw.message_part(comment)
		this.parts[comment.id] = part
		this.total_parts = 1
		contents.append(part)
		this.elem.append(block)
	}
	display_message(message, backwards) {
		if (message.deleted) {
			this.remove_message(message.id)
			return null
		}
		let old = this.parts[message.id]
		if (old) {
			let part = Draw.message_part(message)
			old.replaceWith(part)
			this.parts[message.id] = part
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
				let newhash = this.merge_hash(message)
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
			block.dataset.merge = this.merge_hash(message)
			this.elem[backwards?'prepend':'append'](block)
		}
		// draw+insert the new message-part
		let part = Draw.message_part(message)
		contents[backwards?'prepend':'append'](part)
		this.parts[message.id] = part
		this.total_parts++
		return part
	}
	remove_message(id) {
		let part = this.parts[id]
		if (!part)
			return false
		
		let contents = part.parentNode // <message-contents>
		part.remove()
		delete this.parts[id]
		this.total_parts--
		
		if (!contents.hasChildNodes())
			contents.parentNode.remove() // remove <message-block> if empty
		
		return true
	}
	over_limit() {
		return this.total_parts > this.max_parts /*&& !this.disable_limit*/
	}
	limit_messages() {
		for (let id in this.parts) {
			if (this.total_parts <= this.max_parts)
				break
			if (!this.remove_message(id))
				break //fail
		}
	}
	merge_hash(message) {
		let user = message.Author
		return `${message.contentId},${message.createUserId},${user.avatar},${user.bigAvatar||""},${user.username} ${user.nickname || ""}`
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

// todo: when starting to render any page
//- run generatestatus and generatelisteners
//- if changed, refresh long poller with new data
//- when rendering chat, we need to retrieve the listeners list from Req

