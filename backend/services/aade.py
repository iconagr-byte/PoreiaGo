import asyncio
import uuid
import logging

logger = logging.getLogger(__name__)

async def transmit_invoice_to_aade(tenant_id: int, booking_id: int, amount: float) -> str:
    """
    Mock implementation of AADE myDATA integration.
    In a real scenario, this would format an XML payload and POST to the AADE REST API.
    """
    logger.info(f"Preparing AADE transmission for Booking {booking_id} (Tenant {tenant_id}) - Amount: €{amount}")
    
    # Simulate network delay for AADE API
    await asyncio.sleep(1.5)
    
    # Generate a mock MARK (Μοναδικός Αριθμός Καταχώρησης)
    mark = f"MARK-{uuid.uuid4().hex[:12].upper()}"
    
    logger.info(f"Successfully transmitted to AADE. Received MARK: {mark}")
    return mark
