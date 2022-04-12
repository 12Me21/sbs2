// todo: should have some indicator whether the input fields reflect the current search results or have been edited

View.add_view('comments', {
	form: null,
	
	early() {
		this.form = new Form({
			fields: [
				['search', 'text', {label: "Search", convert: CONVERT.string, param: 's'}],
				['pages', 'number_list', {label: "Page Ids", convert: CONVERT.number_list, param: 'pid'}],
				['users', 'number_list', {label: "User Ids", convert: CONVERT.number_list, param: 'uid'}],
				['start', 'date', {label: "Start Date", convert: CONVERT.date, param: 'start'}],
				['end', 'date', {label: "End Date", convert: CONVERT.date, param: 'end'}],
				['range', 'range', {label: "Id Range", convert: CONVERT.range, param: 'ids'}],
				['reverse', 'checkbox', {label: "Newest First", convert: CONVERT.flag, param: 'r'}],
			]
		})
	},
	
	init() {
		$commentSearchForm.replaceWith(this.form.elem)
		$commentSearchButton.onclick = ()=>{
			let data = this.form.get()
			let name = "comments"
			if (data.pages && data.pages.length==1) {
				name += "/"+data.pages[0]
				delete data.pages
			}
			let query = this.form.to_query(data)
			window.location.hash = "#"+name+query// todo: proper function
		}
		View.bind_enter($commentSearch, $commentSearchButton.onclick)
	},
	start(id, query) {
		let data = this.form.from_query(query)
		if (id)
			data.pages = [id]
		let [search, merge] = this.build_search(data)
		
		if (!search)
			return {quick: true, ext: {data}}
		
		return {
			chain: search,
			ext: {data, merge},
		}
	},
	quick({data}) {
		View.set_title("Comments")
		this.form.set(data)
		$commentSearchResults.fill()
		$commentSearchResults.textContent = "(no query)"
	},
	render(resp, {data, merge}) {
		let comments = resp.message
		let pages = resp.content
		
		View.set_title("Comments")
		this.form.set(data)
		
		$commentSearchResults.fill()
		if (!comments.length) {
			$commentSearchResults.textContent = "(no results)"
		} else {
			if (merge) {
				let last_time = 0
				for (let comment of comments) {
					if (comment.deleted)
						continue
					let part = Draw.message_part(comment)
					Draw.insert_comment_merge($commentSearchResults, part, comment, last_time, false)
					last_time = comment.createDate
				}
			} else {
				for (let c of comments) {
					let parent = pages[~c.contentId]
					$commentSearchResults.append(Draw.search_comment(c, parent))
					// idea:
					// put all these into a normal comment scroller
					// then add some kind of "history separator" between
					// them, which gets deleted if enough messages are loaded so that the ids overlap
				}
			}
		}
	},
	cleanup() {
		$commentSearchResults.fill()
	},
	
	build_search(data) {
		// check if form is empty
		if (!data.search && !(data.users && data.users.length) && !data.range && !data.start && !data.end)
			return [null, null]
		
		let values = {}
		let query = []
		let order = "id"
		
		let merge = true
		
		if (data.reverse) {
			order = "id_desc"
			merge = false
		}
		let text = data.search
		if (text) {
			values.text = `%${text}%`
			query.push("text LIKE @text")
			merge = false
		}
		if (data.pages) {
			values.pids = data.pages.join(",")
			query.push("contentId = @pids")
		}
		if (data.users) { // todo: is an empty list [] or null?
			values.uids = data.users
			query.push("createUserId IN @uids")
			merge = false
		}
		let range = data.range
		if (range) {
			if (range.ids) {
				values.ids = range.ids
				query.push("id IN @ids")
				if (range.ids.length > 1)
					merge = false
			} else {
				if (range.min != null) {
					values.min_id = range.min-1
					query.push("id > @min_id")
				} if (range.max != null) {
					values.max_id = range.max+1
					query.push("id < @max_id")
				}
			}
		}
		if (data.start) {
			values.start = data.start.toISOString()
			query.push("createDate > @start") // should these be ≥/≤?
		}
		if (data.end) {
			values.end = data.end.toISOString()
			query.push("createDate < @end")
		}
		
		return [
			{
				values,
				requests: [
					{type:'message', fields:'*', query:query.join(" AND ")},
					{type:'content', fields:'name,id,createUserId', query:"id in @message.contentId"},
					{type:'user', fields:'*', query:"id IN @message.createUserId OR id IN @content.createUserId"}
				]
			},
			merge,
		]
	},
})

View.add_view('chatlogs', {
	redirect: (id, query)=>{
		let q = {r: true}
		// we do it this way so the ORDER is preserved :D
		for (let key in query) {
			if (key=='t')
				q.s = query.t // name changed
			else if (key=='pid')
				q.pid = query.pid
			else if (key=='uid')
				q.uid = query.uid
		}
		// switch to "comments/<id>" url if there is one pid
		id = null
		if (q.pid) {
			let pids = CONVERT.number_list.decode(q.pid)
			if (pids && pids.length==1) {
				delete q.pid
				id = pids[0]
			}
		}
		return ['comments', id, q]
	},
	//TODO: results are links to chatlog viewer which lets you load surrounding messages etc.
	// show page name etc.
})

