// oh I just realized...
// the function($){...}(window) trick won't work here
// because View has been initialized, so it COULD have a property named `window`...
	<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('image', {
	init: function() {
		var nav = $fileNav
		navButtons = Draw.navButtons()
		nav.appendChild(navButtons.element)
		navButtons.onchange = function(pageNum) {
			/*if (currentCategory == null)
				return*/
			currentQuery.page = pageNum
			Nav.go("image"+Req.queryString(currentQuery))
		}
					
		$setAvatarButton.onclick = function() {
			if (!selectedFile)
				return
			Req.setBasic({avatar: selectedFile.id}, function(user) {
				if (user) {
					// have to do this because rannnnnnnnnnndommmmmmm broke user activityyy
					updateMyUser(user)
				}
			})
		}
		$fileUpdateButton.onclick = function() {
			if (!selectedFile)
				return
			readFields(selectedFile)
			Req.putFile(selectedFile, function(e, resp) {
				resp.createUser = selectedFile.createUser //ehhhhh
				if (!e)
					selectFile(resp)
				//eh
			})
		}
	},
	start: function(id, query, render) {
		currentQuery = query
		var page = +query.page || 1
		navButtons.set(page)
		
		return Req.getFileView({}, page, render)
	},
	className: 'fileMode',
	render: function(files) {
		setTitle("Files")
		fileList = files
		files.forEach(function(file) {
			$fileBox.appendChild(Draw.fileThumbnail(file, selectFile))
		})
	},
	cleanUp: function() {
		$fileBox.replaceChildren()
		selectFile(null)
		fileList = null
	},
})

var fileList

function readFields(data) {
	data.permissions = JSON.safeParse($filePermissions.value)
	data.values = JSON.safeParse($fileValues.value)
	data.name = $fileName.value
}

function selectFile(file) {
	if (!file) {
		selectedFile = file
		flag('fileSelected', false)
		$filePageView.src = ""
		return
	}
	selectedFile = file
	$fileName.value = file.name
	$filePermissions.value = JSON.stringify(file.permissions)
	$fileValues.value = JSON.stringify(file.values)
	$fileUser.replaceChildren(Draw.entityTitleLink(file.createUser))
	$filePageView.src = ""
	$filePageView.src = Req.fileURL(file.id)
	//Draw.setBgImage($filePageView, Req.fileURL(file.id))
	flag('fileSelected', true)
	flag('canEdit', /u/.test(file.myPerms))
}

var selectedFile
var navButtons
var currentQuery

<!--/*
}(window)) //*/ // pass external values
