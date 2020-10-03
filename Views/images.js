// oh I just realized...
// the function($){...}(window) trick won't work here
// because View has been initialized, so it COULD have a property named `window`...
	<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('images', {
	init: function() {
		var nav = $fileNav
		$setAvatarButton.onclick = function() {
			if (!selectedFile)
				return
			Req.setBasic({avatar: selectedFile.id}, function(e, resp) {
				if (!e) {
					// have to do this because rannnnnnnnnnndommmmmmm broke user activityyy
					var l = [resp]
					Entity.processList('user', l, {})
					updateMyUser(l[0])
				}
				//todo?
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
		//nav.replaceChildren(Draw.navButtons())
	},
	start: function(id, query, render) {
		var page = +query.page || 0
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

<!--/*
}(window)) //*/ // pass external values
