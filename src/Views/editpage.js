<!--/* trick indenter
with (View) (function($) { "use strict" //*/

let editor_preview = false
function set_editor_preview(state) {
	editor_preview = state
	let name = state ? 'preview' : 'form'
	for (let elem of $editorPreviewPane.children)
		elem.classList.toggle('shown', elem.dataset.slide == name)
}

add_view('editpage', {
	init() {
		$editorTextarea.oninput = ()=>{update_preview(true)} // todo: argument should set preview flag (whether to load videos etc.)
		$markupSelect.onchange = ()=>{update_preview(true)}
		$markupUpdate.onclick = ()=>{update_preview(false)}
		$submitEdit.onclick = ()=>{
			submit_edit((e, resp)=>{
				if (!e) {
					Nav.go("page/"+resp.id)
				} else {
					alert("Error submitting page!")
				}
			})
		}
		$toggleEditorMode.onclick = ()=>{
			set_editor_preview(!editor_preview)
		}
		View.attach_resize($editorPreviewPane, $editorPreviewResize, false, 1)
	},
	start(id, query, render) {
		if (id) { //edit existing page
			id = +id
			return Req.read([
				['content', {ids: [id]}],
				['user.0createUserId.0editUserId.0permissions'],
			], {user: 'id,username,avatar'}, (e, resp)=>{
				if (!e) {
					let page = resp.content[0]
					if (page)
						render(page, resp.user_map)
					else
						render(null)
				} else
					render(false)
			}, true)
		} else { //create new page
			if (Req.got_categories) {
				done()
				return {abort: ()=>{}}
			} else { //need to request category tree for page editor
				return Req.read([], {}, (e, resp)=>{
					if (!e)
						done()
					else
						render(false)
				}, true)
			}
		}
		function done() {
			render({
				// todo: this is kinda gross
				// maybe it would be better to set the form directly
				// rather than construct this weird fake page
				parentId: query.cid || 0,
				parent: Entity.category_map[query.cid || 0],
				name: query.name || "",
				type: query.type || "chat",
				content: "",
				permissions: {'0': "rc"},
				values: {
					markup: "12y",
				},
				users: entity_map({}, (id)=>({
					Type: 'user',
					name: `{user: ${id}}`,
					id: id,
					fake: true,
				})), // todo: this is a really bad hack
			})
		}
	},
	
	className: 'editpage',
	render(page) {
		set_editor_preview(false)
		
		form = new Form({
			fields: [
				['category', 'category', {label: "Category", default: [0, null]}],
				['type', 'select', {label: "Type", default: 'chat'}, {
					options: Entity.CONTENT_TYPES.map(type=>[type, type.replace(/\b./g, l=>l.toUpperCase())])
				}],
				['keywords', 'word_list', {label: "Keywords"}],
				['thumbnail', 'number', {label: "Thumbnail"}],
				['photos', 'number_list', {label: "Photos"}],
				['pinned', 'number_list', {label: "Pinned comments"}],
				['permissions', 'permissions', {label: "Permissions", default: [{},{}], span: true}],
			]
		})
		// todo: display unknown/unhandled properties somewhere
		// we already preserve them
		
		$editPageForm.fill(form.elem)
		
		if (page.id) {
			set_title("Editing Page")
			fill_fields(page)
			editing_page = {id: page.id, values: page.values, permissions: page.permissions}
			set_entity_path(page)
		} else {
			set_title("Creating Page")
			fill_fields(page)
			editing_page = {}
			set_entity_path(page.parent)
		}
	},
	cleanup() {
		$editorPreview.fill()
		form && form.destroy()
		form = null
		editing_page = null
	},
})

let editing_page = null
let form = null

function submit_edit(callback) {
	if (!editing_page)
		return
	readFields(editing_page)
	Req.editPage(editing_page, callback)
}

function update_preview() {
	let parent = $editorPreview
	let shouldScroll = parent.scrollHeight-parent.clientHeight-parent.scrollTop < 10
	$editorPreview.fill(Parse.parseLang($editorTextarea.value, $markupSelect.value, true))
	// auto scroll down when adding new lines to the end (presumably)
	
	// TODO: this doesn't work, probably because of layout changes
	if (shouldScroll)
		parent.scrollTop = parent.scrollHeight-parent.clientHeight
}

function readFields(page) {
	if (!page.values)
		page.values = {}
	
	page.name = $titleInput.value
	page.values.markupLang = $markupSelect.value
	page.content = $editorTextarea.value
	
	let fields = form.get()
	page.keywords = fields.keywords
	page.type = fields.type
	page.parentId = fields.category
	page.permissions = fields.permissions
	if (fields.photos)
		page.values.photos = fields.photos.join(",")
	if (fields.pinned)
		page.values.pinned = fields.pinned.join(",")
	if (fields.thumbnail)
		page.values.thumbnail = fields.thumbnail
}

function fill_fields(page) {
	$titleInput.value = page.name
	let markup
	if (page.values)
		markup = page.values.markupLang
	if (!markup)
		markup = "plaintext"
	$markupSelect.value = markup
	$editorTextarea.value = page.content
	update_preview()
	
	form.set({
		keywords: page.keywords,
		type: page.type,
		thumbnail: page.values.thumbnail,
		photos: Entity.parse_numbers(page.values.photos),
		category: [page.parentId, Entity.category_map[0]],
		pinned: Entity.parse_numbers(page.values.pinned),
		permissions: [page.permissions, page.users],
	})
}

<!--/*
}(window)) //*/
