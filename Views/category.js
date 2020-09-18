<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('category', {
	init: function() {
		var nav = $categoryNav
		nav.appendChild(Draw.navButtons())
	},
	start: function(id, query, render) {
		return $.Req.getCategoryView(id, render)
	},
	className: 'categoryMode',
	render: function(category, cats, pages, pinned) {
		setEntityTitle(category)
		setEntityPath(category)
		$categoryDescription.replaceChildren(Parse.parseLang(category.description, category.values.markupLang))
		$categoryCategories.replaceChildren()
		$editCategory.onclick = function() {
			Nav.go("editcategory/"+category.id)
		}
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
		$createPage.onclick = function() {
			Nav.go("editpage?cid="+category.id)
		}
		//$.Nav.link("editpage?cid="+category.id, $createPage)
		if (/u/.test(category.myPerms))
			flag('canEdit', true)
	},
	cleanUp: function() {
		$categoryCategories.replaceChildren()
		$categoryPages.replaceChildren()
		$categoryDescription.replaceChildren()
		flag('canEdit', false)
	},
})

<!--/*
}(window)) //*/ // pass external values
