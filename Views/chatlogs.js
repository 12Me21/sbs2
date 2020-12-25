<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('chatlogs', {
	init: function() {
		//var sel = Draw.userSelector()
		//$chatlogSearchUser.replaceChildren(sel.elem)
		$chatlogSearchButton.onclick = function() {
			var query = {}
			query.t = $chatlogSearchText.value
			query.pid = $chatlogSearchRoom.value
			query.uid = $chatlogSearchUser.value
			Nav.go("chatlogs"+Req.queryString(query))
		}
	},
	start: function(id, query, render) {
		var search = {limit: 100, reverse: true}
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
			render(resp.comment, query, resp.content)
		})
	},
	className: 'chatlogs',
	render: function(comments, query, pages) {
		var map = Entity.makePageMap(pages)
		$chatlogSearchText.value = query.t || ""
		$chatlogSearchRoom.value = query.pid || ""
		$chatlogSearchUser.value = query.uid || ""

		$chatlogSearchResults.replaceChildren()
		comments.forEach(function(c) {
			c.parent = map[c.parentId]
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
