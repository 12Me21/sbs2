'use strict'

View.add_view('user', {
	Start({id, query}) {
		let user_query
		if ('number'==typeof id) {
			user_query = "id = @uid"
		} else if ('string'==typeof id) {
			user_query = "username = @uid"
		} else {
			return {
				quick: true,
				ext: {},
			}
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
	Quick(ext) {
		View.set_title("todo")
	},
	Cleanup() {
		$userPageAvatar.src = ""
		$userPageContents.fill()
	},
})
