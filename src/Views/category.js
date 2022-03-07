<!--/* trick indenter
with (View) (function($) { "use strict" //*/

add_view('category', {
	init() {
		let nav = $categoryNav
		navButtons = Draw.nav_buttons()
		nav.append(navButtons.element)
		navButtons.onchange = (n)=>{
			if (currentCategory == null)
				return
			currentQuery.page = n
			Nav.go("category/"+currentCategory+Req.query_string(currentQuery))
		}
	},
	
	start(id, query, render) {
		currentQuery = query
		let page = +query.page || 1
		navButtons.set(page)
		
		let search = {
			parentIds: [id],
			limit: 30,
			skip: 30*(page-1),
			sort: 'editDate',
			reverse: true
		}
		return [0, Req.read([
			['category~Cmain', {ids: [id]}],
			['content', search],
			['category', {parentIds: [id]}],
			['content.0values_pinned~Ppinned'],
			['user.1createUserId.3createUserId'],
		], {
			content: 'id,name,parentId,createUserId,editDate,permissions',
			/*category: "id,name,description,parentId,values",*/
			user: 'id,username,avatar',
		}, (e, resp)=>{
			if (!e) {
				let category = id==0 ? Entity.category_map[0] : resp.Cmain[0]
				render(category, resp.category, resp.content, resp.Ppinned, page)
			} else
				render(null)
		}, true)]
	},
	className: 'category',
	render(category, cats, pages, pinned, pageNum) {
		currentCategory = category.id
		navButtons.set(pageNum)
		set_entity_title(category)
		set_entity_path(category.parent)
		$categoryDescription.fill(Parse.parseLang(category.description, category.values.markupLang))
		$categoryCategories.fill()
		Nav.link("editpage?cid="+category.id, $createPage.parentNode)
		Nav.link("editcategory/"+category.id, $editCategory.parentNode)
		category.children.forEach((child)=>{
			let bar = Draw.entity_title_link(child)
			bar.className += " linkBar bar rem2-3"
			$categoryCategories.append(bar)
		})
		pinned.forEach((page)=>{
			let bar = Draw.page_bar(page)
			bar.className += " linkBar bar rem2-3"
			$categoryCategories.append(bar)
		})
		pages.forEach((page)=>{
			let bar = Draw.page_bar(page)
			bar.className += " linkBar bar rem2-3"
			$categoryPages.append(bar)
		})
		
		//$.Nav.link("editpage?cid="+category.id, $createPage)
		if (/u/.test(category.myPerms))
			flag('canEdit', true)
	},
	cleanup() {
		$categoryCategories.fill()
		$categoryPages.fill()
		$categoryDescription.fill()
		flag('canEdit', false)
		currentCategory = null
	},
})

var navButtons
var currentCategory
var currentQuery

<!--/*
}(window)) //*/
