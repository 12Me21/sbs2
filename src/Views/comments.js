'use strict'
// todo: should have some indicator whether the input fields reflect the current search results or have been edited

class CommentsView extends BaseView {
	Start({id, query}) {
		this.form = new Form({
			fields: [
				['search', 'text', {label: "Search", param: 's'}],
				['pages', 'number_list', {label: "Page Ids", param: 'pid'}],
				['users', 'number_list', {label: "User Ids", param: 'uid'}],
				['start', 'date', {label: "Start Date", param: 'start'}],
				['end', 'date', {label: "End Date", param: 'end'}],
				['range', 'range', {label: "Id Range", param: 'ids'}],
				//todo: combine these 3 into one field type
				// for page + pagesize + direction
				['limit', 'number', {label: "Per Page (200)", param: 'limit'}],
				['page', 'number', {label: "Page (1)", param: 'p'}],
				['reverse', 'checkbox', {label: "Newest First", param: 'r'}],
			],
		})
		this.form.from_query(query)
		if (id)
			this.form.inputs.pages.value = [id]
		let data = this.form.get()
		let [search, merge] = this.build_search(data)
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
	}
	
	Render({message:comments, content:pages}) {
		this.Slot.set_title("Comments")
		this.Slot.add_header_links([
			{icon:"📄️", label:"page", href:"#page/"+page.id},
		])
		
		this.form.write()
		this.$results.fill()
		
		if (!comments.length) {
			this.$status.textContent = "(no results)"
			return
		}
		this.$status.textContent = "results: "+comments.length
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
		this.Slot.set_title("Comments")
		this.form.write()
		this.$results.fill()
		this.$status.textContent = "(no query)"
	}
	
	// get a page of results. TODO: do this without reloading the page??
	go(dir) {
		if (!this.location) return // just incase somehow you click a button after the view unloads? idk. it'sdefinitely a concern but i feel like tehre should be a general solution..
		this.form.read()
		// pages are kinda bad now... like, p=0, that's actually p=1, so you press next and go to p=2.. i need to add range limits on the fields etc.
		let pi = this.form.inputs.page
		if (dir) {
			let p = pi.value || 1 //rrrr
			if (p+dir<1) {
				if (dir>=0)
					p = 1-dir
				else
					return
			}
			pi.value = p + dir
		} else {
			pi.value = 1
		}
		
		this.location.query = this.form.to_query()
		let pages = this.form.inputs.pages.value
		if (pages && pages.length==1) {
			this.location.id = pages[0]
			delete this.location.query.pid
		} else {
			this.location.id = null
		}
		if (this.location.query.page==0)
			this.location.query.page = "1"
		
		this.Slot.load_location(this.location)
	}
	
	build_search(data) {
		// check if form is empty
		if (!(data.search || (data.users && data.users.length) || data.range || data.start || data.end || data.page))
			return [null, false]
		
		let values = {}, query = ["!notdeleted()"], order = 'id', merge = true
		
		if (data.reverse) {
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
		let limit = data.limit || 200 // ugh we need a system for default values or something
		let page = data.page || 1 // 1 indexed
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
		let link = e.firstChild.firstChild
		
		let list
		if (Array.isArray(comment)) {
			list = new MessageList(inner, comment[0].contentId) // mmndnhhhgghdhfhdh i sure hope it does (contentId)
			list.display_messages(comment)
		} else {
			list = new MessageList(inner, comment.contentId)
			list.single_message(comment)
		}
		let parent = pages[~list.pid]
		
		link.append(Draw.content_label(parent))
		
		let btns = inner.previousSibling.childNodes
		btns[0].onclick = btns[1].onclick = Draw.event_lock((done,elem)=>{
			let old = elem.dataset.action=='load_older'
			list.draw_messages_near(!old, 10, (ok)=>{
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
	<form $=html_form class='nav' method=dialog>
		<br $=form_placeholder>
		<button name=search>🔍Search</button>
		<button name=prev>◀prev</button>
		<button name=next>next▶</button>
		<span $=status></span>
	</form>
	<div $=results class='comment-search-results'></div>
</view-root>
`
CommentsView.result_template = 𐀶`
<div class='search-comment'>
	<div class='bar rem1-5 search-comment-page'><a></a></div>
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
