<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('category', {
	init() {
		let nav = $categoryNav
		navButtons = Draw.nav_buttons()
		nav.append(navButtons.element)
		navButtons.onchange = (n)=>{
			if (currentCategory == null)
				return
			currentQuery.page = n
			Nav.go("category/"+currentCategory+Req.queryString(currentQuery))
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
		return Req.read([
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
				let category = id==0 ? Entity.categoryMap[0] : resp.Cmain[0]
				render(category, resp.category, resp.content, resp.Ppinned, page)
			} else
				render(null)
		}, true)
	},
	
	className: 'categoryMode',
	render(category, cats, pages, pinned, pageNum) {
		currentCategory = category.id
		navButtons.set(pageNum)
		setEntityTitle(category)
		setEntityPath(category.parent)
		$categoryDescription.replaceChildren(Parse.parseLang(category.description, category.values.markupLang))
		$categoryCategories.replaceChildren()
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
	cleanUp() {
		$categoryCategories.replaceChildren()
		$categoryPages.replaceChildren()
		$categoryDescription.replaceChildren()
		flag('canEdit', false)
		currentCategory = null
	},
})

var navButtons
var currentCategory
var currentQuery

<!--/*
}(window)) //*/
