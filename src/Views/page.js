'use strict'

function register_activity(e) {
	// 1: if currently inactive, switch to active
	// 2: record time
}
// 3: on a ~1 minute interval timer, check if last activity time was > 3 minutes or whatever, and go inactive

//;['wheel','keydown','mousedown','mousemove','touchstart'].forEach(event => document.addEventListener(event, registerActivity))
//window.addEventListener('focus', registerActivity)

//todo: views should be classes that extend a base class
// then, most of the query is static and etc.

class PageView extends BaseView {
	Init() {
		this.pre_edit = null
		this.editing_comment = null
		this.room = null
		
		this.$textarea.enterKeyHint = Settings.chat_enter!='newline' ? "send" : "enter" // uh this won't update though... need a settings change watcher
		
		this.$textarea.onkeydown = e=>{
			if (e.isComposing)
				return
			// enter - send
			if (Settings.values.chat_enter!='newline' && e.keyCode==13 && !e.shiftKey) {
				e.preventDefault()
				this.send_message()
			}
			// up arrow - edit previous message
			if (e.keyCode==38 && this.$textarea.value=="") {
				let msg = this.room && this.room.my_last_message()
				if (msg && msg.x_data) {
					e.preventDefault()
					this.edit_comment(msg.x_data)
				}
			}
		}
		this.$send.onclick = e=>{
			this.send_message()
		}
		this.$cancel.onclick = e=>{
			this.cancel_edit()
		}
		// TODO: global escape handler?
		/*document.addEventListener('keydown', e=>{
			if (e.keyCode==27)
				this.cancel_edit()
		})*/
		let r = this.textarea_resize.bind(this)
		this.$textarea.addEventListener('input', r, {passive: true})
		PageView.track_resize_2.add(this.$textarea, ()=>{
			window.setTimeout(r)
		})
	}
	Visible() {
		this.textarea_resize()
	}
	Start({id, query}) {
		let field
		if ('number'==typeof id) {
			field = 'id'
		} else {
			field = 'hash'
		}
		return {
			chain: {
				values: {
					key: id,
				},
				requests: [
					{type: 'content', fields: "*", query: `${field} = @key`},
					{type: 'message', fields: "*", query: "contentId in @content.id AND !notdeleted()", order: 'id_desc', limit: 30},
					//				{name: 'Mpinned', type: 'message', fields: "*", query: "id in @content.values.pinned"},
					{type: 'user', fields: "*", query: "id IN @content.createUserId OR id IN @message.createUserId OR id IN @message.editUserId"},
				],
			},
			ext: {},
			check(resp) {
				return resp.content[0]
			},
		}
	}
	Render({message, content:[page]}, ext) {
		message.reverse()
//		let pinned = objects.Mpinned
		
		this.room = ChatRoom.obtain_room(page.id, page, message, this) //n nng
		this.room.show()
		
		this.render_page(page)
	}
	Cleanup(type) {
		this.room && this.room.hide() //so it's fucking possible for cleanup to get called TWICE if there's an error, sometimes.
		this.room = null
		View.flag('canEdit', false)
	}
	render_page(page) {
		View.set_entity_title(page)
		//View.set_entity_path(page.parent)
		View.flag('canEdit', /u/i.test(page.permissions[Req.uid]))
		$pageCommentsLink.href = "#comments/"+page.id+"?r" // todo: location
		$pageEditLink.href = "#editpage/"+page.id
		if (page.createUserId==Req.uid || /c/i.test(page.permissions[Req.uid] || page.permissions[0])) {
			this.$textarea.disabled = false
			this.$textarea.focus()
		} else
			this.$textarea.disabled = true
		this.room.edit_callback = msg=>this.edit_comment(msg)
	}
	textarea_resize() {
		this.$textarea.style.height = ""
		let height = this.$textarea.scrollHeight
		this.$textarea.parentNode.style.height = this.$textarea.style.height = height+1+"px"
	}
	
	send_message() {
		if (!this.room)
			return
		
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
					contentId: this.room.id,
					text: data.text,
					values: data.values,
				}).do = (resp, err)=>{
					//if (err) //error sending message
						//this.write_input(old)
				}
				this.$textarea.select()
				document.execCommand('delete')
				//$chatTextarea.value = ""
				this.textarea_resize()
			}
		}
	}
	
	read_input(old) {
		let values = old ? old.values : {}
		
		if (old) {
			if (this.$markup.value)
				values.m = this.$markup.value
			else
				delete values.m
		} else {
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
		this.$textarea.select()
		if (data.text)
			document.execCommand('insertText', false, data.text)
		else
			document.execCommand('delete')
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
		View.flag('chatEditing', true)
		this.write_input(comment) // do this after the flag, so the width is right
		// todo: maybe also save/restore cursor etc.
		window.setTimeout(x=>{
			this.$textarea.setSelectionRange(99999, 99999) // move cursor to end
			this.$textarea.focus()
		})
	}
	cancel_edit() {
		if (this.editing_comment) {
			this.editing_comment = null
			View.flag('chatEditing', false)
			this.write_input(this.pre_edit)
		}
	}	
}
PageView.track_resize_2 = new ResizeTracker('width')
PageView.template = HTML`
<div class='COL'>
	<div class='FILL SLIDES' $=panes></div>
	<div class='inputPane loggedIn ROW'>
		<div class='showWhenEdit COL'>
			<input $=markup placeholder="markup" style="width:50px;">
			<button class='FILL' $=cancel>Cancel Edit</button>
		</div>
		<textarea-container class='FILL'>
			<div $=textarea_width></div>
			<textarea class='chatTextarea' $=textarea accesskey="z"></textarea>
		</textarea-container>
		<div class='COL'>
			(temp)
			<button class='FILL' $=send>Send</button>
		</div>
	</div>
</div>
`
PageView.define('page')
