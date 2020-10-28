<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('category', {
	init: function() {
		var nav = $categoryNav
		navButtons = Draw.navButtons()
		nav.appendChild(navButtons.element)
		navButtons.onchange = function(pageNum) {
			if (currentCategory == null)
				return
			currentQuery.page = pageNum
			Nav.go("category/"+currentCategory+Req.queryString(currentQuery))
		}
	},
	
	start: function(id, query, render) {
		currentQuery = query
		var page = +query.page || 1
		navButtons.set(page)

		var search = {
			parentIds: [id],
			limit: 30,
			skip: 30*(page-1),
			sort: 'editDate',
			reverse: true
		}
		return Req.read([
			{'category~Cmain': {ids: [id]}},
			{content: search},
			{category: {parentIds: [id]}},
			"content.0values_pinned~Ppinned",
			"user.1createUserId.3createUserId"
		], {
			content: "id,name,parentId,createUserId,editDate,permissions",
			/*category: "id,name,description,parentId,values",*/
			user: "id,username,avatar"
		}, function(e, resp) {
			if (!e) {
				if (id == 0)
					var category = Entity.categoryMap[0]
				else
					category = resp.Cmain[0]
				render(category, resp.category, resp.content, resp.Ppinned, page)
			} else
				render(null)
		}, true)
	},
	
	className: 'categoryMode',
	render: function(category, cats, pages, pinned, pageNum) {
		currentCategory = category.id
		navButtons.set(pageNum)
		setEntityTitle(category)
		setEntityPath(category.parent)
		$categoryDescription.replaceChildren(Parse.parseLang(category.description, category.values.markupLang))
		$categoryCategories.replaceChildren()
		Nav.link("editpage?cid="+category.id, $createPage.parentNode)
		Nav.link("editcategory/"+category.id, $editCategory.parentNode)
		category.children.forEach(function(child) {
			var bar = Draw.entityTitleLink(child)
			bar.className += " linkBar bar rem2-3"
			$categoryCategories.appendChild(bar)
		})
		pinned.forEach(function(page) {
			var bar = Draw.pageBar(page)
			bar.className += " linkBar bar rem2-3"
			$categoryCategories.appendChild(bar)
		})
		pages.forEach(function(page) {
			var bar = Draw.pageBar(page)
			bar.className += " linkBar bar rem2-3"
			$categoryPages.appendChild(bar)
		})
		
		//$.Nav.link("editpage?cid="+category.id, $createPage)
		if (/u/.test(category.myPerms))
			flag('canEdit', true)
	},
	cleanUp: function() {
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
}(window)) //*/ // pass external values
