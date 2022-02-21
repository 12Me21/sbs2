// make a class for activity list
// render new page block only when page added to list
// handle updating existing page blocks (updating users list, time, etc.)
// use this for activity and watchlist

let Act = {
	items: {},
	// aaa i wish i could use the proxy system here but the extra date argument...
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
	
	redraw() {
		Sidebar.onAggregateChange(this.items)
	},
	
	pullRecent() {
		// bad arguments :(
		Req.getRecentActivity((e, resp)=>{
			print("got recent activity")
			// todo: if we switch to separate callbacks for success/error, we can use parameter destructuring!
			if (!e) {
				this.process_stuff(resp.activity, resp.Mall, resp.Awatching, resp.content)
				Sidebar.displayMessages(resp.comment.reverse(), true)
			}
		})
	},
	
	process_stuff(act, comments, watching, pages) {
		if (act || comments || watching) {
			let p = Entity.page_map(pages)
			act && this.newActivity(act, p)
			comments && this.newComments(comments, p)
			watching && this.newActivity(watching, p, true)
			this.redraw()
		}
	},
	
	// ew
	// this system merges Activity, Comment, ~and CommentAggregate~
	// so we need these ~3~ 2 awful functions to handle them slightly differently
	
	// this ONLY updates the order of users in the list
	// this should NOT add page to activity items if it isn't there already
	// problem: this can be called before initial activity data is loaded
	// so this function doesn't work on the first page you visit
	newPageComments(page, comments) {
		let item = this.items[page.id]
		if (!item) //old page
			return
		comments.forEach((c)=>
			this.userUpdate(item, c.editUser, c.editDate)) //nice formatting
	},
	
	newThing(id, date, user, pageMap, watch, update_pages) {
		let item = this.getItem(id, pageMap, date)
		if (update_pages && pageMap[id]) // hopefully this takes care of pages in activity list being updated? (i think we only need to do this on newActivity not newComments)
			item.content = pageMap[id]
		if (watch)
			item.watching = true
		this.userUpdate(item, user, date)
		item.count++
		if (date < item.firstDate)
			item.firstDate = date
		if (date > item.lastDate)
			item.lastDate = date
	},
	
	newComments(comments, pageMap, watch) {
		// todo: commentaggregate only tracks createDate
		// so maybe use that here for consistency between reloads
		for (let c of comments)
			this.newThing(c.parentId, c.editDate, c.editUser, pageMap, watch, false)
	},
	
	newActivity(activity, pageMap, watch) {
		for (let a of activity)
			this.newThing(a.contentId, a.date, a.user, pageMap, watch, true)
	},
	
	//todo: somewhere we are getting Fake users with uid 0/
	// found on page 2870 date Sun Nov 08 2020 17:55:52 GMT-0500
	// AFTER loading comments
	// most likely a deleted comment.
	// perhaps just filter those out immediately
	
	// add or move+update user to start of list
	userUpdate(item, user, date) {
		if (!user) return // just in case
		// i really hate this code
		
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
