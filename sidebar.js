<!--/* trick indenter
var Sidebar = Object.create(null)
with (Sidebar) (function($) { "use strict"
Object.assign(Sidebar, { //*/

onLoad: function() {
	$openSidebar.onclick = $closeSidebar.onclick = toggle
	View.attachResize($sidebar, $sidebarPinnedResize, true, -1, "sidebarWidth")
	View.attachResize($sidebarPinned, $sidebarPinnedResize, false, -1, "sidebarPinnedHeight")
	View.flag('sidebar', true)
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
