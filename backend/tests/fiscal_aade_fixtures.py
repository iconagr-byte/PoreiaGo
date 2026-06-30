"""Shared fixtures for fiscal / AADE E2E tests."""

from __future__ import annotations


def aade_success_response_xml(*, mark: str = "400000012345678", uid: str = "uid-e2e-test-abcdefghijklmnopqrstuvwxyz12") -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<ResponseDoc>
  <response>
    <statusCode>Success</statusCode>
    <invoiceUid>{uid}</invoiceUid>
    <invoiceMark>{mark}</invoiceMark>
  </response>
</ResponseDoc>"""


def aade_validation_error_xml(message: str = "Invalid issuer VAT") -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<ResponseDoc>
  <response>
    <statusCode>ValidationError</statusCode>
    <errors>
      <error>
        <message>{message}</message>
      </error>
    </errors>
  </response>
</ResponseDoc>"""
