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
		this.part_list = []
		
		// this listens for events created by the message edit/info buttons
		// and modifies the event to add the message data
		this.$list.addEventListener('message_control', ev=>{
			let data = this.parts.get(+ev.target.dataset.id).data
			ev.detail.data = data // eeehehe
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
				let part = this.display_message(c)
				if (part && first) {
					part.className += " boundary-"+(newer?"top":"bottom")
					first = false
				}
			}
			callback(resp.message.length != 0)
		})
	}
	single_message(comment) {
		let part = this.draw_part(comment)
		let p = {elem:part, data:comment}
		this.parts.set(comment.id, p)
		this.part_list.push(p)
		
		this.$list.append(MessageList.draw_block(comment, part))
		return part
	}
	display_messages(messages, live) {
		for (let m of messages)
			this.display_message(m, live)
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
	check_merge(message, last) {
		if (last.Author.merge_hash==message.Author.merge_hash)
			if (Math.abs(message.Author.date.getTime() - last.Author.date.getTime())<=1e3*60*5)
				return true
		return false
	}
	display_message(message, live) {
		let existing = this.parts.get(message.id)
		// deleted or in another room:
		if (message.deleted || message.contentId!=this.pid) {
			// deleted or rethreaded
			if (existing) {
				this.parts.delete(message.id)
				let index = this.part_list.indexOf(existing)
				if (index<0) // >:(
					return null
				this.part_list.splice(index, 1)
				this.remove_elem(existing.elem)
			}
			return null
		}
		// edited (or duplicate):
		if (existing) {
			let part = this.draw_part(message)
			existing.elem.replaceWith(part)
			existing.elem = part
			existing.data = message
			return part
		}
		if (live && message.edited) {
			return null
			/*let first = this.part_list[0]
			if (!first || message.id < first.data.id) {
				// old edited message
				return null
			}
			// rethreaded message:
			// TODO:
			return null*/
		}
		
		// first message
		if (!this.part_list.length)
			return this.single_message(message)
		
		// to end of list
		let last = this.part_list[this.part_list.length-1]
		if (message.id > last.data.id) {
			let part = this.draw_part(message)
			let merge = this.check_merge(message, last.data)
			if (merge)
				last.elem.parentNode.appendChild(part)
			else
				this.$list.appendChild(MessageList.draw_block(message, part))
			let p = {elem:part, data:message}
			this.parts.set(message.id, p)
			this.part_list.push(p)
			return part
		}
		
		// start of list
		last = this.part_list[0]
		if (message.id < last.data.id) {
			let part = this.draw_part(message)
			let merge = this.check_merge(message, last.data)
			// TODO: the displayed time will be wrong, if we are going backwards!!
			if (merge)
				last.elem.parentNode.prepend(part)
			else
				this.$list.prepend(MessageList.draw_block(message, part))
			let p = {elem:part, data:message}
			this.parts.set(message.id, p)
			this.part_list.unshift(p)
			return part
		}
		// oh fuck oh shit
		
		throw new Error('oh fuck oh shit')
	}
	remove_elem(elem) {
		// remove controls if they're on this message
		if (elem == MessageList.controls_message)
			MessageList.show_controls(null)
		let contents = elem.parentNode // <message-contents>
		elem.remove()
		
		if (!contents.hasChildNodes())
			contents.parentNode.remove() // remove <message-block> if empty
	}
	over_limit() {
		return this.parts.length > this.max_parts
	}
	limit_messages() {
		let over = this.parts.length - this.max_parts
		if (over>0)
			for (let {elem, data} of this.part_list.splice(0, over)) {
				this.parts.delete(data.id)
				this.remove_elem(elem)
			}
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
MessageList.draw_block = function(comment, part) {
	let e = this.block()
	
	let author = comment.Author
	
	e.dataset.uid = comment.createUserId
	
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
	
	e.lastChild.appendChild(part)
	
	return e
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
