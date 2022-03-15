<!--/* trick indenter
with (View) (function($) { "use strict" //*/

add_view('user', {
	start(id, query) {
		if (typeof id == 'string' && id[0] == "@")
			id = id.substr(1)
		// todo: maybe username without @ should be invalid?
		// can potentially collide with id numbers
		
		let userSearch
		if (typeof id == 'number')
			userSearch = {ids: [id], limit: 1}
		else
			userSearch = {usernames: [id], limit: 1}
		
		return {
			chains: [
				['user', userSearch],
				['content.0id$createUserIds~Puserpage', {type: 'userpage', limit: 1}],
				['activity.0id$userIds', {limit: 20, reverse: true}],
				['commentaggregate.0id$userIds', {limit: 100, reverse: true}],
				['content.2contentId.3id'],
			],
			fields: {},
			check(resp) {
				return resp.user[0]
			},
			ext: {},
		}
	},
	render(resp, ext) {
		let user = resp.user[0]
		let userpage = resp.Puserpage[0]
		let activity = resp.activity
		let ca = resp.commentaggregate
		let content = resp.content
		
		if (user.id == Req.uid) {
			flag('myUserPage', true)
			let path
			if (userpage) {
				path="editpage/"+userpage.id
			} else
				path="editpage?type=userpage&name="+url_escape(user.name)+"'s user page"
			Nav.link(path, $editUserPage)
		}
		set_entity_title(user)
		/*$userPageAvatarLink.href = Draw.avatar_url(user)*/
		$userPageAvatar.src = Draw.avatar_url(user, "size=400&crop=true")
		//setPath([["users","Users"], [Nav.entityPath(user), user.name]])
		if (userpage)
			$userPageContents.fill(Draw.markup(userpage))
		else
			$userPageContents.fill()
	},
	cleanup() {
		$userPageAvatar.src = ""
		$userPageContents.fill()
	},
})

<!--/*
}(window)) //*/
