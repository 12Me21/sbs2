<!--/* trick indenter
with (View) (function($) { "use strict" //*/

var userSelector

addView('chatlogs', {
	init: function() {
		userSelector = Draw.permissionInput(true)
		$chatlogSearchUserSelect.replaceChildren(userSelector.element)
		
		$chatlogSearchText.onkeypress = $chatlogSearchRoom.onkeypress = function(e) {
			if (!e.shiftKey && e.keyCode == 13) {
				e.preventDefault()
				$chatlogSearchButton.click()
			}				
		}
		
		// hack to make pressing enter in the user selector submit the search when the input box is empty
		userSelector.element.querySelector('input').addEventListener('keypress', function(e) {
			if (!e.shiftKey && e.keyCode == 13 && e.target.value=="") {
				e.preventDefault()
				e.stopPropagation()
				$chatlogSearchButton.click()
			}
		}, true)

		$chatlogSearchForm.onsubmit = function(e) {
			e.preventDefault()
			var query = {}
			query.t = $chatlogSearchText.value || undefined
			query.pid = $chatlogSearchRoom.value || undefined
			query.uid = userSelector.getUsers().join(",") || undefined
			Nav.go("chatlogs"+Req.queryString(query))
		}
	},
	start: function(id, query, render, quick) {
		var search = {limit: 100, reverse: true}
		if (query.t)
			search.contentLike = "%\n%"+query.t+"%" // todo: add an option to use %query% instead, for searching messages without proper metadata..
		if (query.pid)
			search.parentIds = query.pid.split(",").map(Number) //whatever
		if (query.uid)
			search.userIds = query.uid.split(",").map(Number)
		if (!(query.t || query.pid || query.uid)) {
			quick(function(){
				setTitle("Chatlogs")
				$chatlogSearchResults.textContent = "(no search)"
			})
			return
		}
		var chain = [
			{comment: search},
			"content.0parentId",
			"user.0createUserId",
		]
		if (search.userIds) {
			chain.push({"user~Usearch": {ids: search.userIds}});
		}
		
		return Req.read(chain, {}, function(e, resp){
			if (e) return render(null)
			render(resp.comment, query, resp.content, resp.userMap)
		})
	},
	className: 'chatlogs',
	render: function(comments, query, pages, users) {
		setTitle("Chatlogs")
		var map = Entity.makePageMap(pages)
		$chatlogSearchText.value = query.t || ""
		$chatlogSearchRoom.value = query.pid || ""
		userSelector.setUsers(query.uid.split(",").map(Number), users)
		
		$chatlogSearchResults.replaceChildren()
		comments.forEach(function(c) {
			c.parent = map[c.parentId]
			$chatlogSearchResults.appendChild(Draw.searchComment(c))
		})
		if (!comments.length) {
			$chatlogSearchResults.textContent = "(no results)"
		}
		//TODO: results are links to chatlog viewer which lets you load surrounding messages etc.
		// show page name etc.
	},
	cleanUp: function() {},
})

<!--/*
}(window)) //*/
