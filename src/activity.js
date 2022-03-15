// make a class for activity list
// render new page block only when page added to list
// handle updating existing page blocks (updating users list, time, etc.)
// use this for activity and watchlist

let Act = {
	// this is a list of activity items
	// i.e. pages with recent activity, displayed in the sidebar
	items: {},
	
	// might be worth speeding up in entity.js (100ms)
	pull_recent() {
		let day = 1000*60*60*24
		let start = new Date(Date.now() - day).toISOString()
		// "except no that won't work if site dies lol"
		Req.chain([
			['activity', {createStart: start}],
			['comment~Mall', {reverse: true, limit: 1000}],
			['activity~Awatching', {contentLimit:{watches:true}}],
			['content.0contentId.1parentId.2contentId'],
			['comment', {limit: 50, reverse: true, createStart: start}],
			['user.0userId.1editUserId.2userId.4createUserId'],
		], {
			content: 'name,id,permissions,type',
			Mall: 'parentId,editUserId,editDate',
		}).then(({activity, Mall, Awatching, content, comment})=>{
			console.log('🌄 got initial activity')
			do_when_ready(()=>{
				this.process_stuff(activity, Mall, Awatching, content)
				Sidebar.display_messages(comment.reverse(), true)
			})
		}, (e, resp)=>{
			print("initial activity failed!")
		})
	},
	
	// if an item exists for that id, return it
	// otherwise create a new one and return it
	get_item(id, pageMap, date) {
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
		Sidebar.on_aggregate_change(this.items)
	},
	
	process_stuff(act, comments, watching, pages) {
		if (act || comments || watching) {
			let p = Entity.page_map(pages)
			act && this.new_activity(act, p)
			comments && this.new_comments(comments, p)
			watching && this.new_activity(watching, p, true)
			this.redraw()
		}
	},
	
	// ew
	// this system merges Activity, Comment, ~and CommentAggregate~
	// so we need these ~3~ 2 awful functions to handle them slightly differently
	
	// this gets called when you visit a page and load the recent comments
	// if that page is in the activity list, we update its userlist
	// but, if the page isn't there, we don't add it, because it's old
	// problem: this can be called before initial activity data is loaded
	// so this function doesn't work on the first page you visit - TODO
	new_page_comments(page, comments) {
		let item = this.items[page.id]
		if (!item) //old page
			return
		for (let {editUser, editDate} of comments)
			this.user_update(item, editUser, editDate)
	},
	
	new_thing(id, date, user, pageMap, watch, update_pages) {
		let item = this.get_item(id, pageMap, date)
		if (update_pages && pageMap[id]) // hopefully this takes care of pages in activity list being updated? (i think we only need to do this on new_activity not new_comments)
			item.content = pageMap[id]
		if (watch)
			item.watching = true
		this.user_update(item, user, date)
		item.count++
		if (date < item.firstDate)
			item.firstDate = date
		if (date > item.lastDate)
			item.lastDate = date
	},
	
	new_comments(comments, pageMap, watch) {
		// todo: commentaggregate only tracks createDate
		// so maybe use that here for consistency between reloads
		for (let {parentId, editDate, editUser, deleted} of comments)
			this.new_thing(parentId, editDate, editUser, pageMap, watch, false)
	},
	
	new_activity(activity, pageMap, watch) {
		for (let {contentId, date, user, type} of activity)
			if (type == 'content')
				this.new_thing(contentId, date, user, pageMap, watch, true)
	},
	
	//todo: somewhere we are getting Fake users with uid 0/
	// found on page 2870 date Sun Nov 08 2020 17:55:52 GMT-0500
	// AFTER loading comments
	// most likely a deleted comment.
	// perhaps just filter those out immediately
	
	// add or move+update user to start of list
	// todo: this is probably really bad when called a lot of times
	// for the initial comments.
	// would maybe be better to just sort the list after that
	user_update(item, user, date) {
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
Object.seal(Act)
