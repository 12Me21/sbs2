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
		return $.Req.getCategoryView(id, page, render)
	},
	className: 'categoryMode',
	render: function(category, cats, pages, pinned, pageNum) {
		currentCategory = category.id
		navButtons.set(pageNum)
		setEntityTitle(category)
		setEntityPath(category)
		$categoryDescription.replaceChildren(Parse.parseLang(category.description, category.values.markupLang))
		$categoryCategories.replaceChildren()
		Nav.link("editpage?cid="+category.id, $createPage.parentNode)
		Nav.link("editcategory/"+category.id, $editCategory.parentNode)
		category.children.forEach(function(child) {
			var bar = Draw.entityTitleLink(child)
			bar.className += " linkBar bar rem2-3"
			$categoryCategories.appendChild(bar)
		});
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
