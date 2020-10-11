<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('user', {
	start: function(id, query, render) {
		if (typeof id == 'string' && id[0] == "@")
			id = id.substr(1)
		// todo: maybe username without @ should be invalid?
		// can potentially collide with id numbers
		return Req.getUserView(id, render)
	},
	className: 'userMode',
	render: function(user, userpage, activity, ca, content) {
		if (user.id == Req.uid) {
			flag('myUserPage', true)
			if (userpage) {
				var path="editpage/"+userpage.id
			} else
				var path="editpage?type=userpage&name="+encodeURIComponent(user.username)+"'s user page"
			Nav.link(path, $editUserPage)
		}
		setEntityTitle(user)
		/*$userPageAvatarLink.href = Draw.avatarURL(user)*/
		$userPageAvatar.src = Draw.avatarURL(user, "size=400&crop=true")
		//setPath([["users","Users"], [Nav.entityPath(user), user.name]])
		if (userpage)
			$userPageContents.replaceChildren(Draw.markup(userpage))
		else
			$userPageContents.replaceChildren()
	},
	cleanUp: function() {
		$userPageAvatar.src = ""
		$userPageContents.replaceChildren()
	},
})

<!--/*
}(window)) //*/ // pass external values
