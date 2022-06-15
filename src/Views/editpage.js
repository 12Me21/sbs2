'use strict'

View.add_view('editpage', {
	textarea: null,
	preview: null,
	page: null,
	show_preview: false,
	live_preview: false,
	
	Init() {
		this.textarea = $editorTextarea
		this.preview = $editorPreview
		
		View.attach_resize($editorTop, $editorResize, false, 1, null, null, 300)
		$editorSave.onclick = e=>{
			if (!this.page)
				return
			let data = JSON.parse($editorData.value)
			data.text = this.textarea.value
			Object.assign(this.page, data)
			this.save()
		}
		let batch = (cb,w=0)=>e=>w++||requestAnimationFrame(_=>cb(e,w=0))
		$editorPreviewButton.onchange = e=>{
			this.toggle_preview(e.target.checked)
		}
		$editorLiveButton.onchange = e=>{
			this.live_preview = e.target.checked
			if (this.live_preview)
				this.update_preview()
		}
		$editorTextarea.addEventListener('input', batch(e=>{
			if (this.show_preview && this.live_preview)
				this.update_preview()
		}), {passive: true})
		$editorRenderButton.onclick = e=>{
			this.update_preview(true)
		}
	},
	
	Start({id, query}) {
		if (id==null) {
			return {quick: true, ext: {}}
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
			ext: {},
			check(resp) {
				return resp.content[0]
			},
		}
	},
	Quick(ext, location) {
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
	},
	Render({content:[page], user}, ext) {
		this.got_page(page, false)
	},
	Cleanup(type) {
		this.page = null
		$editorPreview.fill()
	},
	
	got_page(page, creating) {
		View.set_entity_title(page)
		this.page = page
		$editorSave.textContent = creating ? "Create" : "Save"
		$editPageLink.href = "#page/"+page.id
		this.textarea.value = page.text //todo: preserve undo?
		// only show writable fields
		let writable = {}
		for (let [k,v] of Object.entries(page)) {
			let info = ABOUT.details.types.content[k]
			if (!info || info[creating?'writableOnInsert':'writableOnUpdate']) {
				if (k!='text')
					writable[k] = v
			}
		}
		$editorData.value = JSON.stringify(writable, null, 1)
		
		$editorPreviewButton.checked = false
		this.toggle_preview(false)
		$editorLiveButton.checked = true
		this.live_preview = true
		//this.update_preview()
	},
	toggle_preview(state) {
		this.show_preview = state
		$editorPreviewOuter.classList.toggle('shown', state)
		$editorFields.classList.toggle('shown', !state)
		$editorPreviewControls.hidden = !state
		if (state) {
			this.update_preview()
		} else {
			$editorPreview.fill()
		}
	},
	update_preview(full) {
		Markup.convert_lang(this.textarea.value, this.page.values.markupLang, this.preview, {preview: !full})
	},
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
})
