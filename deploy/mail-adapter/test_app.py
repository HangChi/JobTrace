import os
import smtplib
import unittest

os.environ.setdefault("AUTH_SECRET", "test-secret")
os.environ.setdefault("SMTP_USER", "sender@example.com")
os.environ.setdefault("SMTP_PASSWORD", "test-password")

from app import is_invalid_recipient_error, scheduled_reminder_message


class DeliveryErrorTest(unittest.TestCase):
    def test_recognizes_qq_nonexistent_recipient_response(self) -> None:
        error = smtplib.SMTPDataError(
            550,
            b"The recipient may contain a non-existent account, please check the recipient address.",
        )
        self.assertTrue(is_invalid_recipient_error(error))

    def test_does_not_reclassify_other_smtp_errors(self) -> None:
        self.assertFalse(
            is_invalid_recipient_error(
                smtplib.SMTPDataError(550, b"content denied")
            )
        )
        self.assertFalse(
            is_invalid_recipient_error(smtplib.SMTPDataError(451, b"try later"))
        )

    def test_reminder_template_escapes_html(self) -> None:
        message = scheduled_reminder_message(
            {
                "to": "person@example.com",
                "companyName": "A <script>",
                "positionName": "Engineer",
                "title": "Follow up <today>",
                "eventAt": "2026-10-08 14:00",
                "applicationUrl": "https://jobtrace.example/applications/1",
            }
        )
        html_body = message.get_body(preferencelist=("html",)).get_content()
        self.assertIn("A &lt;script&gt;", html_body)
        self.assertIn("Follow up &lt;today&gt;", html_body)
        self.assertNotIn("<script>", html_body)

    def test_reminder_template_rejects_unsafe_url(self) -> None:
        with self.assertRaises(ValueError):
            scheduled_reminder_message(
                {
                    "to": "person@example.com",
                    "companyName": "A",
                    "positionName": "Engineer",
                    "title": "Follow up",
                    "eventAt": "2026-10-08 14:00",
                    "applicationUrl": "javascript:alert(1)",
                }
            )


if __name__ == "__main__":
    unittest.main()
