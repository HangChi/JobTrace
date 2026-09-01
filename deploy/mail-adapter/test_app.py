import os
import smtplib
import unittest

os.environ.setdefault("AUTH_SECRET", "test-secret")
os.environ.setdefault("SMTP_USER", "sender@example.com")
os.environ.setdefault("SMTP_PASSWORD", "test-password")

from app import is_invalid_recipient_error


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


if __name__ == "__main__":
    unittest.main()
