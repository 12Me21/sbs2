<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('editpage', {
	init: function() {
		$editorTextarea.oninput = ()=>{updatePreview(true)}
		$markupSelect.onchange = ()=>{updatePreview(true)}
		$markupUpdate.onclick = ()=>{updatePreview(false)}
		$submitEdit.onclick = ()=>{
			submitEdit((e, resp)=>{
				if (!e) {
					Nav.go("page/"+resp.id)
				} else {
					alert("Error submitting page!")
				}
			})
		}
		$toggleEditorMode.onclick = ()=>{
			let e = View.flags.editorPreview
			View.flag('editorPreview', !e)
		}
		View.attachResize($editorPreviewPane, $editorPreviewResize, false, 1)
	},
	splitView: true,
	start: function(id, query, render) {
		if (id) { //edit existing page
			id = +id
			return Req.read([
				{content: {ids: [id]}},
				"user.0createUserId.0editUserId.0permissions",
			], {user: "id,username,avatar"}, (e, resp)=>{
				if (!e) {
					let page = resp.content[0]
					if (page)
						render(page, resp.userMap)
					else
						render(null)
				} else
					render(false)
			}, true)
		} else { //create new page
			if (Req.gotCategoryTree) {
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
				parent: Entity.categoryMap[query.cid || 0],
				name: query.name || "",
				type: query.type || "chat",
				content: "",
				permissions: {'0': "rc"},
				values: {
					markup: "12y",
				},
			})
		}
	},
	
	className: 'editpage',
	render(page) {
		form = new Form({
			fields: [
				{name: 'keywords', input: new INPUTS.word_list({label: "Keywords"})},
				{name: 'type', input: new INPUTS.select({label: "Type", options: [
					['resource',"Resource"],['chat',"Chat"],['program',"Program"],['tutorial',"Tutorial"],['documentation',"Documentation"]
				]})},
				{name: 'thumbnail', input: new INPUTS.number({label: "Thumbnail"})},
				{name: 'photos', input: new INPUTS.number_list({label: "Photos"})},
				{name: 'category', input: new INPUTS.category({label: "Category"})},
				{name: 'pinned', input: new INPUTS.number_list({label: "Pinned comments"})},
				{name: 'permissions', input: new INPUTS.permissions({label: "Permissions"})},
			]
		})
		$editPageForm.replaceChildren(form.elem)
		
		if (page.id) {
			setTitle("Editing Page")
			fillFields(page)
			editingPage = {id: page.id, values: page.values, permissions: page.permissions}
			setEntityPath(page)
		} else {
			setTitle("Creating Page")
			fillFields(page)
			editingPage = {}
			setEntityPath(page.parent)
		}
	},
	cleanUp: function() {
		$editorPreview.replaceChildren()
		editingPage = null
	},
})

var editingPage = null
var form = null

function submitEdit(callback) {
	if (!editingPage)
		return
	readFields(editingPage)
	Req.editPage(editingPage, callback)
}

function updatePreview() {
	let parent = $editorPreview
	let shouldScroll = parent.scrollHeight-parent.clientHeight-parent.scrollTop < 10
	$editorPreview.replaceChildren(Parse.parseLang($editorTextarea.value, $markupSelect.value, true))
	// auto scroll down when adding new lines to the end (presumably)
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

function fillFields(page) {
	$titleInput.value = page.name
	let markup
	if (page.values)
		markup = page.values.markupLang
	if (!markup)
		markup = "plaintext"
	$markupSelect.value = markup
	$editorTextarea.value = page.content
	updatePreview()
	
	form.set({
		keywords: page.keywords,
		type: page.type,
		thumbnail: page.values.thumbnail,
		photos: Entity.parse_numbers(page.values.photos)
		category: [page.parentId, Entity.categoryMap[0]],
		pinned: Entity.parse_numbers(page.values.pinned)
		permissions: [page.permissions, page.users]
	})
}

<!--/*
}(window)) //*/
