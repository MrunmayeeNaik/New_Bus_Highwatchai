import logging
# pyrefly: ignore [missing-import]
import aiosmtplib
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)

async def send_email(to_email: str, subject: str, body: str) -> bool:
    if not settings.SMTP_HOST:
        logger.info(f"[MOCK EMAIL] To: {to_email} | Subject: {subject} | Body: {body}")
        print(f"\n=======================================================\n"
              f"[MOCK EMAIL] TO: {to_email}\n"
              f"SUBJECT: {subject}\n"
              f"BODY:\n{body}\n"
              f"=======================================================\n")
        return True
        
    try:
        message = MIMEText(body, "html" if "<html" in body.lower() else "plain")
        message["From"] = settings.SMTP_FROM
        message["To"] = to_email
        message["Subject"] = subject
        
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_PORT == 465,
            start_tls=settings.SMTP_PORT == 587
        )
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        # Always fallback to console printing in case SMTP server is down/misconfigured
        print(f"\n=======================================================\n"
              f"[SMTP FAILED - FALLBACK] TO: {to_email}\n"
              f"SUBJECT: {subject}\n"
              f"BODY:\n{body}\n"
              f"=======================================================\n")
        return False
