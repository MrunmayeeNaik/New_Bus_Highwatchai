import uuid
from typing import Dict, Any
from app.services.payment.base import BasePaymentGateway

class StripeGateway(BasePaymentGateway):
    def create_order(self, booking_id: str, amount: float, currency: str = "INR") -> Dict[str, Any]:
        return {
            "order_id": f"ch_{uuid.uuid4().hex[:16]}",
            "status": "requires_payment_method",
            "amount": amount,
            "currency": currency.lower(),
            "gateway": "stripe"
        }
        
    def verify_signature(self, payload: Dict[str, Any], signature: str) -> bool:
        # Mock Stripe signature verification: check if signature has correct prefix
        return signature.startswith("sig_") or signature == "stripe_success_sig"

class RazorpayGateway(BasePaymentGateway):
    def create_order(self, booking_id: str, amount: float, currency: str = "INR") -> Dict[str, Any]:
        return {
            "order_id": f"order_{uuid.uuid4().hex[:16]}",
            "status": "created",
            "amount": int(amount * 100),  # Razorpay expects paise
            "currency": currency,
            "gateway": "razorpay"
        }
        
    def verify_signature(self, payload: Dict[str, Any], signature: str) -> bool:
        return signature.startswith("rzp_") or signature == "razorpay_success_sig"

class WalletGateway(BasePaymentGateway):
    def create_order(self, booking_id: str, amount: float, currency: str = "INR") -> Dict[str, Any]:
        return {
            "order_id": f"wal_{uuid.uuid4().hex[:16]}",
            "status": "pending_deduction",
            "amount": amount,
            "currency": currency,
            "gateway": "wallet"
        }
        
    def verify_signature(self, payload: Dict[str, Any], signature: str) -> bool:
        return signature == "wallet_authorized"

class PhonePeGateway(BasePaymentGateway):
    def create_order(self, booking_id: str, amount: float, currency: str = "INR") -> Dict[str, Any]:
        return {
            "order_id": f"pp_{uuid.uuid4().hex[:16]}",
            "status": "created",
            "amount": amount,
            "currency": currency,
            "gateway": "phonepe"
        }
        
    def verify_signature(self, payload: Dict[str, Any], signature: str) -> bool:
        return True

class UPIGateway(BasePaymentGateway):
    def create_order(self, booking_id: str, amount: float, currency: str = "INR") -> Dict[str, Any]:
        return {
            "order_id": f"upi_{uuid.uuid4().hex[:16]}",
            "status": "created",
            "amount": amount,
            "currency": currency,
            "gateway": "upi"
        }
        
    def verify_signature(self, payload: Dict[str, Any], signature: str) -> bool:
        return True

# Helper registry of plug-and-play gateways
GATEWAYS = {
    "stripe": StripeGateway(),
    "razorpay": RazorpayGateway(),
    "wallet": WalletGateway(),
    "phonepe": PhonePeGateway(),
    "upi": UPIGateway(),
    "netbanking": UPIGateway(),
    "creditcard": StripeGateway(),
    "debitcard": StripeGateway()
}

def get_gateway(name: str) -> BasePaymentGateway:
    name_lower = name.lower()
    return GATEWAYS.get(name_lower, GATEWAYS["stripe"])
