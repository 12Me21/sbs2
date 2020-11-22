// make a class for activity list
// render new page block only when page added to list
// handle updating existing page blocks (updating users list, time, etc.)
// use this for activity and watchlist

<!--/* trick indenter
var Act = Object.create(null)
with (Act) (function($) { "use strict"
Object.assign(Act, { //*/

items: {},

pullRecent: function() {
	// bad arguments :(
	Req.getRecentActivity(function(a, c, wa, wc, p, com) {
		p = Entity.makePageMap(p)
		newActivity(a, p)
		newCommentAggregate(c, p)
		newActivity(wa, p, true)
		newCommentAggregate(wc, p, true)
		Sidebar.onAggregateChange(items)
		Sidebar.displayMessages(com, true)
	})
},

// ew
// this system merges Activity, Comment, and CommentAggregate
// so we need these 3 awful functions to handle them slightly differently

// CommentAggregate is the worst because users are sorted by id
// instead of what we want, which is by most recent comment. oh well
newCommentAggregate: function(ca, pageMap, watch) {
	ca.forEach(function(a) {
		var item = getItem(a.id, pageMap, a.firstDate)
		if (watch)
			item.watching = true
		a.users.forEach(function(user) {
			// this is bad, because we don't have lastDate per user
			userUpdate(item, user, 0)
		})
		item.count += a.count
		if (a.firstDate < item.firstDate)
			item.firstDate = a.firstDate
		if (a.lastDate > item.lastDate)
			item.lastDate = a.lastDate
	})
},

newComments: function(comments, pageMap, watch) {
	comments.forEach(function(c) {
		var id = c.parentId
		var item = getItem(id, pageMap, c.editDate)
		if (watch)
			item.watching = true
		// todo: commentaggregate only tracks createDate
		// so maybe use that here for consistency between reloads
		userUpdate(item, c.editUser, c.editDate)
		item.count++
		if (c.editDate < item.firstDate)
			item.firstDate = c.editDate
		if (c.editDate > item.lastDate)
			item.lastDate = c.editDate
	})
},

newActivity: function(activity, pageMap, watch) {
	activity.forEach(function(a) {
		var id = a.contentId
		var item = getItem(id, pageMap, a.date)
		// hopefully this takes care of pages in activity list being updated?
		if (pageMap[id])
			item.content = pageMap[id]
		if (watch)
			item.watching = true
		userUpdate(item, a.user, a.date)
		item.count++
		if (a.date < item.firstDate)
			item.firstDate = a.date
		if (a.date > item.lastDate)
			item.lastDate = a.date
	})
},

getItem: function(id, pageMap, date) {
	if (items[id])
		return items[id]
	return items[id] = {
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
userUpdate: function(item, user, date) {
	if (!user) return // just in case
	// remove old user
	for (var i=0; i<item.users.length; i++)
		if (item.users[i].user.id == user.id) {
			if (date <= item.users[i].date) //old user has newer date, don't remove
				return
			item.users.splice(i, 1)
			break
		}
	// insert new user
	for (var i=0; i<item.users.length; i++)
		if (date >= item.users[i].date)
			break
	item.users.splice(i, 0, {user:user, date:date})
	// temp fix maybe? mark unsorted users and render them differentlyyy
	/*if (!date && !user.unsorted)
		user = Object.create(user, {unsorted: {value: true}})*/
},

<!--/* 
}) //*/


<!--/*
}(window)) //*/ // pass external values
