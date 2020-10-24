<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('editpage', {
	init: function() {
		$editorTextarea.oninput = function() {
			updatePreview(true)
		}
		$markupSelect.onchange = function() {
			updatePreview(true)
		}
		$markupUpdate.onclick = function() {
			updatePreview(false)
		}
		$submitEdit.onclick = function() {
			submitEdit(function(e, resp) {
				if (!e) {
					Nav.go("page/"+resp.id)
				} else {
					alert("Error submitting page!")
				}
			})
		}
		categoryInput = Draw.categoryInput()
		permissionInput = Draw.permissionInput()
		$editPageCategory.replaceChildren(categoryInput.element)
		$editPagePermissions.replaceChildren(permissionInput.element)
	},
	
	start: function(id, query, render) {
		if (id) { //edit existing page
			id = +id
			return Req.read([
				{content: {ids: [id]}},
				"user.0createUserId.0editUserId.0permissions",
			], {user: "id,username,avatar"}, function(e, resp) {
				if (!e) {
					var page = resp.content[0]
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
				return {abort:function(){}}
			} else { //need to request category tree for page editor
				return Req.read([], {}, function(e, resp) {
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
				name: query.name,
				type: query.type
			})
		}
	},
	
	className: 'editorMode',
	render: function(page) {
		categoryInput.update()
		if (page.id) {
			setTitle("Editing Page")
			fillFields(page)
			editingPage = {id: page.id, values: page.values, permissions: page.permissions}
			setEntityPath(page)
		} else {
			setTitle("Creating Page")
			resetFields(page)
			editingPage = {}
			setEntityPath(page.parent)
		}
	},
	cleanUp: function() {
		$editorPreview.replaceChildren()
		editingPage = null
	},
})

var categoryInput = null
var editingPage = null
var permissionInput = null

function submitEdit(callback) {
	if (!editingPage)
		return
	readFields(editingPage)
	Req.editPage(editingPage, callback)
}

function updatePreview() {
	var parent = $editorPreview
	var shouldScroll = parent.scrollHeight-parent.clientHeight-parent.scrollTop < 10
	$editorPreview.replaceChildren(Parse.parseLang($editorTextarea.value, $markupSelect.value, true))
	// auto scroll down when adding new lines to the end (presumably)
	if (shouldScroll)
		parent.scrollTop = parent.scrollHeight-parent.clientHeight
}

function resetFields(page) {
	$titleInput.value = page.name || ""
	$markupSelect.value = '12y'
	$editorTextarea.value = ""
	updatePreview()
	$keywords.value = ""
	if (page.type && validTypes.indexOf(page.type)<0) {
		$editPageTypeOption.value = page.type
		$editPageTypeOption.textContent = page.type
		$editPageTypeOption.hidden = false
	} else
		$editPageTypeOption.hidden = true
	$editPageType.value = page.type || ""
	if (page.parent)
		categoryInput.set(page.parent.id)
	else
		categoryInput.set(-1)
	permissionInput.set({'0':"r"},{})
}

function readFields(page) {
	page.name = $titleInput.value
	if (!page.values)
		page.values = {}
	page.values.markupLang = $markupSelect.value
	page.content = $editorTextarea.value
	if ($keywords.value)
		var keywords = $keywords.value.split(" ")
	else
		keywords = []
	page.keywords = keywords
	page.type = $editPageType.value
	page.parentId = categoryInput.get()
	page.permissions = permissionInput.get()
	var photos = $editPagePhotos.value
	if (photos)
		page.values.photos = photos
	var thumbnail = +$editPageThumbnail.value
	if (thumbnail)
		page.values.thumbnail = thumbnail
}

function fillFields(page) {
	$titleInput.value = page.name
	if (page.values)
		var markup = page.values.markupLang
	if (!markup)
		markup = "plaintext"
	$markupSelect.value = markup
	$editorTextarea.value = page.content
	updatePreview()
	$keywords.value = page.keywords.join(" ")
	$editPagePhotos.value = page.values.photos
	$editPageThumbnail.value = page.values.thumbnail
	if (validTypes.indexOf(page.type)<0) {
		$editPageTypeOption.value = page.type
		$editPageTypeOption.textContent = page.type
		$editPageTypeOption.hidden = false
	} else
		$editPageTypeOption.hidden = true
	$editPageType.value = page.type
	categoryInput.set(page.parentId)
	permissionInput.set(page.permissions, page.users)
}

var validTypes = ['resource','chat','program','tutorial','documentation']

<!--/*
}(window)) //*/ // pass external values
