<!--/* trick indenter
with (View) (function($) { "use strict" //*/

function ren(aggregate) {
	setTitle("Recent Activity")
	$activity.replaceChildren()
	var items = []
	for (var id in aggregate)
		items.push(aggregate[id])
	items.sort(function(a,b){
		return -(a.lastDate - b.lastDate)
	})
	items.forEach(function(item) {
		$activity.appendChild(Draw.activityItem(item))
	})
}

//todo: show "created", "edited", commented on, etc.

// this should go in sidebar instead of page type later (or in addition to, for logged out users! or on homepage)
// anyway sidebar layout
// top section: fixed, tabbed view. show recent activity, notifications, umm.. image uploader, etc.
// bottom section: live feed of all site activity, console messages, etc. ?

addView('activity', {
	init: function() {
	},
	start: function(id, query, render, quick) {
		// this is a big hack
		// should just wait for log in
		if (Object.keys($.aggregate).length) {
			quick(function() {
				ren($.aggregate)
			})
		} else {
			return Req.getRecentActivity(render)
		}
	},
	className: 'activity',
	render: function(aggregate) {
		ren(aggregate)
	},
	cleanUp: function() {
		$activity.replaceChildren()
	},
})

<!--/*
}(window)) //*/ // pass external values
