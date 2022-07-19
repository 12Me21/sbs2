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
		//this.first_id = Infinity
		
		// this listens for events created by the message edit/info buttons
		// and modifies the event to add the message data
		this.$list.addEventListener('message_control', e=>{
			let data = this.part_data(e.target)
			e.detail.data = data // eeehehe
		}, {capture: true})
		
		Object.seal(this)
	}
	get_messages_near(last, newer, amount, callback) {
		let order = newer ? 'id' : 'id_desc'
		let query = `contentId = @pid AND id ${newer?">":"<"} @last AND !notdeleted()`
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
		let block = this.$list[newer?'lastChild':'firstChild']
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
		let [block, contents] = MessageList.draw_block(comment)
		let part = this.draw_part(comment)
		contents.append(part)
		this.$list.append(block)
		//this.first_id = comment.id
	}
	get_merge(message, backwards) {
		// check if there's a message-block we can merge with
		let block = this.$list[backwards?'firstChild':'lastChild']
		if (block && block.nonce==message.Author.merge_hash) {
			let contents = block.lastChild
			// see if there's a message-part within 5 minutes of new one
			let last = contents[backwards?'firstElementChild':'lastElementChild']
			// <message-controls> might be before the <message-part>
			if (backwards && last==MessageList.controls)
				last = last.nextElementSibling
			if (last && Math.abs(message.Author.date.getTime() - last.nonce)<=1e3*60*5)
				return contents
		}
		return null
	}
	display_messages(messages, backwards, live) {
		for (let m of messages)
			this.display_message(m, backwards, live)
	}
	/*split_block(id) {
	}*/
	// TODO:
	// there are 7 types of messages
	// - live message_event:
	//   - 1: normal
	//   - deleted/edited:
	//     - 2: corresponds to a displayed message (replace)
	//     - 3: corresponds to an old message (id < min) (ignore)
	//     - 4: is a rethread (id > min) (insert, and remove from old room)
	// - downloaded manually:
	//   - 5: deleted (ignore)
	//   - 6: normal (append)
	//   - 7: edited (append)
	display_message(message, backwards, live) {
		let existing = this.parts.get(message.id)
		// corresponds to displayed message:
		if (existing) {
			// deleted or rethreaded to another room:
			if (message.deleted || message.contentId!=this.pid) {
				this.remove_message(message.id)
				return null
			}
			// edited (or duplicate):
			let part = this.draw_part(message)
			existing.elem.replaceWith(part)
			return part
		}
		// message we don't care about
		if (message.contentId!=this.pid || message.deleted)
			return null
		
		// old edited message (/probably/)
		if (live && message.edited)
			return null
		
		// new message
		//if (message.id < this.first_id)
		//	this.first_id = message.id
		let part = this.draw_part(message)
		// new message-part
		// try to find a message-block to merge with
		let contents = this.get_merge(message, backwards)
		if (!contents) {
			let block
			;[block, contents] = MessageList.draw_block(message)
			// TODO: the displayed time will be wrong, if we are going backwards!!
			this.$list[backwards?'prepend':'appendChild'](block)
		}
		contents[backwards?'prepend':'appendChild'](part)
		return part
	}
	remove_message(id) {
		let part = this.parts.pop(id)
		if (!part)
			throw new RangeError("Tried to remove nonexistant message-part, id:"+id)
		// ghhhh
		//this.first_id = this.parts.keys().next().value || Infinity
		
		// remove controls if they're on this message
		if (part.elem == MessageList.controls_message)
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
			// what the fuck
			for (let id of [...this.parts.keys()].sort()) {
				this.remove_message(id)
				if (!this.over_limit())
					break
			}
	}
	part_data(elem) {
		return this.parts.get(+elem.dataset.id).data
	}
	draw_part(comment) {	
		let e = MessageList.part_template()
		
		if (comment.edited)
			e.className += " edited"
		
		e.dataset.id = comment.id
		e.nonce = comment.Author.date.getTime()
		Markup.convert_lang(comment.text, comment.values.m, e, {intersection_observer: View.observer})
		this.parts.set(comment.id, {elem:e, data:comment})
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
		// hack to set height idk..
		let e = document.createElement('div')
		e.append('a')
		this.controls.append(e)
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
		for (let action of ['info', /*'speak',*/ 'edit',]) {
			let btn = document.createElement('button')
			btn.onclick = handler
			btn.dataset.action = action
			btn.tabIndex=-1
			this.controls.append(btn)
		}
		
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
MessageList.draw_block = function(comment) {
	let e = this.block()
	
	let author = comment.Author
	
	e.dataset.uid = comment.createUserId
	e.nonce = comment.Author.merge_hash
	
	if (author.bigAvatar) {
		//avatar = this.big_avatar()
		//let url = Req.file_url(author.bigAvatar, "size=500")
		//avatar.style.backgroundImage = `url("${url}")`
	} else {
		e.style.setProperty('--avatar-url', `url("${Draw.avatar_url(author)}")`)
	}
	
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
	time.textContent = Draw.time_string(comment.Author.date)
	
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
})

MessageList.init()
Object.seal(MessageList)

document.addEventListener('message_control', e=>{
	if (e.detail.action=='info')
		alert(JSON.stringify(e.detail.data, null, 1)) // <small heart>
})
