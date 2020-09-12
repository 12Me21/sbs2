<!--/* trick indenter
var Sidebar = Object.create(null)
with (Sidebar) (function($) { "use strict"
Object.assign(Sidebar, { //*/

selectedFile: null,

onLoad: function() {
	$openSidebar.onclick = $closeSidebar.onclick = toggle
	View.attachResize($sidebar, $sidebarResize, true, -1, "sidebarWidth")
	View.attachResize($sidebarTop, $sidebarResize, false, 1, "sidebarPinnedHeight")
	View.flag('sidebar', true)
	View.attachPaste(function(file) {
		fileUploaded(file)
	})
	$imageUpload.onchange = function(e) {
		var file = this.files[0]
		if (file)
			fileUploaded(file)
	}
	$fileCancel.onclick = $fileDone.onclick = fileCancel
	$fileUpload.onclick = function() {
		if (selectedFile) {
			Req.uploadFile(selectedFile, function(file) {
				if (file) {
					View.flag('sidebarUploaded', true)
					$fileView.src = ""
					$fileView.src = Req.fileURL(file.id)
					$fileURL.value = Req.fileURL(file.id)
				} else {
				}
			})
		}
	}
	$fileURL.onclick = function() {
		$fileURL.select()
	}
	// todo: maybe a global ESC handler?
	/*document.addEventListener('keydown', function(e) {
		
	})*/
},

fileCancel: function() {
	selectedFile = null
	View.flag('sidebarFile', false)
	View.flag('sidebarUploaded', false)
	cleanUp()
},

cleanUp: function() {
	selectedFile = null
	$fileView.src = ""
},

fileUploaded: function(file) {
	View.flag('sidebarUploaded', false)
	View.flag('sidebarFile', true)
	$fileView.src = ""
	$fileView.src = URL.createObjectURL(file)
	selectedFile = file
	//fillFileFields(file)
},

toggle: function() {
	var fullscreen = isFullscreen()
	if (fullscreen) {
		View.flag('mobileSidebar', !View.flags.mobileSidebar)
	} else {
		View.flag('sidebar', !View.flags.sidebar)
		Store.set('sbs-sidebar', !!View.flags.sidebar)
	}
},

isFullscreen: function() {
	return !$.matchMedia || $.matchMedia("(max-width: 700px)").matches
},

<!--/* 
}) //*/


<!--/*
}(window)) //*/ // pass external values
