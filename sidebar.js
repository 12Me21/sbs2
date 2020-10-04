<!--/* trick indenter
var Sidebar = Object.create(null)
with (Sidebar) (function($) { "use strict"
Object.assign(Sidebar, { //*/

selectedFile: null,

scroller: null,
prePrint: [],

sidebarPanels: null,

selectTab: null,

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
		file && fileUploaded(file)
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
	scroller = new Scroller($sidebarScroller.parentNode, $sidebarScroller)
	prePrint.forEach(function(x) {
		print(x)
	})
	prePrint = null
	// todo: maybe a global ESC handler?
	/*document.addEventListener('keydown', function(e) {
		
	  })*/
	sidebarPanels = [
		$sidebarActivityPanel,
		//$sidebarWatchingPanel,
		$sidebarFilePanel,
		$sidebarSearchPanel,
	]
	sidebarPanels.forEach(function(e, i) {
		e.setAttribute('role', "tabpanel")
		e.setAttribute('aria-labelledby', "sidebar-tab-"+i)
		e.hidden = true
	})
	var sidebarTabs = Draw.sidebarTabs([
		{label: "activity", elem: $sidebarActivityPanel},
		/*{label: "watching"},*/
		{label: "image", elem: $sidebarFilePanel},
		{label: "search", elem: $sidebarSearchPanel},
	])
	$sidebarTabs.replaceChildren(sidebarTabs.elem)
	sidebarTabs.select(0)
	selectTab = sidebarTabs.select

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
		if (aggregate[id].content) //HACK
			items.push(aggregate[id])
	items.sort(function(a, b) {
		return -(a.lastDate - b.lastDate)
	})
	$sidebarActivityPanel.replaceChildren()
	items.forEach(function(item) {
		$sidebarActivityPanel.appendChild(Draw.activityItem(item))
	})
},

onWatchingChange: function(aggregate) {
	/*var items = []
	for (var id in aggregate)
		if (aggregate[id].content) //HACK
			items.push(aggregate[id])
	items.sort(function(a, b) {
		return -(a.lastDate - b.lastDate)
	})
	$sidebarWatchingPanel.replaceChildren()
	items.forEach(function(item) {
		$sidebarWatchingPanel.appendChild(Draw.activityItem(item))
	})*/
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
	selectTab(1)
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
