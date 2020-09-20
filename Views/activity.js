<!--/* trick indenter
with (View) (function($) { "use strict" //*/

function ren(aggregate) {
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

addView('activity', {
	init: function() {
	},
	start: function(id, query, render, quick) {
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
