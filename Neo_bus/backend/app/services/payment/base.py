from abc import ABC, abstractmethod
from typing import Dict, Any

class BasePaymentGateway(ABC):
    @abstractmethod
    def create_order(self, booking_id: str, amount: float, currency: str = "INR") -> Dict[str, Any]:
        """Generate a payment order on the gateway side."""
        pass
        
    @abstractmethod
    def verify_signature(self, payload: Dict[str, Any], signature: str) -> bool:
        """Verify the payment gateway verification signature."""
        pass
