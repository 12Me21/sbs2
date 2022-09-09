'use strict'

class AccountView extends BaseView {
	Start({id, query}) {
		return {quick: true}
	}
	Init() {
		this.$old_password.append(
			Draw.password_input("password")
		)
		this.$new_password.append(
			Draw.password_input("new_password", true)
		)
		this.$logout_all.onclick = ev=>{
			Req.request('User/invalidateall', null, null).do = (resp, err)=>{
				if (err) {
					alert("❌ invalidate failed\n"+err)
				} else {
					Nav.reload()
				}
			}
		}
		this.$form.onsubmit = ev=>{
			ev.preventDefault()
			let opw = ev.target.password.value
			let pw1 = ev.target.new_password.value
			let pw2 = ev.target.new_password2.value
			if (pw1 !== pw2) {
				alert("❌ passwords don't match")
				ev.target.new_password.value = ""
				ev.target.new_password2.value = ""
				return
			}
			console.log('passwording', opw, pw1)
			Req.request('User/privatedata', null, {
				currentPassword: opw,
				password: pw1,
			}).do = (resp, err)=>{
				if (err) {
					alert("❌ password change failed\n"+err)
				} else {
					Nav.reload()
				}
			}
		}
	}
	Quick() {
		this.Slot.set_title("Account")
	}
	Destroy() {
	}
}

AccountView.template = HTML`
<view-root>
	<div class=registerBox>
		<h2>Change Password</h2>
		<form $=form method=dialog autocomplete=off>
			<div class='ROW' $=old_password>
				current password:&nbsp;
			</div>
			<br>
			<div class='ROW' $=new_password>
				new password:&nbsp;
			</div>
			<br>
			<button>Change Password</button>
		</form>
	</div class=registerBox>
	<hr>
	<div class=registerBox>
		<button $=logout_all>Log out all sessions</button>
	</div class=registerBox>
</view-root>
`

View.register('account', AccountView)
