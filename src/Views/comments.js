'use strict'
// todo: should have some indicator whether the input fields reflect the current search results or have been edited

class CommentsView extends BaseView {
	Start({id, query}) {
		this.form = new Form({
			fields: [
				['search', 'text', {label: "Text", param: 's', placeholder: "wildcards: _ %"}],
				['pages', 'number_list', {label: "Page Ids", param: 'pid'}],
				['users', 'number_list', {label: "User Ids", param: 'uid'}],
				['start', 'date', {label: "Start Date", param: 'start'}],
				['end', 'date', {label: "End Date", param: 'end'}],
				['range', 'range', {label: "Id Range", param: 'ids'}],
				//todo: combine these 3 into one field type
				// for page + pagesize + direction
			],
		})
		this.form.from_query(query)
		let page = Math.max(query.page|0, 1)
		let limit = query.limit|0
		let reverse = query.r != null
		
		this.$page.value = page
		this.$limit.value = limit||""
		this.$order.checked = reverse
		
		this.pid = id ? id : null
		if (id)
			this.form.inputs.pages.value = [id]
		let data = this.form.get()
		
		let [search, merge] = this.build_search(data, page, limit, reverse)
		this.merge = merge
		
		if (!search)
			return {quick: true}
		
		return {chain: search}
	}
	
	Init() {
		this.$form_placeholder.replaceWith(this.form.elem)
		this.$html_form.onsubmit = e=>{
			console.log(e)
			e.preventDefault()
			let btn = e.submitter
			if (btn && btn.name=='prev')
				this.go(-1)
			else if (btn && btn.name=='next')
				this.go(1)
			else
				this.go(null)
		}
		this.Slot.set_title("Chat Search")
		if (this.pid)
			this.Slot.add_header_links([
				{icon:"📄️", label:"page", href:"#page/"+this.pid},
			])
		this.$results.fill()
		this.form.write()
	}
	
	Render({message:comments, content:pages}) {
		if (!comments.length) {
			this.$status.textContent = "(none)"
			return
		}
		this.$status.textContent = comments.length
		// todo: we can also do SOME merging, if the search has multiple pages but meets all other requirements.
		if (this.merge) {
			this.$results.append(CommentsView.draw_result(comments, pages))
		} else {
			this.$results.fill(comments.map(msg=>{
				return CommentsView.draw_result(msg, pages)
			}))
			// todo: maybe have them display in a more compact form without controls by default, and then have a button to render a message list 
			// also, maybe if you load enough comments to reach the adjacent item, it should merge that in,
		}
	}
	
	Quick() {
		this.$status.textContent = "(no query)"
	}
	
	// get a page of results. TODO: do this without reloading the page??
	go(dir) {
		if (!this.location) return // just incase somehow you click a button after the view unloads? idk. it'sdefinitely a concern but i feel like tehre should be a general solution..
		this.form.read()
		
		let pnum = Math.max(this.$page.value|0, 1)
		if (dir) {
			pnum += dir
			if (pnum < 1)
				pnum = 1
		}
		let reverse = this.$order.checked
		let limit = this.$limit.value|0
		
		let query = this.location.query = this.form.to_query()
		
		let pages = this.form.inputs.pages.value
		if (pages && pages.length==1) {
			this.location.id = pages[0]
			delete query.pid
		} else {
			this.location.id = null
		}
		
		if (reverse)
			query.r = ""
		else
			delete query.r
		
		if (limit)
			query.limit = limit
		else
			delete query.limit
		
		if (pnum != 1)
			query.page = pnum
		else
			delete query.page
		
		this.Slot.load_location(this.location)
	}
	
	build_search(data, page, limit, reverse) {
		// check if form is empty
		if (!(data.search || (data.users && data.users.length) || data.range || data.start || data.end))
			return [null, false]
		
		let values = {}, query = ["!notdeleted()"], order = 'id', merge = true
		
		if (reverse) {
			order = 'id_desc'
			merge = false
		}
		let text = data.search
		if (text) {
			values.text = `%${text}%`
			query.push("text LIKE @text")
			merge = false
		}
		if (data.pages) {
			values.pids = data.pages
			query.push("contentId IN @pids")
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
				}
				if (range.max != null) {
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
		if (page<1)
			page = 1
		limit = limit || 200
		let skip = (page-1) * limit
		// todo: pages kinda suck, 
		
		return [
			{
				values,
				requests: [
					{type:'message', fields:'*', query:query.join(" AND "), order, limit, skip},
					{type:'content', fields:'name,id,createUserId,permissions,contentType,literalType', query:"id IN @message.contentId"},
					{type:'user', fields:'*', query:"id IN @message.createUserId OR id IN @content.createUserId"},
				],
			},
			merge,
		]
	}
	
	static draw_result(comment, pages) {
		let e = this.result_template()
		let inner = e.lastChild.lastChild
		let link = e.firstChild
		
		let list
		if (Array.isArray(comment)) {
			list = new MessageList(inner, comment[0].contentId) // mmndnhhhgghdhfhdh i sure hope it does (contentId)
			for (let c of comment)
				list.display_edge(c)
		} else {
			list = new MessageList(inner, comment.contentId)
			list.display_only(comment)
		}
		let parent = pages[~list.pid]
		link.append(Draw.content_label(parent))
		
		let btns = inner.previousSibling.childNodes
		btns[0].onclick = btns[1].onclick = Draw.event_lock((done,elem)=>{
			let old = elem.dataset.action=='load_older'
			list.load_messages_near(old, 10, (ok)=>{
				if (ok)
					done()
			})
		})
		
		return e
	}
	// todo: it would be nice to put the older/newer buttons to the left of the message so they dont waste vertical space. or maybe have an initial "load surrounding' button next to the page link?
}

CommentsView.template = HTML`
<view-root style='overflow-y:scroll;'>
	<form $=html_form method=dialog style='background:#666;color:white;'>
		<br $=form_placeholder>
		<div class='nav'>
			<label>
				new first:<input type=checkbox $=order>
			</label>
			&nbsp;
			<button name=search style='margin-right:auto;'>🔍Search</button>
			<span $=status></span>
			/
			<input $=limit style='width:6ch' placeholder="200">
			&nbsp;page:
			<button name=prev>◀</button>
			<input $=page style='width:4ch'>
			<button name=next>▶</button>
		</div>
	</form>
	<div $=results class='comment-search-results'></div>
</view-root>
`
CommentsView.result_template = 𐀶`
<div class='search-comment'>
	<div class='bar rem1-5 search-comment-page'></div>
	<div class='ROW'>
		<div class='search-comment-buttons COL'><button data-action=load_older>↑</button><button data-action=load_newer>↓</button></div>
		<message-list class='FILL'></message-list>
	</div>
</div>
`

View.register('comments', CommentsView)
View.register('chatlogs', {
	Redirect(location) {
		let q = {r: true}
		// we do it this way so the ORDER is preserved :D
		Object.for(location.query, (value, key)=>{
			if (key=='t') key = 's'
			if (key=='s' || key=='pid' || key=='uid')
				q[key] = value
		})
		location.query = q
		// switch to "comments/<id>" url if there is one pid
		location.id = null
		if (q.pid) {
			let pids = CONVERT.number_list.decode(q.pid)
			if (pids && pids.length==1) {
				delete q.pid
				location.id = pids[0]
			}
		}
		location.type = 'comments'
	},
})

// idea: what if MessageList could handle multiple ranges of comments, separated by dividers
// and these get merged whenever you load enough comments for them to overlap

// todo: add a button to remove all the extra loaded comments
