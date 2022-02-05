<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('comments', {
	init: function() {
		$commentSearchButton.onclick = function() {
			var query = read_inputs()
			// if searching a single page, we use "comments/<pid>", otherwise we use "comments" and set the "pid" query parameter.
			var name = "comments"
			if (query.pid && query.pid.split(",").length==1) {
				name += "/"+query.pid
				delete query.pid
			}
			Nav.go(name+query_string(query))
		}
		bind_enter($commentSearch, $commentSearchButton.onclick)
	},
	start: function(id, query, render, quick) {
		if (id)
			query.pid = String(id)
		console.log(query)
		var search = build_search(query)
		if (!search) {
			quick(function(){
				setTitle("Comments")
				write_inputs(query)
				$chatlogSearchResults.replaceChildren()
			})
			return;
		}
		return Req.read([
			{comment: search},
			"content.0parentId",
			"user.0createUserId",
		], {}, function(e, resp){
			if (e) return render(null)
			render(resp.comment, query, resp.content)
		})
	},
	className: 'comments',
	render: function(comments, query, pages) {
		setTitle("Comments")
		var map = Entity.makePageMap(pages)
		write_inputs(query)
		$commentSearchResults.replaceChildren()
		comments.forEach(function(c) {
			c.parent = map[c.parentId]
			$commentSearchResults.appendChild(Draw.searchComment(c))
		})
		if (!comments.length) {
			$commentSearchResults.textContent = "(no result)"
		}
	},
	cleanUp: function() {
		$commentSearchResults.replaceChildren()
	},
})

var fields = [
	['s', '$commentSearchText'],
	['pid', '$commentSearchRoom'],
	['uid', '$commentSearchUser'],
	['ids', '$commentSearchRange'],
	['start', '$commentSearchStart'],
	['end', '$commentSearchEnd'],
	['r', '$commentSearchReverse'],
]

function read_inputs() {
	var query = {}
	fields.forEach(function(x) {
		var elem = $[x[1]]
		if (elem.type=='checkbox') {
			if (elem.checked)
				 query[x[0]] = true
		} else {
			if (elem.value != "")
				query[x[0]] = elem.value
		}
	})
	return query
}

function write_inputs(query) {
	fields.forEach(function(x) {
		var val = query[x[0]]
		var elem = $[x[1]]
		if (elem.type=='checkbox')
			elem.checked = val
		else
			elem.value = val || ""
	})
}

function build_search(query) {
	var search = {limit: 200}
	if (!(query.s || query.uid || query.ids || query.start || query.end))
		return null
	if (query.r)
		search.reverse = true
	if (query.s)
		search.contentLike = "%\n%"+query.s+"%"
	if (query.pid)
		search.parentIds = query.pid.split(",").map(Number) //whatever
	if (query.uid)
		search.userIds = query.uid.split(",").map(Number)
	if (query.ids) {
		// either: 123-456
		// or      123-
		var match = query.ids.match(/^(\d+)(?:(-)(\d*))?$/)
		if (match) {
			var min = match[1]
			var dash = match[2]
			var max = match[3]
			search.minId = (+min)-1;
			if (max)
				search.maxId = (+max)+1;
			if (!dash)
				search.maxId = (+min)+1;
		}
	}
	if (query.start)
		search.createStart = query.start
	if (query.end)
		search.createStart = query.start
	return search
}

function query_string(obj) {
	if (!obj)
		return ""
	var items = []
	for (var key in obj) {
		var val = obj[key]
		if (typeof val == 'undefined')
			continue
		var item = $.encodeURIComponent(key)
		if (val === true)
			items.push(item)
		else
			items.push(item+"="+$.encodeURIComponent(val))
	}
	if (!items.length)
		return ""
	return "?"+items.join("&")
}

<!--/*
}(window)) //*/
