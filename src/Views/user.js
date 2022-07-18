'use strict'

class UserView extends BaseView {
	Start({id, query}) {
		let user_query
		if ('number'==typeof id) {
			user_query = "id = @uid"
		} else if ('string'==typeof id) {
			user_query = "username = @uid"
		} else {
			return {
				quick: true,
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
		}
	}
	Render(resp) {
		let user = resp.user[0]
		let userpage = resp.Puserpage[0]
		//let activity = resp.activity
		//let ca = resp.commentaggregate
		//let content = resp.content
		this.Slot.set_title(" "+user.username+" ") // todo: this is unsafe because of text direction. get set_entity_title working again
		
		this.$avatar.src = Draw.avatar_url(user, 300)
		if (userpage) {
			Markup.convert_lang(userpage.text, userpage.values.markupLang, this.$contents)
			this.Slot.add_header_links([
				{label:"page", href:"#page/"+userpage.id},
			])
		}
	}
	Quick() {
		View.set_title("todo")
	}
}

UserView.template = HTML`
<view-root class='userPageBox'>
	<a $=avatar_link class='userPageAvatar'>
		<img $=avatar width=300 height=300>
	</a>
	<div $=contents class='userPageContents pageContents Markup'></div>
</view-root>
`

View.register('user', UserView)
