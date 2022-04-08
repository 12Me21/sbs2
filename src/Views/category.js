View.add_view('category', {
	navButtons: null,
	currentCategory: null,
	currentQuery: null,
	
	init() {
		let nav = $categoryNav
		this.navButtons = Draw.nav_buttons()
		nav.append(this.navButtons.element)
		this.navButtons.onchange = (n)=>{
			if (this.currentCategory == null)
				return
			this.currentQuery.page = n
			Nav.go("category/"+this.currentCategory+Req.query_string(this.currentQuery))
		}
	},
	
	start(id, query) {
		this.currentQuery = query
		let page = +query.page || 1
		this.navButtons.set(page)
		
		let search = {
			parentIds: [id],
			limit: 30,
			skip: 30*(page-1),
			sort: 'editDate',
			reverse: true
		}
		return {
			chains: [
				['category~Cmain', {ids: [id]}],
				['content', search],
				['category', {parentIds: [id]}],
				['content.0values_pinned~Ppinned'],
				['user.1createUserId.3createUserId'],
			],
			fields: {
				content: 'id,name,parentId,createUserId,editDate,permissions',
				/*category: "id,name,description,parentId,values",*/
				user: 'id,username,avatar',
			},
			ext: {
				page: page,
				id: id,
			},
			check(resp, ext) {
				return ext.id==0 ? Entity.category_map[0] : resp.Cmain[0]
			}
		}
	},
	render(resp, ext) {
		let category = ext.id==0 ? Entity.category_map[0] : resp.Cmain[0]
		let cats = resp.category
		let pages = resp.content
		let pinned = resp.Ppinned
		let pageNum = ext.page
		
		this.currentCategory = category.id
		this.navButtons.set(pageNum)
		View.set_entity_title(category)
		View.set_entity_path(category.parent)
		Markup.convert_lang(category.description, category.values.markupLang, $categoryDescription)
		$categoryCategories.fill()
		Nav.link("editpage?cid="+category.id, $createPage.parentNode)
		Nav.link("editcategory/"+category.id, $editCategory.parentNode)
		for (let child of category.children) {
			let bar = Draw.entity_title_link(child)
			bar.className += " linkBar bar rem2-3"
			$categoryCategories.append(bar)
		}
		for (let page of pinned) {
			let bar = Draw.page_bar(page)
			bar.className += " linkBar bar rem2-3"
			$categoryCategories.append(bar)
		}
		for (let page of pages) {
			let bar = Draw.page_bar(page)
			bar.className += " linkBar bar rem2-3"
			$categoryPages.append(bar)
		}
		
		//$.Nav.link("editpage?cid="+category.id, $createPage)
		if (/u/.test(category.myPerms))
			View.flag('canEdit', true)
	},
	cleanup() {
		$categoryCategories.fill()
		$categoryPages.fill()
		$categoryDescription.fill()
		View.flag('canEdit', false)
		this.currentCategory = null
	},
})
