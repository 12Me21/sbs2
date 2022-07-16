'use strict'

class PageView extends BaseView {
	Start({id, query}) {
		let field = 'number'==typeof id ? 'id' : 'hash'
		return {
			chain: {
				values: {
					key: id,
				},
				requests: [
					{type: 'content', fields: "*", query: `${field} = @key`},
					{name: 'Mpinned', type: 'message', fields: "*", query: "id IN @content.values.pinned"},
					{type: 'user', fields: "*", query: "id IN @content.createUserId OR id IN @Mpinned.createUserId OR id IN @Mpinned.editUserId"},
					{type: 'watch', fields: "*", query: "contentId IN @content.id"}
				],
			},
			check: resp=>resp.content[0]
		}
	}
	Init() {
		this.$watching.onchange = Draw.event_lock(done=>{
			// todo: check for err
			Req.set_watch(this.page_id, this.$watching.checked).do = resp=>{
				done()
			}
		})
	}
	Render({content:[page], Mpinned:pinned, user, watch}) {
		this.page_id = page.id
		PageView.rooms[this.id] = this
		
		this.update_page(page, user)
		this.update_watch(watch[0])
		
		/*this.userlist.set_status("active")
		this.userlist.redraw()*/
		
		this.Slot.set_entity_title(page)
		
		/*if (pinned instanceof Array && pinned.length) {
			let separator = document.createElement('div')
			separator.className = "messageGap"
			this.$extra.prepend(separator)
			
			const list = document.createElement('message-list')
			this.pinned_list = new MessageList(list, this.page_id)
			this.$extra.prepend(list)
			
			Entity.link_comments({message:pinned, user})
			
			for (const m of pinned)
				this.pinned_list.display_message(m, false)
		}*/
		
		//let can_edit = /u/i.test(page.permissions[Req.uid]) // unused
		
		this.Slot.add_header_links([
			{label:"logs", href:"#comments/"+page.id+"?r"},
			{label:"edit", href: "#editpage/"+page.id},
		])
	}
	// 8:10;35
	Destroy(type) {
		delete PageView.rooms[this.page_id]
	}

	// render the watch state
	update_watch(watch) {
		this.watch = watch
		this.$watching.checked = !!this.watch
	}
	update_page(page, user) {
		this.page = page
		this.author = user[~page.createUserId]
		if (page.contentType==CODES.file) {
			// messy code
			let ne = Draw.button("Set Avatar", e=>{
				Req.me.avatar = this.page.hash
				Req.write(Req.me).do = (resp, err)=>{
					if (!err)
						print('set avatar')
					else
						alert('edit failed')
				}
			})
			let b = Draw.button("Show in sidebar", e=>{
				FileUploader.show_content(this.page)
				Sidebar.tabs.select('file')
			})
			this.$page_contents.fill([ne, b])
			let p =document.createElement('pre')
			p.textContent = JSON.stringify(this.page, null, 1)
			this.$page_contents.append(p)
		} else {
			Markup.convert_lang(page.text, page.values.markupLang, this.$page_contents, {intersection_observer: View.observer})
		}
		this.$create_date.lastChild.replaceWith(Draw.time_ago(page.createDate2))
		this.$author.fill(Draw.user_label(this.author))
		//this.$edit_date
	}
}
PageView.template = HTML`
<view-root class='COL'>
	<scroll-outer class='page-container' $=page_container>
		<div class='pageInfoPane bar rem1-5'>
			<label>Watching: <input type=checkbox $=watching></label>
			<span $=author style='margin: 0 0.5rem;'></span>
			<span $=create_date>Created: <time></time></span>
		</div>
		<div class='pageContents' $=page_contents></div>
	</scroll-outer>
</view-root>
`
PageView.rooms = {__proto__:null}

View.register('content', PageView)
View.register('pages', {
	Redirect(location) {location.type='content'},
})
View.register('category', {
	Redirect(location) {location.type='content'},
})
