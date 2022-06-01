'use strict'

View.add_view('user', {
	Start({id, query}) {
		let user_query
		if (typeof id == 'number') {
			user_query = "id = @uid"
		} else {
			// todo: maybe username without @ should be invalid?
			// can potentially collide with id numbers
			if (id[0]=="@")
				id = id.substr(1)
			user_query = "username = @uid"
		}
		return {
			chain: {
				values: {
					uid: id,
					Userpage: 'userpage',
					Page: 1,
				},
				requests: [
					{type: 'user', fields: "*", query: user_query, limit: 1},
					{name: 'Puserpage', type: 'content', fields: "*", query: "!userpage(@user.id)"},
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
	Render(resp, ext) {
		let user = resp.user[0]
		let userpage = resp.Puserpage[0]
		//let activity = resp.activity
		//let ca = resp.commentaggregate
		//let content = resp.content
		
		if (user.id == Req.uid) {
			View.flag('myUserPage', true)
			//path="#editpage?type=userpage&name="+url_escape(user.name)+"'s user page"
		}
		View.set_title(" "+user.username+" ") // todo: this is unsafe because of text direction. get set_entity_title working again
		$userPageAvatar.src = Draw.avatar_url(user, "size=400&crop=true")
		$userPageLink.hidden = !userpage
		if (userpage)
			$userPageLink.href = "#page/"+userpage.id
		if (userpage)
			$userPageContents.fill(Markup.convert_lang(userpage.text, userpage.values.markupLang))
		else
			$userPageContents.fill()
	},
	Cleanup() {
		$userPageAvatar.src = ""
		$userPageContents.fill()
	},
})
