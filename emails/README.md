# Login emails

Branded Supabase auth templates for Poop Pool login. Paste them in Supabase → Authentication → Emails → Templates.

| Supabase template | File | Subject |
|---|---|---|
| Magic link | `login-code.html` | `{{ .Token }} is your Gross Income code` |
| Confirm sign up | `signup-code.html` | `{{ .Token }} is your Poop Pool code` |

- The app calls `signInWithOtp`, so new emails get **Confirm sign up** and returning ones get **Magic link**. The other templates (invite, change email, reset password) are never sent.
- The code (`{{ .Token }}`) is the main way in, because it works inside the iPhone home screen app.
- The link uses `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`, not `{{ .ConfirmationURL }}`, so it stays on our own domain.
- No images, one card, light HTML. That keeps the text-to-HTML ratio friendly to spam filters.
- If a test email shows `{{ .Token }}` literally in the subject, use `Your Gross Income login code` instead.
