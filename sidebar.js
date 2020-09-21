<!--/* trick indenter
var Sidebar = Object.create(null)
with (Sidebar) (function($) { "use strict"
Object.assign(Sidebar, { //*/

selectedFile: null,

scroller: null,
prePrint: [],

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
	/*$.document.addEventListener("drop", function(e) {
		e.preventDefault()
		console.log(e,"drop")
	})
	$.document.addEventListener("dragover", function(e) {
		var items = e.dataTransfer.items
		if (items && items[0].kind == 'file') {
			console.log("FILE", items)
			e.preventDefault()
		}
	})*/
	$fileURL.onclick = function() {
		$fileURL.select()
	}
	scroller = new Scroller($sidebarScroller.parentNode, $sidebarScroller)
	prePrint.forEach(function(x) {
		print(x)
	})
	prePrint = null
	// todo: maybe a global ESC handler?
	/*document.addEventListener('keydown', function(e) {
		
	  })*/
	var sidebarPanels = [
		$sidebarActivityPanel,
		$sidebarPinnedPanel,
		$sidebarFilePanel,
		$sidebarSearchPanel,
	]
	sidebarPanels.forEach(function(e, i) {
		e.setAttribute('role', "tabpanel")
		e.setAttribute('aria-labelledby', "sidebar-tab-"+i)
		e.hidden = true
	})
	$sidebarTabs.replaceChildren(Draw.sidebarTabs([
		{label: "activity"}, {label: "watching"}, {label: "image"}, {label: "search"}
	], function(id) {
		selectTab(id)
	}))
	function selectTab(id) {
		sidebarPanels.forEach(function(panel, pid) {
			panel.hidden = pid!=id
		})
	}
	selectTab(0)

	$searchButton.onclick = function() {
		$searchButton.disabled = true
		Req.search1($searchInput.value, function(users, pages) {
			$searchButton.disabled = false
			$searchResults.replaceChildren()
			pages.forEach(function(item) {
				var bar = Draw.pageBar(item)
				bar.className += " linkBar bar rem1-5"
				$searchResults.appendChild(bar)
			})
			console.log(pages)
			users.forEach(function(item) {
				var bar = Draw.entityTitleLink(item)
				bar.className += " linkBar bar rem1-5"
				$searchResults.appendChild(bar)
			})
		})
	}
	$searchInput.onkeypress = function(e) {
		if (!e.shiftKey && e.keyCode == 13) {
			e.preventDefault()
			$searchButton.onclick()
		}
	}
},
// todo: currently this uses "time ago" so those times need to be updated occasionally
onAggregateChange: function(aggregate) {
	var items = []
	for (var id in aggregate)
		items.push(aggregate[id])
	items.sort(function(a,b){
		return -(a.lastDate - b.lastDate)
	})
	$sidebarActivityPanel.replaceChildren()
	items.forEach(function(item) {
		$sidebarActivityPanel.appendChild(Draw.activityItem(item))
	})

},

print: function(text) {
	if (scroller)
		scroller.handlePrint(function() {
			return Draw.sidebarDebug(text)
		}, true)
	else
		prePrint.push(text)	
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
