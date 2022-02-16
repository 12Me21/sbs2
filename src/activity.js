// make a class for activity list
// render new page block only when page added to list
// handle updating existing page blocks (updating users list, time, etc.)
// use this for activity and watchlist

let Act = {
	items: {},
	
	redraw() {
		Sidebar.onAggregateChange(this.items)
	},
	
	pullRecent() {
		// bad arguments :(
		Req.getRecentActivity((e, resp)=>{
			print("got recent activity")
			if (!e) {
				let p = Entity.makePageMap(resp.content)
				this.newActivity(resp.activity, p)
				this.newComments(resp.Mall, p)
				this.newActivity(resp.Awatching, p, true)
				//newCommentAggregate(wc, p, true)
				this.redraw()
				Sidebar.displayMessages(resp.comment.reverse(), true)
			}
		})
	},
	
	// ew
	// this system merges Activity, Comment, ~and CommentAggregate~
	// so we need these ~3~ 2 awful functions to handle them slightly differently
	
	newComments(comments, pageMap, watch) {
		comments.forEach((c)=>{
			let id = c.parentId
			let item = this.getItem(id, pageMap, c.editDate)
			if (watch)
				item.watching = true
			// todo: commentaggregate only tracks createDate
			// so maybe use that here for consistency between reloads
			this.userUpdate(item, c.editUser, c.editDate)
			item.count++
			if (c.editDate < item.firstDate)
				item.firstDate = c.editDate
			if (c.editDate > item.lastDate)
				item.lastDate = c.editDate
		})
	},
	
	// this ONLY updates the order of users in the list
	// this should NOT add page to activity items if it isn't there already
	// problem: this can be called before initial activity data is loaded
	// so this function doesn't work on the first page you visit
	newPageComments(page, comments) {
		let item = this.items[page.id]
		if (!item) //old page
			return
		comments.forEach((c)=>
			this.userUpdate(item, c.editUser, c.editDate))
	},
	
	newActivity(activity, pageMap, watch) {
		activity.forEach((a)=>{
			let id = a.contentId
			let item = this.getItem(id, pageMap, a.date)
			// hopefully this takes care of pages in activity list being updated?
			if (pageMap[id])
				item.content = pageMap[id]
			if (watch)
				item.watching = true
			this.userUpdate(item, a.user, a.date)
			item.count++
			if (a.date < item.firstDate)
				item.firstDate = a.date
			if (a.date > item.lastDate)
				item.lastDate = a.date
		})
	},
	
	getItem(id, pageMap, date) {
		if (this.items[id])
			return this.items[id]
		return this.items[id] = {
			content: pageMap[id],
			users: [],
			count: 0,
			firstDate: date,
			lastDate: date,
		}
	},
	//todo: somewhere we are getting Fake users with uid 0/
	// found on page 2870 date Sun Nov 08 2020 17:55:52 GMT-0500
	// AFTER loading comments
	// most likely a deleted comment.
	// perhaps just filter those out immediately
	
	// add or move+update user to start of list
	userUpdate(item, user, date) {
		if (!user) return // just in case
		// remove old user
		for (let i=0; i<item.users.length; i++)
			if (item.users[i].user.id == user.id) {
				if (date <= item.users[i].date) //old user has newer date, don't remove
					return
				item.users.splice(i, 1)
				break
			}
		// insert new user
		let i
		for (i=0; i<item.users.length; i++)
			if (date >= item.users[i].date)
				break
		item.users.splice(i, 0, {user:user, date:date})
		// temp fix maybe? mark unsorted users and render them differentlyyy
		/*if (!date && !user.unsorted)
		  user = Object.create(user, {unsorted: {value: true}})*/
	},
}
