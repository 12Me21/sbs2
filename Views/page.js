<!--/* trick indenter
with (View) (function($) { "use strict" //*/

var currentPage

addView('page', {
	start: function(id, query, render) {
		return $.Req.getPageView(id, render)
	},
	className: 'pageMode',
	render: function(page) {
		currentPage = page
		Nav.link("chat/"+page.id, $pageChatLink)
		setEntityTitle(page)
		setEntityPath(page)
		$pageContents.replaceChildren(Parse.parseLang(page.content, page.values.markupLang))
		Nav.link("editpage/"+page.id, $editButton)
		if (/u/.test(page.myPerms))
			flag('canEdit', true)
		;["b","o","g"].forEach(function(vote) {
			$["$voteCount_"+vote].textContent = page.about.votes[vote].count
			var button = $["$voteButton_"+vote]
			console.log(page.about.myVote)
			if (page.about.myVote == vote)
				button.setAttribute('data-selected', "true")
			else
				button.removeAttribute('data-selected')
		})
	},
	init: function() {
		var voteBtns = [$voteButton_b, $voteButton_o, $voteButton_g]
		var voteCounts = [$voteCount_b, $voteCount_o, $voteCount_g]
		// todo: update counts when changing
		var voteBlock
		voteBtns.forEach(function(button, buttoni) {
			button.onclick = function(e) {
				if (voteBlock || !Req.auth || !currentPage)
					return
				var selected = button.getAttribute('data-selected')
				var vote = !selected ? button.getAttribute('data-vote') : null
				voteBlock = true
				Req.setVote(currentPage.id, vote, function(e, resp) { //currentpage.id is a hack maybe?
					voteBlock = false
					if (!e) {
						voteBtns.forEach(function(btn, i) {
							if (btn != button || selected) {
								if (btn.getAttribute('data-selected') != null) {
									//decrement hack
									voteCounts[i].textContent = +voteCounts[i].textContent - 1
								}
								btn.removeAttribute('data-selected')
							}
						})
						if (!selected) {
							button.setAttribute('data-selected', "true")
							//increment hack
							voteCounts[buttoni].textContent = +voteCounts[buttoni].textContent + 1
						}
					}
				})
			}
		})
	},
	cleanUp: function() {
		$pageContents.replaceChildren()
		flag('canEdit', false)
	}
})
		  
<!--/*
}(window)) //*/ // pass external values
