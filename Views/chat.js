<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('chat', {
	start: function(id, query, render) {
		return $.Req.getChatView(id, render)
	},
	className: 'chatMode',
	render: function(page, comments) {
		Nav.link("page/"+page.id, $pagePageLink)
		setEntityTitle(page)
		setEntityPath(page)
		lastUid = NaN
		lastBlock = null
		lastTime = 0
		comments.forEach(function(comment) {
			displayMessage(comment)
		})
	},
	cleanUp: function() {
		$messageList.replaceChildren()
	},
	init: function() {
	}
})

var lastUid = NaN
var lastBlock
var lastTime = 0

function displayMessage(comment) {
	if (comment.deleted)
		return
	var uid = comment.createUserId
	if (!lastBlock || uid != lastUid || comment.createDate-lastTime > 1000*60*5) {
		lastBlock = Draw.messageBlock(comment)
		$messageList.appendChild(lastBlock[0])
		//lastTime = comment.createDate
	}
	lastBlock[1].appendChild(Draw.messagePart(comment))
	lastUid = uid
	lastTime = comment.createDate
}

<!--/*
}(window)) //*/ // pass external values
