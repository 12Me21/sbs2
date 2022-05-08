View.add_view('user', {
	start({id, query}) {
		let userSearch
		if (typeof id == 'number')
			userSearch = {ids: [id], limit: 1}
		else {
			// todo: maybe username without @ should be invalid?
			// can potentially collide with id numbers
			if (id[0]=="@")
				id = id.substr(1)
			userSearch = {usernames: [id], limit: 1}
		}
		console.log(id)
		return {
			chain: {
				values: {
					uid: id,
					Userpage: 'userpage',
					Page: 1,
				},
				requests: [
					{type: 'user', fields: "*", query: "id = @uid", limit: 1},
					// ➕ AND, or other template string stuff...
					{name: 'Puserpage', type: 'content', fields: "*", query: "literalType = @Userpage AND createUserId in @user.id AND contentType = @Page", limit: 1},
					//['activity.0id$userIds', {limit: 20, reverse: true}],
					//['commentaggregate.0id$userIds', {limit: 100, reverse: true}],
					//['content.2contentId.3id'],
				],
			},
			check(resp) {
				return resp.user[0]
			},
			ext: {},
		}
	},
	render(resp, ext) {
		let user = resp.user[0]
		let userpage = resp.Puserpage[0]
		//let activity = resp.activity
		//let ca = resp.commentaggregate
		//let content = resp.content
		
		if (user.id == Req.uid) {
			View.flag('myUserPage', true)
			/*let path
			if (userpage)
				path="#editpage/"+userpage.id
			else
				path="#editpage?type=userpage&name="+url_escape(user.name)+"'s user page"
			$editUserPage.href = path*/
		}
		View.set_title(user.username)
		/*$userPageAvatarLink.href = Draw.avatar_url(user)*/
		$userPageAvatar.src = Draw.avatar_url(user, "size=400&crop=true")
		//setPath([["users","Users"], [Nav.entityPath(user), user.name]])
		if (userpage)
			$userPageContents.fill(Markup.convert_lang(userpage.text, userpage.values.markupLang))
		else
			$userPageContents.fill()
	},
	cleanup() {
		$userPageAvatar.src = ""
		$userPageContents.fill()
	},
})
