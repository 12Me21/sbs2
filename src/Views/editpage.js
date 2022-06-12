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
			Req.write(this.page).do = (resp, err)=>{
				if (!err)
					alert('ok')
				else
					alert('edit failed')
			}
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
	Render({content:[page], user}, ext) {
		View.set_entity_title(page)
		this.page = page
		$editPageLink.href = "#page/"+page.id
		this.textarea.value = page.text
		page.text = null
		$editorData.value = JSON.stringify(page, null, 1)
		
		$editorPreviewButton.checked = false
		this.toggle_preview(false)
		$editorLiveButton.checked = true
		this.live_preview = true
		//this.update_preview()
	},
	Cleanup(type) {
		this.page = null
		$editorPreview.fill()
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
	}
})
