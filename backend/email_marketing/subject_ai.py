"""Προτάσεις subject lines — OpenAI ή heuristic fallback."""

from __future__ import annotations

import os
import re


def _heuristic_subjects(body_text: str, campaign_name: str = "") -> list[str]:
    name = (campaign_name or "Προσφορά").strip()[:40]
    snippets = re.sub(r"<[^>]+>", " ", body_text or "")
    snippets = " ".join(snippets.split())[:120]
    return [
        f"✨ {name} — Μόνο για εσάς",
        f"Μην το χάσετε: {name}",
        f"{snippets[:50]}…" if len(snippets) > 20 else f"Ειδική πρόσκληση: {name}",
    ][:3]


async def generate_subject_lines(
    *,
    body_html: str,
    campaign_name: str = "",
    preheader: str = "",
) -> dict:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    prompt_text = re.sub(r"<[^>]+>", " ", body_html or "")[:2000]
    if preheader:
        prompt_text = f"{preheader}\n{prompt_text}"

    if api_key:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "Δώσε ακριβώς 3 πιασάρικους τίτλους email στα Ελληνικά, "
                                    "μία γραμμή ο καθένας, χωρίς αρίθμηση."
                                ),
                            },
                            {
                                "role": "user",
                                "content": f"Καμπάνια: {campaign_name}\n\nΚείμενο:\n{prompt_text[:1500]}",
                            },
                        ],
                        "temperature": 0.8,
                        "max_tokens": 200,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    text = data["choices"][0]["message"]["content"]
                    lines = [
                        ln.strip().lstrip("0123456789.-) ")
                        for ln in text.split("\n")
                        if ln.strip()
                    ]
                    subjects = [l for l in lines if len(l) > 5][:3]
                    if len(subjects) >= 2:
                        return {"subjects": subjects, "source": "openai"}
        except Exception:
            pass

    return {
        "subjects": _heuristic_subjects(body_html, campaign_name),
        "source": "heuristic",
    }
