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
		const cfields = 'parentId,deleted,literalType,name,id,contentType,hash,permissions,lastCommentId,createUserId'
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
					{name:'count', type:'content', fields:'parentId,deleted,id,specialCount,literalType', query: cquery},
					// these will be blank if we're on the root category
					{type: 'user', fields: "*", query: "id IN @content.createUserId OR id IN @Ccategories.createUserId OR id IN @Cchildren.createUserId"},
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
		//this.$page_contents.hidden = !hd
		if (hd)
			Markup.convert_lang(page.description, page.values.markupLang, this.$page_contents, {intersection_observer: View.observer})
		else
			this.$page_contents.fill()
		
		let author = user[~page.createUserId]
		this.$author.fill()
		if (author)
			this.$author.append(Draw.user_label(author))
		this.$create_date.lastChild.replaceWith(Draw.time_ago(page.createDate2))
	}
	Render({content:[page], Ccategories:categories, Cchildren:children, user, Cparent:[parent], count:[{specialCount}]}) {
		if (!page) {
			page = Entity.fake_category(this.page_id)
			this.Slot.add_header_links([
				{icon:"📝️", label:"new child", href:"#editpage?parent="+this.page_id},
			])
		} else {
			this.page_id = page.id
			this.Slot.add_header_links([
				{icon:"📝️", label:"new child", href:"#editpage?parent="+this.page_id},
				{icon:"📄️", label: "visit page", href:"#page/" + this.page_id},
				{icon:"✏️", label: "edit", href: "#editpage/" + page.id},
			])
			if (!parent)
				parent = Entity.fake_category(page.parentId)
			let p = Draw.category_item(parent, user, true)
			p.firstChild.prepend("Parent ⮭")
			this.$parent.append(p)
		}
		this.Slot.set_entity_title(page)
		this.update_page(page, user)
		
		
		this.$page.textContent = this.pnum+"/"+Math.ceil(specialCount/CategoryView.psize)
		this.$categories.fill(categories.map(c => Draw.category_item(c, user, true)))
		this.$children.fill(children.map(c => Draw.category_item(c, user, false)))
	}
}

CategoryView.psize = 30
CategoryView.template = HTML`
<view-root class='COL' style='overflow-y:auto;'>
	<div class='pageInfoPane bar rem1-5' style='justify-content:space-between;'>
		<div class='ROW'>
			<span $=author style='margin-right:0.5rem;'></span>
			<span $=create_date>Created: <time></time></span>
		</div>
	</div>
	<div class='pageContents' $=page_contents></div>
	<div $=parent></div>
	Child categories:
	<div $=categories class='COL'></div>
	<div class='ROW bar rem1-5 nav'>
		<button $=prev class='item'>◀prev</button>
		<span $=page class='textItem'>0</span>
		<button $=next class='item'>next▶</button>
	</div>
	<div $=children class='COL'></div>
</view-root>
`

View.register('category', CategoryView)
View.register('categories', {
	Redirect(location) {location.type='category'},
})
