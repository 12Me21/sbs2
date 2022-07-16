'use strict'

class EditView extends BaseView {
	Init() {
		this.page = null
		this.show_preview = false
		this.live_preview = false
		
		new ResizeBar(this.$top, this.$resize, 'top')
		
		/*$editorSave.onclick = e=>{
			if (!this.page)
				return
			let data = JSON.parse(this.$data.value)
			data.text = this.$textarea.value
			Object.assign(this.page, data)
			this.save()
		}*/
		let batch = (cb,w=0)=>e=>w++||requestAnimationFrame(_=>cb(e,w=0))
		this.$preview_button.onchange = e=>{
			this.toggle_preview(e.target.checked)
		}
		this.$live_button.onchange = e=>{
			this.live_preview = e.target.checked
			if (this.live_preview)
				this.update_preview()
		}
		this.$textarea.addEventListener('input', batch(e=>{
			if (this.show_preview && this.live_preview)
				this.update_preview()
		}), {passive: true})
		this.$render_button.onclick = e=>{
			this.update_preview(true)
		}
	}
	Start({id, query}) {
		if (id==null) {
			return {quick: true}
		}
		return {
			chain: {
				values: {
					pid: id,
				},
				requests: [
					{type: 'content', fields: "*", query: "id = @pid"},
					{type: 'user', fields: "*", query: "id IN @content.createUserId"},
				],
			},
			check(resp) {
				return resp.content[0]
			},
		}
	}
	Quick() {
		// hack to create new page object
		// todo: clean up TYPES
		let page = TYPES.content(Object.assign({}, TYPES.content.prototype))
		page.contentType = ABOUT.details.codes.InternalContentType.page
		page.values = {
			markupLang: Settings.values.chat_markup,
		}
		page.name = "New Page"
		page.permissions = {"0":"CR"}
		
		this.got_page(page, true)
	}
	Render({content:[page], user}) {
		this.got_page(page, false)
	}
	Insert_Text(text) {
		Edit.insert(this.$textarea, text)
	}
	got_page(page, creating) {
		this.Slot.set_entity_title(page)
		this.page = page
		//$editorSave.textContent = creating ? "Create" : "Save"
		//$editPageLink.href = "#page/"+page.id
		this.$textarea.value = page.text //todo: preserve undo?
		// only show writable fields
		let writable = {}
		for (let [k,v] of Object.entries(page)) {
			let info = ABOUT.details.types.content[k]
			if (!info || info[creating?'writableOnInsert':'writableOnUpdate']) {
				if (k!='text')
					writable[k] = v
			}
		}
		this.$data.value = JSON.stringify(writable, null, 1)
		
		this.$preview_button.checked = false
		this.toggle_preview(false)
		this.$live_button.checked = true
		this.live_preview = true
		//this.update_preview()
	}
	toggle_preview(state) {
		this.show_preview = state
		this.$preview_outer.classList.toggle('shown', state)
		this.$fields.classList.toggle('shown', !state)
		this.$preview_controls.hidden = !state
		if (state) {
			this.update_preview()
		} else {
			this.$preview.fill()
		}
	}
	update_preview(full) {
		let shouldScroll = this.$preview_outer.scrollHeight-this.$preview_outer.clientHeight-this.$preview_outer.scrollTop
		Markup.convert_lang(this.$textarea.value, this.page.values.markupLang, this.$preview, {preview: !full})
		//console.log(shouldScroll, 'scr?')
		if (shouldScroll < 20)
			this.$preview_outer.scrollTop = 9e9
	}
	save() {
		Req.write(this.page).do = (resp, err)=>{
			if (err) {
				alert('edit failed')
				return
			}
			alert('ok')
			this.got_page(resp, false)
		}
	}
}

EditView.template = HTML`
<view-root class='resize-box COL'>
	<div $=top class='sized page-container SLIDES' style='height:40%'>
		<scroll-outer data-slide=preview $=preview_outer><scroll-inner $=preview class='pageContents'></scroll-inner></scroll-outer>
		<div data-slide=fields $=fields class='ROW'>
			<textarea $=data style="resize:none;margin:0.5rem;" class='FILL code-textarea'></textarea>
		</div>
	</div>
	<div $=resize style=--handle-width:2em; class='resize-handle'>
		<label>preview:<input type=checkbox $=preview_button></label>
		<span $=preview_controls>
			| <label>live:<input type=checkbox $=live_button></label>
			<button $=render_button>render full</button>
		</span>
	</div>
	<textarea $=textarea class='FILL editor-textarea' style='margin:3px;'></textarea>
</view-root>
`

View.register('editpage', EditView)
