'use strict'

class ActivityItem {
	constructor(content, parent) {
		if (parent.hide_user)
			ActivityItem.template_simple(this)
		else
			ActivityItem.template(this)
		
		this.parent = parent
		this.content = content
		this.users = {}
		this.date = -Infinity
		
		this.$root.href = Nav.entity_link(this.content)
		this.redraw_page()
		// every item is assumed to be the newest, when created
		// make sure you create activityitems in the right order
		this.top()
	}
	redraw_page() {
		this.$page.fill(Draw.content_label(this.content))
	}
	// todo: .top() might make more sense as method on ActivityContainer
	top() {
		const con = this.parent.container
		let first = con.firstElementChild
		if (first == this.$root)
			return
		con.prepend(this.$root)
		if (con.contains(document.activeElement))
			return
		let hole = con.querySelector(`:scope > [tabindex="0"]`)
		if (hole)
			hole.tabIndex = -1
		this.$root.tabIndex = 0
	}
	redraw_time() {
		if (this.date!=-Infinity)
			this.$time.textContent = Draw.time_ago_string(this.date)
	}
	update_date(date) {
		if (date > this.date) {
			this.date = date
			this.$time.title = this.date.toString()
			this.$time.setAttribute('datetime', this.date.toISOString())
			this.redraw_time()
			this.top()
		}
	}
	update_content(content) {
		if (content.lastRevisionId > this.content.lastRevisionId) {
			this.content = content
			this.redraw_page()
		}
	}
	update_user(uid, user, date) {
		// hmm user is almost identical to ActivityItem. could reuse class for both?
		if (!user || this.parent.hide_user) {
			//console.warn('update user uid?', uid)
			return
		}
		// todo: update user object for avatar changes etc? why don't users have editDate...
		let u = this.users[uid] || (this.users[uid] = {user, date: -Infinity, elem: Draw.link_avatar(user)})
		// todo: show user dates on hover?
		if (date > u.date) {
			if (u.date==-Infinity || u.elem.previousSibling) // hack
				this.$user.prepend(u.elem)
			u.date = date
		}
	}
}
ActivityItem.template = HTML`
<a class='activity-page' role=row tabindex=-1>
	<div $=page class='bar rem1-5 ellipsis'></div>
	<div class='bar rem1-5 activity-page-bottom ROW'>
		<time $=time class='time-ago ellipsis'></time>
		<activity-users $=user aria-orientation=horizontal class='FILL'>
`
ActivityItem.template_simple = HTML`
<a class='activity-page activity-watch' role=row tabindex=-1>
	<div $=page class='bar rem1-5 ellipsis'></div>
	<div class='bar rem1-5 activity-page-bottom ROW'>
		<time $=time class='time-ago ellipsis'></time>
`

class ActivityContainer {
	constructor(hide_user=false) {
		this.container = document.createElement('scroll-inner')
		this.interval = null
		this.container.setAttribute('role', 'treegrid')
		this.elem = null
		this.items = {}
		this.hide_user = hide_user
	}
	
	init(element) {
		// this should probably be handled by um  sidebar instead
		this.elem = element
		this.elem.fill(this.container)
		this.refresh_time_interval()
	}
	
	refresh_time_interval() {
		if (this.interval)
			window.clearInterval(this.interval)
		this.interval = window.setInterval(()=>{
			for (let item of Object.values(this.items))
				item.redraw_time()
		}, 1000*30)
	}
	
	// get/create the ActivityItem for a given page
	//  - also updates its page and date info
	// (the reason i pass pid AND page here, is just in case the
	//  page data is missing, so we'll at least have the id)
	update_content(pid, page, date) {
		let item = this.items[pid] || (this.items[pid] = new ActivityItem(page, this))
		item.update_content(page)
		item.update_date(date)
		return item
	}
	// update page, date, and user info, for a given page
	update({content, user}, pid, uid, date) {
		let item = this.update_content(pid, content[~pid], date)
		if (uid)
			item.update_user(uid, user[~uid], date)
	}
	
	watch(
		watch,
		objects
	) {
		const pid = watch.contentId
		const msg = watch.Message // in case page has 0 messages:
		const date = msg.id ? msg.createDate2 : -Infinity
		this.update(objects, pid, null, date)
	}
	
	message_aggregate(
		{contentId:pid, createUserId:uid, maxCreateDate2:date},
		objects
	) {
		this.update(objects, pid, uid, date)
	}
	
	message(
		{contentId:pid, createUserId:uid, createDate2:date, deleted},
		objects
	) {
		if (deleted) return // mmnn
		this.update(objects, pid, uid, date)
	}
}

let Act = {
	normal: new ActivityContainer(false),
	watch: new ActivityContainer(true),
	init() {
		this.normal.init($sidebarActivity)
		this.watch.init($sidebarWatch)
	},
	pull_recent() {
		let start = new Date()
		start.setDate(start.getDate() - 1)
		Lp.chain({
			values: {
				yesterday: start,
			},
			requests: [
				// recent messages
				{type:'message_aggregate', fields:'contentId, createUserId, maxCreateDate, maxId', query:"createDate > @yesterday"},
				{type:'message', fields:'*', query:"!notdeleted()", order:'id_desc', limit:50},
				{type:'content', fields:'name, id, permissions, contentType, lastRevisionId', query:"id IN @message_aggregate.contentId OR id IN @message.contentId"},
				// watches
				{type:'watch', fields:'*'},
				{name:'Cwatch', type:'content', fields:'name, id, permissions, contentType, lastRevisionId,lastCommentId', query: "!notdeleted() AND id IN @watch.contentId", order:'lastCommentId_desc'},
				{name:'Mwatch', type:'message', fields: '*', query: 'id in @Cwatch.lastCommentId', order: 'id_desc'},
				// shared
				{type:'user', fields:'*', query:"id IN @message_aggregate.createUserId OR id IN @message.createUserId OR id IN @watch.userId"},
				// todo: activity_aggregate
			],
		}, (objects)=>{
			console.log('🌄 got initial activity')
			Entity.link_comments({message:objects.Mwatch, user:objects.user})
			Entity.ascending(objects.message, 'id')
			// TODO: ensure that these are displayed BEFORE any websocket new messages
			Sidebar.display_messages(objects.message, true)
			objects.message_aggregate.sort((a, b)=>a.maxId-b.maxId)
			for (let x of objects.message_aggregate)
				this.normal.message_aggregate(x, objects)
			// watches
			Entity.link_watch({message:objects.Mwatch, watch:objects.watch, content:objects.Cwatch})
			objects.watch.sort((x, y)=>x.Message.id-y.Message.id)
			for (let x of objects.watch)
				this.watch.watch(x, {content:objects.Cwatch})
		})
	},
	handle_messages(comments, maplist) {
		for (let {contentId:pid, createUserId:uid, createDate2:date, deleted} of comments) {
			if (!deleted) {
				this.normal.update(maplist, pid, uid, date)
				if (this.watch.items[pid])
					this.watch.update(maplist, pid, null, date)
			}
		}
	},
}
do_when_ready(()=>{Act.init()})

