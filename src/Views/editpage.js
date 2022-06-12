'use strict'

View.add_view('editpage', {
	textarea: null,
	preview: null,
	page: null,
	
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
		$editorData.value = JSON.stringify(page, null, 1)
		this.update_preview()
	},
	Cleanup(type) {
		this.page = null
	},
	update_preview() {
		Markup.convert_lang(this.textarea.value, this.page.values.markupLang, this.preview)
	}
})
