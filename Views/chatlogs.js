<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('chatlogs', {
	init: function() {
	},
	start: function(id, query, render) {
		var search = {limit: 100}
		if (query.t)
			search.contentLike = "%"+query.t+"%"
		if (query.pid)
			search.parentIds = query.pid.split(",").map(Number) //whatever
		if (query.uid)
			search.userIds = query.uid.split(",").map(Number)
		return Req.read([
			{comment: search},
			"content.0parentId",
			"user.0createUserId",
		], {}, function(e, resp){
			if (e) return render(null)
			render(resp.comment)
		})
	},
	className: 'chatlogs',
	render: function(comments) {
		$chatlogSearchResults.replaceChildren()
		comments.forEach(function(c) {
			$chatlogSearchResults.appendChild(Draw.searchComment(c))
		})
		//TODO: results are links to chatlog viewer which lets you load surrounding messages etc.
		// show page name etc.
	},
	cleanUp: function() {
	},
})

<!--/*
}(window)) //*/
