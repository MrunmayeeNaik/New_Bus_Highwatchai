import logging

logger = logging.getLogger(__name__)

def send_sms(phone_number: str, message: str) -> bool:
    # Print mock SMS to stdout for testing
    logger.info(f"[MOCK SMS] To: {phone_number} | Message: {message}")
    print(f"\n=======================================================\n"
          f"[MOCK SMS] TO: {phone_number}\n"
          f"MESSAGE: {message}\n"
          f"=======================================================\n")
    return True
