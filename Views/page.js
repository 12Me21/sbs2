<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('page', {
	start: function(id, query, render) {
		return $.Req.getPageView(id, render)
	},
	className: 'pageMode',
	render: function(page) {
		Nav.link("chat/"+page.id, $pageChatLink)
		setEntityTitle(page)
		setEntityPath(page)
		$pageContents.replaceChildren(Parse.parseLang(page.content, page.values.markupLang))
		Nav.link("editpage/"+page.id, $editButton)
		if (/u/.test(page.myPerms))
			flag('canEdit', true)
	},
	cleanUp: function() {
		$pageContents.replaceChildren()
		flag('canEdit', false)
	}
})
		  
<!--/*
}(window)) //*/ // pass external values
