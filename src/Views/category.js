'use strict'

class CategoryView extends PageView {
	static skip = 30
	pid = 0

	Start({ id, query: { page } }) {
		let field = 'number' == typeof id ? 'id' : 'hash'
		if (field == 'id')
			StatusDisplay.prepare(id)
		this.pid = (+page) || 1
		const skip = CategoryView.skip * (this.pid - 1)
		const parent = id === 0 ? '= @root' : 'IN @content.id'
		const chain = 
			{
				values: {
					key: id,
					type: "category",
					root: 0
				},
				requests: [
					{ type: 'content', fields: "*", query: `${field} = @key` },
					{
						type: 'content',
						fields: "*",
						query: `parentId ${parent} AND !notdeleted() AND (!onlyparents() OR literalType=@type)`,
						order: "name_desc",
						name: "categories"
					},
					{
						type: 'content',
						fields: "*",
						query: `parentId ${parent} AND !notdeleted() AND id NOT IN @categories.id`,
						order: "lastCommentId_desc",
						limit: CategoryView.skip,
						skip,
						name: "children"
					},
				],
			}
		if (id !== 0) {
			chain.requests = chain.requests.concat([
				{
					type: 'content',
					fields: "*",
					query: "id = @content.parentId AND !notdeleted()",
					name: "parent"
				},
				{ type: 'user', fields: "*", query: "id IN @content.createUserId" },
				{ type: 'watch', fields: "*", query: "contentId IN @content.id" }
			])
		}

		return {
			check: resp => true,
			chain
		}
	}
	Init() {
		// todo: don't duplicate this? lol that's probably not possible
		this.$watching.onchange = Draw.event_lock(done=>{
			Req.set_watch(this.page_id, this.$watching.checked).do = resp=>{
				done()
			}
		})
		this.$prev.onclick = e=>{go(-1)}
		this.$next.onclick = e=>{go(1)}
		let go = (dir)=>{
			let page = this.pid || 1
			if (page+dir<1)
				return
			this.location.query.page = page+dir
			this.Slot.load_location(this.location)
		}
		this.$visit_page.onclick = e=>{
			this.location.type = "page"
			this.location.query = {}
			this.Slot.load_location(this.location)
		}
	}
	Render({ content: [page], categories, children, user, watch, parent }) {
		// header //
		console.log(children)
		if (page !== undefined) {
			this.Slot.set_entity_title(page)
			this.Slot.add_header_links([
				// TODO: attach the category id as the parentId
				{label:"create page", href:"#editpage/0"},
				{ label: "edit", href: "#editpage/" + page.id },
			])
		}
		else
			this.Slot.set_title("Root")

		if (page) {
			this.update_page(page, user)
			this.update_watch(watch[0])
		}
		this.$page.innerText = this.pid

		this.$categories.fill(
			categories.map(c => Draw.category_item(c, true))
		)

		this.$children.fill(
			children.map(c => Draw.category_item(c, false))
		)

		if (parent && parent[0])
			this.$parent.fill(Draw.category_item(parent[0], true))
		else if (page)
			this.$parent.fill(Draw.category_item(undefined, true))

		new ResizeBar(this.$page_container, this.$resize_handle, 'top', 'setting--divider-pos-'+(page ? page.id : 0), 0)
	}
	Visible() { }
	Destroy(type) { }
	Insert_Text(text) { }
}

CategoryView.template = HTML`
<view-root class='COL'>
	<scroll-outer class='page-container sized' $=page_container>
		<div class='pageContents' $=page_contents></div>
	</scroll-outer>
	<div $=resize_handle style=--handle-width:2em; class='resize-handle'></div>
	<scroll-outer class='FILL'>
		<div class='pageInfoPane bar rem1-5' style='justify-content:space-between;'>
			<div class='ROW'>
				<label>Watching: <input type=checkbox $=watching></label>
				<span $=author style='margin: 0 0.5rem;'></span>
				<span $=create_date>Created: <time></time></span>
			</div>
			<div class='ROW'>
				<button $=prev>◀prev</button>
				<span $=page class='textItem'>0</span>
				<button $=next>next▶</button>
				<button $=visit_page>Visit Page</button>
			</div>
		</div>
		<h2>parent</h2>
		<div $=parent></div>
		<h2>categories</h2>
		<div $=categories></div>
		<hr>
		<h2>children</h2>
		<div $=children></div>
	</scroll-outer>
</view-root>
`

View.register('category', CategoryView)
View.register('categories', {
	Redirect(location) {location.type='category'},
})
