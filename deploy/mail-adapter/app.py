import hmac
import html
import json
import os
import smtplib
import ssl
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", "5590"))
AUTH_SECRET = os.environ["AUTH_SECRET"]
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.qq.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.environ["SMTP_USER"]
SMTP_PASSWORD = os.environ["SMTP_PASSWORD"]
FROM_ADDRESS = os.getenv("FROM_ADDRESS", SMTP_USER)
FROM_NAME = os.getenv("FROM_NAME", "JobTrace")
MAX_BODY = 16 * 1024


def message_base(to_address: str, subject: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{FROM_NAME} <{FROM_ADDRESS}>"
    message["To"] = to_address
    return message


def password_reset_message(payload: dict) -> EmailMessage:
    reset_url = str(payload["resetUrl"]).strip()
    parsed_url = urlparse(reset_url)
    expires_in = int(payload.get("expiresInSeconds", 3600))
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("invalid reset URL")
    if expires_in < 60 or expires_in > 86400:
        raise ValueError("invalid expiry")
    minutes = max(1, expires_in // 60)
    message = message_base(payload["to"], "重置你的 JobTrace 密码")
    message.set_content(
        f"你正在重置 JobTrace 密码。请在 {minutes} 分钟内打开以下链接：\n\n"
        f"{reset_url}\n\n如果不是你本人操作，请忽略这封邮件。"
    )
    message.add_alternative(
        f"""<!doctype html><html lang="zh-CN"><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">
<div style="max-width:560px;margin:32px auto;padding:28px;border:1px solid #e5e7eb;border-radius:12px">
<h1 style="font-size:22px;margin:0 0 16px">重置 JobTrace 密码</h1>
<p>你正在重置 JobTrace 密码。此链接将在 {minutes} 分钟后失效。</p>
<p style="margin:28px 0"><a href="{html.escape(reset_url, quote=True)}" style="background:#2563eb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">重置密码</a></p>
<p style="font-size:13px;color:#64748b">如果不是你本人操作，请忽略这封邮件。</p>
</div></body></html>""",
        subtype="html",
    )
    return message


def verification_code_message(payload: dict) -> EmailMessage:
    code = str(payload["code"]).strip()
    expires_in = int(payload.get("expiresInSeconds", 600))
    if len(code) != 6 or not code.isdigit():
        raise ValueError("invalid code")
    if expires_in < 60 or expires_in > 3600:
        raise ValueError("invalid expiry")
    minutes = max(1, expires_in // 60)
    message = message_base(payload["to"], "你的 JobTrace 邮箱验证码")
    message.set_content(
        f"你的 JobTrace 邮箱验证码是：{code}\n\n"
        f"验证码将在 {minutes} 分钟后失效，请勿转发给他人。"
    )
    message.add_alternative(
        f"""<!doctype html><html lang="zh-CN"><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">
<div style="max-width:560px;margin:32px auto;padding:28px;border:1px solid #e5e7eb;border-radius:12px">
<h1 style="font-size:22px;margin:0 0 16px">JobTrace 邮箱验证码</h1>
<p>请在 {minutes} 分钟内输入以下验证码：</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">{code}</p>
<p style="font-size:13px;color:#64748b">请勿将验证码转发给他人。如果不是你本人操作，请忽略这封邮件。</p>
</div></body></html>""",
        subtype="html",
    )
    return message


def send(message: EmailMessage) -> None:
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15, context=context) as smtp:
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        smtp.send_message(message)


class Handler(BaseHTTPRequestHandler):
    server_version = "JobTraceMailer/1.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} - {fmt % args}", flush=True)

    def respond(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        self.respond(200, {"status": "ok"}) if self.path == "/health" else self.respond(404, {"error": "not_found"})

    def do_POST(self) -> None:
        if self.path != "/deliver":
            self.respond(404, {"error": "not_found"})
            return
        if not hmac.compare_digest(
            self.headers.get("Authorization", ""), f"Bearer {AUTH_SECRET}"
        ):
            self.respond(401, {"error": "unauthorized"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("invalid body size")
            payload = json.loads(self.rfile.read(length))
            to_address = str(payload["to"]).strip()
            if "@" not in to_address or "\n" in to_address or "\r" in to_address:
                raise ValueError("invalid recipient")
            template = payload["template"]
            if template == "password_reset":
                message = password_reset_message(payload)
            elif template == "email_verification_code":
                message = verification_code_message(payload)
            else:
                raise ValueError("unsupported template")
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            self.respond(400, {"error": "invalid_payload"})
            return
        try:
            send(message)
        except Exception as exc:
            print(f"delivery failed: {type(exc).__name__}", flush=True)
            self.respond(502, {"error": "delivery_failed"})
            return
        self.respond(200, {"delivered": True})


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
