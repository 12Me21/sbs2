'use strict'

class EditView extends BaseView {
	Init() {
		this.page = null
		this.show_preview = false
		this.live_preview = false
		this.sections = null
		this.current_section = null
		this.sections_invalid = true
		this.text = null
		
		new ResizeBar(this.$top, this.$resize, 'top')
		
		this.$save = Draw.button("Save", Draw.event_lock(done=>{
			if (!this.page)
				return
			let data = JSON.parse(this.$data.value)
			data.text = this.page.text
			
			let text
			if (this.current_section == null) {
				text = this.$textarea.value
			} else {
				this.sections[this.current_section].text = this.$textarea.value
				text = this.text = this.sections.map(x=>x.lnl+x.text).join("")
			}
			let change = text.length - data.text.length
			let percent = change/data.text.length*100
			if (percent < -50)
				if (!confirm("are you sure you want to save?\ntext length changed by "+percent.toFixed(1)+"% ("+change+" chars)"))
					return void done()
			data.text = text
			
			Object.assign(this.page, data)
			this.save(done)
		}))
		this.$save.className = 'item'
		this.Slot.$header_extra.append(this.$save)
		
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
		this.$textarea.onchange = ev=>{
			if (this.current_section==null)
				this.sections_invalid = true
		}
		this.$render_button.onclick = e=>{
			this.update_preview(true)
		}
		
		this.$section.onfocus = ev=>{
			if (this.sections_invalid) {
				if (this.current_section==null) {
					this.text = this.$textarea.value
					this.find_sections()
				}
			}
		}
		this.$section.onchange = ev=>{
			this.choose_section(ev.target.value)
		}
	}
	choose_section(id) {
		if (this.sections_invalid)
			return
		if (this.current_section != null)
			this.sections[this.current_section].text = this.$textarea.value
		
		let text
		if (id=='all') {
			this.current_section = null
			text = this.text = this.sections.map(x=>x.lnl+x.text).join("")
		} else {
			this.current_section = id
			text = this.sections[this.current_section].text
		}
		this.$textarea.value = text
		
		if (this.show_preview && this.live_preview)
			this.update_preview()
		else
			this.$preview.fill()
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
		this.text = this.page.text
		//$editorSave.textContent = creating ? "Create" : "Save"
		this.Slot.add_header_links([
			{label:"back", href:"#page/"+page.id},
		])
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
	find_sections() {
		let spl = this.text.split(/(\n*^#+ .*)/mg)
		let sections = [{name:"<top>", text:spl[0], lnl:""}]
		sections.all = {name:"<all>"}
		for (let i=1; i<spl.length; i+=2) {
			let hd = spl[i]
			let lnl = hd[0]=="\n"
			if (lnl)
				hd = hd.substring(1)
			sections.push({name:hd.trim(), text:hd+spl[i+1], lnl:lnl?"\n":""})
		}
		
		let o = document.createElement('option')
		o.value = "all"
		o.text = "<all>"
		this.$section.fill(o)
		
		sections.forEach((x,i)=>{
			let o = document.createElement('option')
			o.value = i
			o.text = x.name
			this.$section.add(o)
		})
		
		this.sections = sections
		this.sections_invalid = false
		//return sections
	}
	update_preview(full) {
		let shouldScroll = this.$preview_outer.scrollHeight-this.$preview_outer.clientHeight-this.$preview_outer.scrollTop
		Markup.convert_lang(this.$textarea.value, this.page.values.markupLang, this.$preview, {preview: !full})
		//console.log(shouldScroll, 'scr?')
		if (shouldScroll < 20)
			this.$preview_outer.scrollTop = 9e9
	}
	save(callback) {
		/*Req.write(this.page).do = (resp, err)=>{
			if (err) {
				alert('❌ page edit failed')
				print('❌ page edit failed!')
			} else {
				//alert('✅ saved page')
				print('✅ saved page')
				//this.got_page(resp, false)
			}
			callback && callback(!err)
		}*/
		print('saving page...')
	}
}

EditView.template = HTML`
<view-root class='resize-box COL'>
	<div $=top class='sized page-container SLIDES' style='height:40%'>
		<scroll-outer data-slide=preview $=preview_outer><scroll-inner $=preview class='pageContents editPageContents'></scroll-inner></scroll-outer>
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
		<label>| Section: <select style='width:5rem;' $=section></select></label>
	</div>
	<textarea $=textarea class='FILL editor-textarea' style='margin:3px;'></textarea>
</view-root>
`

View.register('editpage', EditView)
