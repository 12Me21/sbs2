<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('settings', {
	className: 'settingsMode',
	render: function() {
		setTitle("Account Settings")
	},
	init: function() {
		$loginForm.login.onclick = function(e) {
			e.preventDefault()
			Req.authenticate($loginForm.username.value, $loginForm.password.value, function(e, resp) {
			})
		}
		$logOut.onclick = function(e) {
			Req.logOut()
		}

		$registerForm.$registerButton.onclick = function(e) {
			e.preventDefault()
			registerError("Registering...")
			var data = readRegisterFields()
			if (data.error) {
				registerError(data.error)
				return
			}
			Req.register(data.username, data.password, data.email, function(e, resp) {
				console.log(resp)
				if (!e) {
					sendConfirmationEmail()
				} else {
					if (e == 'error' && resp) {
						registerError(resp.errors, "Registration failed:")
					} else if (e == 'rate') {
						registerError("slow down!")
					} else {
						registerError("unknown error")
					}
				}
			})
		}
		$resendEmail.onclick = function(e) {
			e.preventDefault()
			sendConfirmationEmail()
		}
		$registerConfirm.onclick = function(e) {
			e.preventDefault()
			registerError("Confirming...")
			// todo: validate the key client-side maybe
			Req.confirmRegister($emailCode.value, function(e, resp) {
				if (!e) {
					registerError("Registration Complete")
					// todo: something here
				} else {
					registerError(resp, "Confirmation failed:")
				}
			})
		}
		$passwordForm.onsubmit = function(e) {
			e.preventDefault()
			var form = e.target
			registerError("Sending email...")
			if (form.email.value) {
				Req.sendResetEmail(form.email.value, function(e, resp) {
					if (!e)
						registerError("Sent password reset email")
					else
						registerError(resp, "Sending email failed:")
				})
			}
		}
		$passwordForm2.onsubmit = function(e) {
			e.preventDefault()
			registerError("Resetting password...")
			var form = e.target
			var key = form.key.value
			var password = form.password.value
			if (key && password && password==form.password2.value) {
				Req.resetPassword(key, password, function(e, resp) {
					if (!e)
						registerError("Password reset")
					else
						registerError(resp, "Failed to reset password:")
				})
			}
		}

		$changeForm.submit.onclick = function(e) {
			registerError("Updating data...", undefined, $userSettingsError)
			e.preventDefault()
			var data = readChangeFields()
			if (data.error) {
				registerError(data.error)
				return
			}
			delete data.error
			Req.setSensitive(data, function(e, resp) {
				if (!e)
					registerError("Updated", undefined, $userSettingsError)
				else
					registerError(resp, "Failed:", $userSettingsError)
			})
		}
	}
})

//todo: clean this up
function registerError(message, title, element) {
	var text = ""
	if (message == undefined)
		text = ""
	else if (message instanceof Array)
		text = message.join("\n")
	else if (typeof message == 'string') {
		text = message
	} else {
		//todo: this tells us which fields are invalid
		// so we can use this to highlight them in red or whatever
		for (var key in message) {
			text += key+": "+message[key]+"\n"
		}
	}
	if (title)
		text = title+"\n"+text
	;(element||$registerError).textContent = text
}

function readChangeFields() {
	var form = $changeForm
	var data = {
		oldPassword: form.oldPassword.value,
		username: form.username.value,
		password: form.password.value,
		email: form.email.value
	}
	data.error = {}

	if (!data.oldPassword)
		data.error.oldPassword = "Old password is required"

	if (!data.username)
		delete data.username
	
	if (data.password) {
		if (data.password != form.password2.value)
			data.error.password2 = "Passwords don't match"
	} else
		delete data.password

	if (data.email) {
		if (data.email != form.email2.value)
			data.error.email2 = "Emails don't match"
	} else
		delete data.email

	if (!Object.keys(data.error).length)
		data.error = null
	return data
}

function readRegisterFields() {
	var data = {
		username: $registerForm.username.value,
		password: $registerForm.password.value,
		email: $registerForm.email.value,
	}
	data.error = {}
	if (data.password.length < 8)
		data.error.password = "Password too short"
	if (data.username.length < 2)
		data.error.username = "Username too short"
	if (data.username.length > 20)
		data.error.username = "Username too long"
	if (data.password != $registerForm.password2.value)
		data.error.password2 = "Passwords don't match"
	if (data.email != $registerForm.email2.value)
		data.error.email2 = "Emails don't match"
	if (!Object.keys(data.error).length)
		data.error = null
	return data
}

function sendConfirmationEmail() {
	var email = $registerForm.email.value
	if (!email) {
		registerError({email: "No email"})
	} else {
		registerError("Sending email...")
		Req.sendEmail(email, function(e, resp){
			if (!e) {
				registerError("Confirmation email sent")
			} else if (e == 'error') {
				registerError({email: resp}, "Failed to send confirmation email:")
			} else if (e == 'rate') {
				registerError("Slow down!")
			} else {
				registerError("unknown error")
			}
		})
	}
}

<!--/*
}(window)) //*/ // pass external values
