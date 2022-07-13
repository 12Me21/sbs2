'use strict'

//function register_activity(e) {
	// 1: if currently inactive, switch to active
	// 2: record time
//}
// 3: on a ~1 minute interval timer, check if last activity time was > 3 minutes or whatever, and go inactive

//;['wheel','keydown','mousedown','mousemove','touchstart'].forEach(event => document.addEventListener(event, registerActivity))
//window.addEventListener('focus', registerActivity)

//todo: views should be classes that extend a base class
// then, most of the query is static and etc.

class PageView extends BaseView {
	Start({id, query}) {
		let field = 'number'==typeof id ? 'id' : 'hash'
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
		
		this.$textarea.enterKeyHint = Settings.values.chat_enter!='newline' ? "send" : "enter" // uh this won't update though... need a settings change watcher
		this.$textarea_container.onkeydown = e=>{
			if (e.isComposing)
				return
			// enter - send
			if ('Enter'==e.key && !e.shiftKey && Settings.values.chat_enter!='newline') {
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
		this.$cancel.onclick = e=>{ this.cancel_edit() }
		this.$root.onkeydown = e=>{
			if ('Escape'==e.key)
				this.cancel_edit()
		}
		
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
		
		this.$watching.onchange = ev=>{
			let btn = ev.currentTarget
			if (btn.disabled)
				return
			btn.disabled = true
			Req.set_watch(this.page_id, btn.checked).do = resp=>{
				btn.disabled = false
			}
		}
	}
	Render({message, content:[page], Mpinned:pinned, user, watch}) {
		this.page_id = page.id
		PageView.rooms[this.id] = this
		
		this.userlist = new StatusDisplay(this.page_id, this.$userlist)
		
		this.scroller = new Scroller(this.$outer, this.$inner)
		// chat messages
		this.list = new MessageList(this.$message_list, this.page_id)
		
		this.$load_older.onclick = e=>{
			let btn = e.target
			if (btn.disabled) return
			btn.disabled = true
			// todo: preserve scroll position
			this.list.draw_messages_near(false, 50, ()=>{
				btn.disabled = false
			})
		}
		
		// resize handle
		let height = null //height = 0
		new ResizeBar(this.$page_container, this.$resize_handle, false, 1, 'setting--divider-pos-'+this.page_id, null, height)
		///////////
		
		this.update_page(page, user)
		this.update_watch(watch[0])
		
		this.userlist.set_status("active")
		this.userlist.redraw()
		
		message.reverse()
		this.display_messages(message, true)
		
		if (pinned instanceof Array && pinned.length) {
			let separator = document.createElement('div')
			separator.className = "messageGap"
			this.$extra.prepend(separator)
			
			const list = document.createElement('message-list')
			this.pinned_list = new MessageList(list, this.page_id)
			this.$extra.prepend(list)
			
			Entity.link_comments({message:pinned, user})
			
			for (const m of pinned)
				this.pinned_list.display_message(m, false)
		}
		
		View.set_entity_title(page)
		//View.set_entity_path(page.parent)
		let can_edit = /u/i.test(page.permissions[Req.uid]) // unused
		
		$pageCommentsLink.href = "#comments/"+page.id+"?r" // todo: location
		$pageEditLink.href = "#editpage/"+page.id
		
		let can_talk = page.createUserId==Req.uid || Entity.has_perm(page.permissions, Req.uid, 'C')
		this.$textarea.disabled = !can_talk
		if (can_talk)
			this.$textarea.focus()
	}
	Visible() {
		this.textarea_resize()
		// for some reason this caused major rendering glitches in ios
		// and doesn't seem to be necessary, so i guess i'll disable it?
		//this.scroller.scroll_instant()
	}
	// 8:10;35
	Destroy(type) {
		View.lost = this.$textarea.value
		this.dead = true
		this.userlist.set_status(null)
		delete PageView.rooms[this.page_id]
		this.scroller.destroy()
		PageView.track_resize_2.remove(this.$textarea_container)
	}
	Insert_Text(text) {
		Edit.insert(this.$textarea, text)
	}

	// render the watch state
	update_watch(watch) {
		this.watch = watch
		this.$watching.checked = !!this.watch
	}
	update_page(page, user) {
		this.page = page
		this.author = user[~page.createUserId]
		if (page.contentType==CODES.file) {
			// messy code
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
				Sidebar.select_tab('file')
			})
			this.$page_contents.fill([ne, b])
		} else {
			Markup.convert_lang(page.text, page.values.markupLang, this.$page_contents, {intersection_observer: View.observer})
		}
		this.$create_date.lastChild.replaceWith(Draw.time_ago(page.createDate2))
		this.$author.fill(Draw.user_label(this.author))
		//this.$edit_date
	}
	my_last_message() {
		// this is kinda bad, we scan in the wrong direction and choose the last match.
		// but it's the best we can do, with Map or object, since there's no way to iterate backwards
		let mine
		for (let {data} of this.list.parts.values())
			if (data.createUserId == Req.uid) {
				if (!mine || data.id>mine.id)
					mine = data
			}
		return mine
	}
	// display a list of messages
	// DON'T call this unless you know what you're doing
	// comments: [Comment]
	// animate: Boolean - whether to play the scrolling animation
	display_messages(comments, initial=false) {
		this.scroller.print(inner=>{
			for (let comment of comments)
				this.list.display_message(comment, false)
		}, !initial && View.current==this)
		if (this.list.over_limit() && !this.$limit_checkbox.checked) {
			this.scroller.print_top(inner=>{
				this.list.limit_messages()
			})
		}
		// display comment in title
		// todo: also call if the current comment being shown in the title is edited
		if (View.current==this) {
			let last = comments.findLast(msg=>Entity.is_new_comment(msg))
			if (last)
				View.comment_notification(last)
		}
	}
	
	textarea_resize() {
		this.$textarea.style.height = ""
		let height = this.$textarea.scrollHeight
		this.$textarea.parentNode.style.height = this.$textarea.style.height = height+1+"px"
	}
	
	send_message() {
		let data = this.read_input(this.editing_comment)
		
		if (this.editing_comment) { // editing comment
			let last_edit = this.editing_comment
			this.cancel_edit()
			this.$textarea.focus()
			
			if (data.text) { // input not blank
				last_edit.text = data.text
				last_edit.values = data.values //mmn
				Req.send_message(last_edit).do = (resp, err)=>{
					if (err)
						alert("Editing comment failed")
				}
			} else { // input is blank
				let resp = confirm("Are you sure you want to delete this message?\n"+last_edit.text)
				if (!resp)
					return
				Req.delete('message', last_edit.id).do = (resp, err)=>{
					if (err)
						alert("Deleting comment failed")
				}
			}
		} else { // posting new comment
			if (data.text) { // input is not blank
				let old = data
				Req.send_message({
					contentId: this.page_id,
					text: data.text,
					values: data.values,
				}).do = (resp, err)=>{
					// i remvoed this because you can just undo now
					//if (err) //error sending message
						//this.write_input(old)
				}
				Edit.clear(this.$textarea)
				this.textarea_resize()
			}
		}
	}
	
	read_input(old) {
		let values = old ? old.values : {}
		
		// editing
		if (old) {
			if (this.$markup.value)
				values.m = this.$markup.value
			else
				delete values.m
		}
		// new message
		else {
			if (Req.me)
				values.a = Req.me.avatar
			if (Settings.values.nickname)
				values.n = Entity.filter_nickname(Settings.values.nickname)
			if (Settings.values.big_avatar=='on' && Settings.values.big_avatar_id)
				values.big = Settings.values.big_avatar_id
			values.m = Settings.values.chat_markup
		}
		
		return {
			values: values,
			text: this.$textarea.value,
		}
	}
	write_input(data) {
		Edit.set(this.$textarea, data.text)
		this.textarea_resize()
		let markup = data.values.m
		if ('string'!=typeof markup)
			markup = ""
		this.$markup.value = markup
	}
	edit_comment(comment) {
		if (this.editing_comment)
			this.cancel_edit()
		if (!comment)
			return
		this.pre_edit = this.read_input()
		this.editing_comment = comment
		this.Flag('editing', true)
		// do this after the flag, so the width is right
		this.write_input(comment) 
		// todo: maybe also save/restore cursor etc.
		window.setTimeout(x=>{
			this.$textarea.setSelectionRange(99999, 99999) // move cursor to end
			this.$textarea.focus()
		})
	}
	cancel_edit() {
		if (this.editing_comment) {
			this.editing_comment = null
			this.Flag('editing', false)
			this.write_input(this.pre_edit)
		}
	}

	// display a list of messages from multiple rooms
	static handle_messages(comments) {
		// for each room, display all of the new comments for that room
		Object.for(this.rooms, room=>{
			let c = comments.filter(c => c.contentId==room.page_id)
			if (c.length)
				room.display_messages(c)
		})
	}
	static scroll_lock(lock) {
		for (let room of Object.values(this.rooms))
			lock ? room.scroller.lock() : room.scroller.unlock()
	}
}
PageView.track_resize_2 = new ResizeTracker('width')
PageView.template = HTML`
<view-root class='COL'>
	<div class='FILL SLIDES' $=panes>
		<chat-pane class='resize-box shown COL'>
			<scroll-outer class='sized page-container' $=page_container>
				<div class='pageInfoPane bar rem1-5'>
					<label>Watching: <input type=checkbox $=watching></label>
					<span $=author style='margin: 0 0.5rem;'></span>
					<span $=create_date>Created: <time></time></span>
				</div>
				<div class='pageContents' $=page_contents></div>
			</scroll-outer>
			<resize-handle $=resize_handle class='userlist2' style='--bar-height:2.4375rem'><div $=userlist class='userlist'></div></resize-handle>
			<scroll-outer class='FILL' $=outer>
				<scroll-inner $=inner>
					<div $=extra>
						<button $=load_older>load older messages</button>
						<label><input type=checkbox $=limit_checkbox>disable limit</label>
					</div>
					<message-list $=message_list></message-list>
					<div class='chat-bottom' tabindex=0></div>
				</scroll-inner>
			</scroll-outer>
		</chat-pane>
	</div>
	<div class='inputPane ROW'>
		<div class='showWhenEdit COL'>
			<input $=markup placeholder="markup" style="width:50px;">
			<button class='FILL' $=cancel>Cancel</button>
		</div>
		<textarea-container class='FILL' $=textarea_container>
			<div $=textarea_width></div>
			<textarea class='chatTextarea' $=textarea accesskey="z"></textarea>
		</textarea-container>
		<div class='COL'>
			(temp)
			<button class='FILL' $=send>Send</button>
		</div>
	</div>
</view-root>
`
PageView.rooms = {__proto__:null}

View.register('page', PageView)
View.register('pages', {
	Redirect(location) {location.type='page'},
})
View.register('category', {
	Redirect(location) {location.type='page'},
})

//todo: some unified system for listening to updates relating to the current page/pageid
// - message create/delete/edit
// - watch create/delete/edit
// - content edit/delete
// - user status changes

Settings.add({
	name: 'nickname', label: "Chat Nickname", type: 'text',
	order: -9000,
})
Settings.add({
	name: 'chat_markup', label: "Chat Markup", type: 'select',
	options: ['12y', '12y2', 'plaintext'],
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
	name: 'chat_enter', label: "chat enter key", type: 'select',
	options: ['submit', 'newline'],
	update(value) {
		/*			do_when_ready(()=>{
					$chatTextarea.enterKeyHint = value=='newline' ? "enter" : "send"
					})*/
	},
})
