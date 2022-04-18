let Act

class ActivityItem {
	constructor(content) {
		this.content = content
		this.users = {}
		this.date = "0"
		this.elem = this.constructor.HTML()
		this.user_elem = this.elem.lastChild.lastChild
		this.page_elem = this.elem.firstChild
		Draw.update_activity_page(this)
		Act.container.prepend(this.elem)
	}
	top() {
		if (this.elem.previousSibling)
			Act.container.prepend(this.elem)
	}
	update_date(date) {
		if (date > this.date) {
			this.date = date
			this.top()
		}
	}
	update_content(content) {
		if (content.lastRevisionId > this.content.lastRevisionId) {
			this.content = content
			Draw.update_activity_page(this)
		}
	}
	update_user(uid, user, date) {
		// hmm user is almost identical to ActivityItem. could reuse class for both?
		if (!user) {
			console.warn('update user uid?', uid)
			return
		}
		let u = this.users[uid] || (this.users[uid] = {user, date:"0", elem: Draw.link_avatar(user)})
		if (date > u.date) { // todo: update user object. why don't users have editDate...
			if (u.date=="0" || u.elem.previousSibling) // hack
				this.user_elem.prepend(u.elem)
			u.date = date
		}
	}
}
ActivityItem.get = function(map, id, content, date) {
	let item = map[id] || (map[id] = new this(content))
	item.update_content(content)
	item.update_date(date)
	return item
}
ActivityItem.HTML = 𐀶`
<a class='activity-page'>
	<div class='bar rem1-5 ellipsis'></div>
	<div class='bar rem1-5 activity-page-bottom'>
		<time class='time-ago ellipsis'></time>
		<activity-users class='grow'>
`

// make a class for activity list
// render new page block only when page added to list
// handle updating existing page blocks (updating users list, time, etc.)
// use this for activity and watchlist
Act = function(){"use strict"; return singleton({
	// this is a list of activity items
	// i.e. pages with recent activity, displayed in the sidebar
	items: {},
	
	container: document.createElement('scroll-inner'),
	
	pull_recent() {
		let start = new Date()
		start.setDate(start.getDate() - 1)
		Lp.chain({
			values: {
				yesterday: start,
			},
			requests: [
				{type:'message_aggregate', fields:'contentId, createUserId, maxCreateDate, maxId', query:"createDate > @yesterday"},
				{type:'message', fields:'*', query:"!notdeleted()", order:'id_desc', limit:50},
				{type:'content', fields:'name, id, permissions, contentType, lastRevisionId', query:"id IN @message_aggregate.contentId OR id IN @message.contentId"},
				{type:'user', fields:'*', query:"id IN @message_aggregate.createUserId OR id IN @message.createUserId"},
				// todo: activity
			]
		}, (objects)=>{
			console.log('🌄 got initial activity')
			Entity.ascending(objects.message, 'id')
			Sidebar.display_messages(objects.message, true) // TODO: ensure that these are displayed BEFORE any websocket new messages
			
			objects.message_aggregate.sort((a,b)=>a.maxId-b.maxId)
			for (let x of objects.message_aggregate)
				this.message_aggregate(x, objects)
		})
	},
	
	message_aggregate(
		{contentId:pid, createUserId:uid, maxCreateDate2:date},
		{content, user}
	) {
		let item = ActivityItem.get(this.items, pid, content[~pid], date)
		console.log(user, uid)
		item.update_user(uid, user[~uid], date)
	},
	
	message(
		{contentId:pid, createUserId:uid, createDate2:date, deleted},
		{content, user}
	) {
		if (deleted) return // mmnn
		let item = ActivityItem.get(this.items, pid, content[~pid], date)
		item.update_user(uid, user[~uid], date)
	},
	
/*		process_stuff(act, comments, watching, pages) {
		if (act || comments || watching) {
			let p = Entity.page_map(pages)
			act && this.new_activity(act, p)
			comments && this.new_comments(comments, p)
			watching && this.new_activity(watching, p, true)
			this.redraw()
		}
	},*/
	
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
})}()
