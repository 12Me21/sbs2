<!--/* trick indenter
var Sidebar = Object.create(null)
with (Sidebar) (function($) { "use strict"
Object.assign(Sidebar, { //*/

selectedFile: null,

scroller: null,
prePrint: [],

sidebarPanels: null,

selectTab: null,

intervalId: null,

myAvatar: null,

refreshInterval: function(data) {
	if (intervalId) {
		$.clearInterval(intervalId)
		intervalId = null
	}
	intervalId = $.setInterval(function() {
		Draw.updateTimestamps($sidebarActivity)
	}, 1000*30)
},

updateActivityTimestamps: function() {
	
},

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
		$sidebarNavPanel,
		//$sidebarWatchingPanel,
		$sidebarFilePanel,
		//$sidebarSearchPanel,
	]
	sidebarPanels.forEach(function(e, i) {
		e.setAttribute('role', "tabpanel")
		e.setAttribute('aria-labelledby', "sidebar-tab-"+i)
		e.hidden = true
	})
	var x = document.createElement('span')
	var y = x.createChild('span')
	myAvatar = x.createChild('span')
	myAvatar.className += " loggedIn fill"
	y.className += " loggedOut"
	y.textContent = "log in"
	var sidebarTabs = Draw.sidebarTabs([
		{label: document.createTextNode("activity"), elem: $sidebarActivityPanel},
		{label: document.createTextNode("navigate"), elem: $sidebarNavPanel},
		/*{label: "watching"},*/
		{label: document.createTextNode("image"), elem: $sidebarFilePanel},
		//{label: document.createTextNode("search"), elem: $sidebarSearchPanel},
		{label: x, elem: $sidebarUserPanel},
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
	$sidebarActivity.replaceChildren()
	items.forEach(function(item) {
		$sidebarActivity.appendChild(Draw.activityItem(item))
	})
	refreshInterval(aggregate)
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
			displayedMessages++
			limitMessages()
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
	selectTab(2) //hack
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

displayedMessages: 0,

displayedIds: {},

displayMessages: function(comments, initial) {
	scroller.handlePrint(function() {
		comments.forEach(function(c) {
			if (c.deleted) {
				var del = displayedIds[c.id]//scroller.inner.querySelector("scroll-inner > *[data-id='"+c.id+"']")
				if (del) {
					del.remove()
					delete displayedIds[c.id]
					displayedMessages--
				}
			} else {
				var old = displayedIds[c.id]
				var nw = Draw.sidebarComment(c)
				if (old) {
					old.parentNode.replaceChild(nw, old)
				} else {
					scroller.inner.appendChild(nw)
					displayedMessages++
				}
				displayedIds[c.id] = nw
				limitMessages()
			}
		})
	}, !initial)
},

limitMessages: function() {
	while (displayedMessages > 500) {
		var n = scroller.inner.firstChild
		var id = n.getAttribute('data-id')
		if (id)
			delete displayedIds[id]
		n.remove()
		displayedMessages--
	}
}

<!--/* 
}) //*/

<!--/*
}(window)) //*/ // pass external values

window.print = Sidebar.print
