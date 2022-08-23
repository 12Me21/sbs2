'use strict'

//function register_activity(e) {
	// 1: if currently inactive, switch to active
	// 2: record time
//}
// 3: on a ~1 minute interval timer, check if last activity time was > 3 minutes or whatever, and go inactive

//;['wheel','keydown','mousedown','mousemove','touchstart'].forEach(event => document.addEventListener(event, registerActivity))
//window.addEventListener('focus', registerActivity)

class PageView extends BaseView {
	Start({id, query}) {
		let field = 'number'==typeof id ? 'id' : 'hash'
		if (field=='id')
			StatusDisplay.prepare(id)
		return {
			chain: {
				values: {
					key: id,
				},
				requests: [
					{type: 'content', fields: "*", query: `${field} = @key`},
					{type: 'message', fields: "*", query: "contentId IN @content.id AND !notdeleted()", order: 'id_desc', limit: 30},
					{name: 'Mpinned', type: 'message', fields: "*", query: "id IN @content.values.pinned"},
					{type: 'user', fields: "*", query: "id IN @content.createUserId OR id IN @message.createUserId OR id IN @message.editUserId OR id IN @Mpinned.createUserId OR id IN @Mpinned.editUserId"},
					{type: 'watch', fields: "*", query: "contentId IN @content.id"}
				],
			},
			check: resp=>resp.content[0]
		}
	}
	Init() {
		if (View.lost)
			this.$textarea.value = View.lost
		this.editing = null
		this.pre_edit = null
		
		this.$textarea.enterKeyHint = !['newline', 'newline, strip trailing'].includes(Settings.values.chat_enter) ? "send" : "enter" // uh this won't update though... need a settings change watcher
		this.$textarea_container.onkeydown = e=>{
			if (e.isComposing)
				return
			// enter - send
			if ('Enter'==e.key && !e.shiftKey && !['newline', 'newline, strip trailing'].includes(Settings.values.chat_enter)) {
				e.preventDefault()
				this.send_message()
			}
			// up arrow - edit previous message
			if ('ArrowUp'==e.key && this.$textarea.value=="") {
				let comment = this.my_last_message()
				if (comment) {
					e.preventDefault()
					this.edit_comment(comment)
				}
			}
		}
		this.$send.onclick = e=>{ this.send_message() }
		this.$cancel.onclick = e=>{ this.edit_comment(null) }
		this.$root.onkeydown = e=>{
			if ('Escape'==e.key)
				this.edit_comment(null)
		}
		
		this.$watching.onchange = Draw.event_lock(done=>{
			// todo: check for err
			Req.set_watch(this.page_id, this.$watching.checked).do = resp=>{
				done()
			}
		})
		// todo: make the oninput eventhandler just a shared function since it only acts on e.target?
		let r = this.textarea_resize.bind(this)
		this.$textarea_container.addEventListener('input', r, {passive: true})
		PageView.track_resize_2.add(this.$textarea_container, ()=>{
			window.setTimeout(r)
		})
		
		this.$root.addEventListener('message_control', e=>{
			if (e.detail.action=='edit') {
				e.stopPropagation()
				this.edit_comment(e.detail.data)
			}
		})
	}
	Render({message, content:[page], Mpinned:pinned, user, watch}) {
		this.page_id = page.id
		
		// header //
		this.Slot.set_entity_title(page)
		this.Slot.add_header_links([
			{icon:"📜️", label:"logs", href:"#comments/"+page.id+"?r"},
			{icon:"✏️", label:"edit", href:"#editpage/"+page.id},
			{icon:"🗂️", label:"childs", href:"#category/"+page.id},
		])
		
		// init components //
		Object.assign(Lp.users, user)
		this.userlist = new StatusDisplay(this.page_id, this.$userlist)
		this.scroller = new Scroller(this.$outer, this.$inner)
		this.list = new MessageList(this.$message_list, this.page_id)
		this.pinned_list = null
		
		// draw stuff //
		this.update_page(page, user)
		this.update_watch(watch[0])
		
		this.userlist.set_status("viewing")
		this.userlist.redraw()
		
		if (pinned instanceof Array && pinned.length)
			this.update_pinned(pinned, user)
		
		for (let i=message.length-1; i>=0; i--)
			this.list.display_edge(message[i])
		
		// add event listeners //
		Events.messages.listen(this, (messages)=>{
			this.display_live(messages)
		})
		Events.after_messages.listen(this, ()=>{
			this.scroller.unlock()
		})
		Events.userlist.listen_id(this, this.page_id, c=>{
			this.userlist.redraw()
		})
		Events.user_edit.listen(this, user=>{
			this.userlist.redraw_user(user)
		})
		
		// etc
		this.$load_older.onclick = Draw.event_lock(done=>{
			// todo: preserve scroll position
			this.list.load_messages_near(true, 50, ()=>{
				done()
			})
		})
		
		let height = null //height = 0
		new ResizeBar(this.$page_container, this.$resize_handle, 'top', 'setting--divider-pos-'+this.page_id, height)
		
		//let can_edit = /u/i.test(page.permissions[Req.uid]) // unused
		
		let can_talk = page.createUserId==Req.uid || Entity.has_perm(page.permissions, Req.uid, 'C')
		this.$textarea.disabled = !can_talk
		if (can_talk)
			this.$textarea.focus()
	}
	update_pinned(pinned, user) {
		Entity.link_comments({message:pinned, user})
		const list = document.createElement('message-list')
		this.pinned_list = new MessageList(list, this.page_id)
		
		let separator = document.createElement('div')
		separator.className = "messageGap"
		
		this.scroller.print_top(()=>{
			this.$extra.prepend(separator)
			this.$extra.prepend(list)
			for (let msg of pinned)
				this.pinned_list.display_edge(msg)
		})
	}
	update_watch(watch) {
		this.watch = watch
		this.$watching.checked = !!this.watch
	}
	update_page(page, user) {
		this.page = page
		this.author = user[~page.createUserId]
		if (page.contentType==CODES.file) {
			// messy code
			let img = document.createElement('img')
			img.className = "file-page-image"
			if (page.meta) {
				let meta = JSON.parse(page.meta)
				if (meta.width) {
					img.width = meta.width
					img.height = meta.height
				}
			}
			img.alt = page.description
			img.src = Req.image_url(page.hash)
			
			let ne = Draw.button("Set Avatar", e=>{
				Req.me.avatar = this.page.hash
				Req.write(Req.me).do = (resp, err)=>{
					if (!err)
						print('set avatar')
					else
						alert('edit failed')
				}
			})
			let b = Draw.button("Show in sidebar", e=>{
				FileUploader.show_content(this.page)
				Sidebar.tabs.select('file')
			})
			this.$page_contents.fill([ne, b, img])
			let p = document.createElement('pre')
			p.textContent = JSON.stringify(this.page, null, 1)
			this.$page_contents.append(p)
		} else {
			Markup.convert_lang(page.text, page.values.markupLang, this.$page_contents, {intersection_observer: View.observer})
		}
		this.$create_date.lastChild.replaceWith(Draw.time_ago(page.createDate2))
		this.$author.fill(Draw.user_label(this.author))
		//this.$edit_date
	}
	Visible() {
		this.textarea_resize()
		this.scroller.scroll_instant()
	}
	// 8:10;35
	Destroy() {
		View.lost = this.$textarea.value
		goto2: if (this.userlist) {
			// HACK
			for (let {view} of Nav.slots)
				if (view!==this && view instanceof PageView)
					if (view.page_id == this.page_id)
						break goto2
			this.userlist.set_status(null)
		}
		if (this.scroller)
			this.scroller.destroy()
		PageView.track_resize_2.remove(this.$textarea_container)
	}
	Insert_Text(text) {
		Edit.insert(this.$textarea, text)
	}

	my_last_message() {
		let cnt = 0
		for (let node=this.list.prev; node!=this.list; node=node.prev) {
			if (cnt++ > 100) // just in case
				break
			if (node.data.createUserId == Req.uid)
				return node.data
		}
		return null
	}
	// display a list of messages
	// DON'T call this unless you know what you're doing
	// comments: [Comment]
	// animate: Boolean - whether to play the scrolling animation
	display_live(comments) {
		let last_new = null
		let x = null
		// todo: we should only smooth scroll if message is modifed at the END of the list
		let cb = ()=>{
			cb = null
			x = this.scroller.before_print(true)
		}
		for (let msg of comments) {
			if (this.list.display_live(msg, cb))
				last_new = msg
		}
		if (x==null) // nothing printed
			return
		
		this.scroller.after_print(x)
		
		if (this.list.over_limit() && !this.$limit_checkbox.checked) {
			this.scroller.print_top(inner=>{
				this.list.limit_messages()
			})
		}
		if (last_new)
			View.comment_notification(last_new)
	}
	
	textarea_resize() {
		this.$textarea.style.height = "10px"
		let height = this.$textarea.scrollHeight
		this.$textarea.parentNode.style.height = height+1+"px"
		this.$textarea.style.height = "100%"
	}
	
	send_message() {
		let old_text = this.editing && this.editing.text
		let data = this.read_input(this.editing)
		// empty input
		if (!data.text) {
			// delete message, if in edit mode
			if (!this.editing)
				return
			let ok = confirm("Are you sure you want to delete this message?\n"+old_text)
			if (!ok)
				return
			Req.delete('message', data.id).do = (resp, err)=>{
				if (err)
					alert("Deleting comment failed")
			}
		} else { // non-empty
			// create/edit message
			Req.send_message(data).do = (resp, err)=>{
				if (err)
					alert("Posting failed")
			}
		}
		// reset input
		if (this.editing)
			this.edit_comment(null)
		else {
			Edit.clear(this.$textarea)
			this.textarea_resize()
		}
	}
	
	read_input(data=null) {
		// editing
		if (data) {
			if (this.$markup.value)
				data.values.m = this.$markup.value
			else
				delete data.values.m
		}
		// new message
		else {
			data = {values:{}, contentId:this.page_id, text:null}
			let sv = Settings.values
			if (Req.me)
				data.values.a = Req.me.avatar
			if (sv.nickname)
				data.values.n = Author.filter_nickname(sv.nickname)
			if (sv.big_avatar=='on' && sv.big_avatar_id)
				data.values.big = sv.big_avatar_id
			data.values.m = sv.chat_markup
		}
		data.text = this.$textarea.value
		if (['submit, strip trailing', 'newline, strip trailing'].includes(Settings.values.chat_enter) && data.text.endsWith("\n"))
			data.text = data.text.slice(0, -1)
		
		return data
	}
	write_input(data) {
		let text = data.text
		if (['submit, strip trailing', 'newline, strip trailing'].includes(Settings.values.chat_enter) && data.text.endsWith("\n"))
			data.text += "\n"
		
		Edit.set(this.$textarea, text)
		this.textarea_resize()
		if (this.editing) {
			let markup = data.values.m
			if ('string'!=typeof markup)
				markup = ""
			this.$markup.value = markup
		}
	}
	// todo: um why is this one function ... idk.. no shared code anymore
	edit_comment(comment=null) {
		if (!comment) {
			if (this.editing) {
				this.editing = null
				this.write_input(this.pre_edit)
				this.Flag('editing', false)
			}
			return
		}
		// todo: maybe this should be a stack? and then if you edit another post while already in edit mode... sometHing ..
		if (!this.editing)
			this.pre_edit = this.read_input()
		this.editing = comment
		this.Flag('editing', true)
		// do this after the flag, so the width is right
		this.write_input(comment) 
		// todo: maybe also save/restore cursor etc.
		window.setTimeout(x=>{
			this.$textarea.focus()
			this.$textarea.setSelectionRange(99999, 99999) // move cursor to end
		})
	}
}
PageView.track_resize_2 = new ResizeTracker('width')
PageView.template = HTML`
<view-root class='COL resize-box'>
	<scroll-outer class='page-container sized' $=page_container>
		<div class='pageInfoPane bar rem1-5 ROW'>
			<label>Watching: <input type=checkbox $=watching></label>
			<span $=author style='margin: 0 0.5rem;'></span>
			<span $=create_date>Created: <time></time></span>
		</div>
		<div class='pageContents' $=page_contents></div>
	</scroll-outer>
	<div $=resize_handle class='userlist2 resize-handle' style='--bar-height:2.4375rem'><div $=userlist class='userlist'></div></div>
	<auto-scroller class='FILL' $=outer>
		<scroll-inner $=inner>
			<div $=extra>
				<button $=load_older>load older messages</button>
				<label><input type=checkbox $=limit_checkbox>disable limit</label>
			</div>
			<message-list $=message_list></message-list>
			<div class='chat-bottom' tabindex=0></div>
		</scroll-inner>
	</auto-scroller>
	<div class='inputPane ROW'>
		<div class='chat-edit-controls COL'>
			<input $=markup placeholder="markup" style="width:50px;">
			<button class='FILL' $=cancel>Cancel</button>
		</div>
		<textarea-container class='FILL' $=textarea_container>
			<textarea class='chatTextarea' $=textarea accesskey="z"></textarea>
		</textarea-container>
		<div class='COL'>
			(temp)
			<button class='FILL' $=send>Send</button>
		</div>
	</div>
</view-root>
`

View.register('page', PageView)
View.register('pages', {
	Redirect(location) {location.type='page'},
})

Settings.add({
	name: 'nickname', label: "Chat Nickname", type: 'text',
	order: -9000,
})
Settings.add({
	name: 'chat_markup', label: "Chat Markup", type: 'select',
	options: ['12y2', '12y', 'plaintext'],
	order: -8000,
})
/*Settings.add({
	name: 'big_avatar',
	label: "Big Avatar",
	type: 'select',
	options: ['off', 'on'],
})
Settings.add({
	name: 'big_avatar_id',
	label: "Big Avatar Id",
	type: 'text',
})*/
Settings.add({
	name: 'chat_enter', label: "Chat Enter Key", type: 'select',
	options: ['submit', 'newline', 'submit, strip trailing', 'newline, strip trailing'],
})
