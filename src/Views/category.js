'use strict'

class CategoryView extends BaseView {
	Start({id, query: {page}}) {
		let field, parent
		if ('number'==typeof id) {
			this.page_id = id
			field = 'id'
			parent = " = @key"
		} else {
			this.page_id = null
			field = 'hash'
			parent = " IN @content.id"
		}
		this.pnum = (+page) || 1
		const cfields = 'parentId,deleted,literalType,name,id,contentType,hash,permissions,lastCommentId'
		const cquery = `parentId ${parent} AND !notdeleted() AND id NOT IN @Ccategories.id`
		return {
			chain: {
				values: {
					key: id,
				},
				requests: [
					{type: 'content', fields: "*", query: `${field} = @key`},
					{
						name: "Ccategories",
						type: 'content',
						fields: cfields,
						query: `parentId ${parent} AND !notdeleted() AND (!onlyparents() OR literalType={{category}} )`,
						order: "name_desc",
					},
					{
						name: "Cchildren",
						type: 'content',
						fields: cfields,
						query: cquery,
						order: "lastCommentId_desc",
						limit: CategoryView.psize,
						skip: CategoryView.psize * (this.pnum - 1),
					},
					{name:'count', type:'content', fields:'parentId,deleted,id,specialCount,literalType', query: "("+cquery+") OR id = {{937}}"},
					// these will be blank if we're on the root category
					{type: 'user', fields: "*", query: "id IN @content.createUserId"},
					//{type: 'watch', fields: "*", query: "contentId IN @content.id"},
					{name: "Cparent", type: 'content', fields: cfields, query: "id IN @content.parentId AND !notdeleted()"},
				],
			},
			check(resp) { return field=='id' || resp.content[0] },
		}
	}
	
	Init() {
		this.$prev.onclick = e=>{go(-1)}
		this.$next.onclick = e=>{go(1)}
		let go = (dir)=>{
			let page = this.pnum || 1
			if (page+dir<1)
				return
			this.location.query.page = page+dir
			this.Slot.load_location(this.location)
		}
	}
	update_page(page, user) {
		this.page = page
		let hd = !!page.description
		this.$page_contents.hidden = !hd
		if (hd)
			Markup.convert_lang(page.description, page.values.markupLang, this.$page_contents, {intersection_observer: View.observer})
	}
	Render({content:[page], Ccategories:categories, Cchildren:children, user, Cparent:[parent], count:[{specialCount}]}) {
		console.log(children,'cc')
		if (!page) {
			page = Entity.fake_category(this.page_id)
			this.Slot.add_header_links([
				{label:"new child", href:"#editpage?parent=" + this.page_id},
			])
		} else {
			this.page_id = page.id
			this.Slot.add_header_links([
				// TODO: attach the category id as the parentId
				{label: "new child", href:"#editpage?parent=" + this.page_id},
				{label: "visit page", href:"#page/" + this.page_id},
				{label: "edit", href: "#editpage/" + page.id},
			])
			if (!parent)
				parent = Entity.fake_category(page.parentId)
			let p = Draw.category_item(parent, true)
			p.prepend("Parent ⮭")
			this.$parent.append(p)
		}
		this.Slot.set_entity_title(page)
		this.update_page(page, user)
		
		
		this.$page.textContent = this.pnum+"/"+Math.ceil(specialCount/CategoryView.psize)
		this.$categories.fill(categories.map(c => Draw.category_item(c, true)))
		this.$children.fill(children.map(c => Draw.category_item(c, false)))
	}
}

CategoryView.psize = 30
CategoryView.template = HTML`
<view-root class='COL' style='overflow-y:auto;'>
	<div class='pageContents' $=page_contents></div>
	<div $=parent></div>
	<h2>categories</h2>
	<div $=categories class='blob-list' style='--column-gap:0.5rem;'></div>
	<div class='ROW bar rem1-5 nav'>
		<button $=prev class='item'>◀prev</button>
		<span $=page class='textItem'>0</span>
		<button $=next class='item'>next▶</button>
	</div>
	<div $=children></div>
</view-root>
`

View.register('category', CategoryView)
View.register('categories', {
	Redirect(location) {location.type='category'},
})
