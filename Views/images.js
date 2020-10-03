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
			Req.setBasic({avatar: selectedFile.id}, function(e) {
				//todo?
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
		files.forEach(function(file) {
			$fileBox.appendChild(Draw.fileThumbnail(file, selectFile))
		})
	},
	cleanUp: function() {
		$fileBox.replaceChildren()
	},
})

function selectFile(file) {
	selectedFile = file
	$fileName.value = file.name
	$filePermissions.value = JSON.stringify(file.permissions)
	$fileValues.value = JSON.stringify(file.values)
	$fileUser.textContent = file.createUser.username
	$filePageView.src = ""
	$filePageView.src = Req.fileURL(file.id)
	//Draw.setBgImage($filePageView, Req.fileURL(file.id))
	flag('fileSelected', true)
	flag('canEdit', /u/.test(file.myPerms))
}

var selectedFile

<!--/*
}(window)) //*/ // pass external values
