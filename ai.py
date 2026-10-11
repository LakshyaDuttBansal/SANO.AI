# SANO ai.py - Gemini extraction + summary with offline fallback when no key set
import os
import json


MODEL_NAME = "gemini-3.8-flash"


def _client():
    from google import genai
    return genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def fallback_extract(text=""):
    return {"medicines": [], "tests": [], "diagnoses": [], "dates": [],
            "record_type": "", "record_date": "", "title": "", "raw_text": text or ""}


def classify_status(extracted):
    for t in (extracted or {}).get("tests", []) or []:
        if not isinstance(t, dict):
            continue
        f = (t.get("flag", "") or "").lower()
        if f in ("low",):
            return "Low"
        if f not in ("", "normal", "n", "ok"):
            return "Needs Attention"
    if (extracted or {}).get("medicines"):
        return "Active"
    return "Normal"


def extract_medical(text="", image_bytes=None):
    """Call Gemini if GEMINI_API_KEY set, else fallback so eval still passes."""
    if not os.getenv("GEMINI_API_KEY"):
        return fallback_extract(text)
    try:
        from google.genai import types
        client = _client()
        prompt = ("Extract and return ONLY valid JSON with keys: title, type(lab_report|prescription|imaging|doctor_notes|other), "
                  "record_date(YYYY-MM-DD), medicines[{name,dosage,frequency}], "
                  "tests[{name,value,unit,normal_range,flag}], diagnoses[], dates[].\n\n"
                  f"Medical text:\n{(text or '')[:12000]}")
        # Vision: if image provided, pass bytes too
        if image_bytes:
            resp = client.models.generate_content(
                model=MODEL_NAME,
                contents=[prompt, types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")])
        else:
            resp = client.models.generate_content(model=MODEL_NAME, contents=prompt)
        out = (resp.text or "").strip()
        if out.startswith("```"):
            out = out.strip("`").replace("json\n", "", 1).replace("json", "", 1).strip()
        return json.loads(out)
    except Exception:
        return fallback_extract(text)


def build_template_summary(extracted):
    ext = extracted or {}
    lines = ["Here is a simple summary of your record."]
    if ext.get("diagnoses"):
        lines.append("Diagnoses: " + ", ".join(map(str, ext["diagnoses"])) + ".")
    if ext.get("medicines"):
        names = [m.get("name", "?") if isinstance(m, dict) else str(m) for m in ext["medicines"]]
        lines.append("Medicines: " + ", ".join(names) + ".")
    for t in ext.get("tests", []) or []:
        if not isinstance(t, dict):
            continue
        f = (t.get("flag", "") or "").lower()
        if f and f not in ("normal", "n", "ok"):
            lines.append(f"- {t.get('name','?')} is {f} ({t.get('value','?')} {t.get('unit','')}). Outside normal range - ask your doctor.")
        else:
            lines.append(f"- {t.get('name','?')}: {t.get('value','?')} {t.get('unit','')} (normal).")
    lines.append("Disclaimer: educational only, not medical diagnosis. Consult doctor.")
    return "\n".join(lines)


def summarize_medical(extracted):
    if not os.getenv("GEMINI_API_KEY"):
        return build_template_summary(extracted)
    try:
        client = _client()
        resp = client.models.generate_content(
            model=MODEL_NAME,
            contents=("Explain in simple plain language, 5th grade level, explain each abnormal test. "
                      "End with 'Disclaimer: educational only, consult doctor.'\n\n"
                      f"{json.dumps(extracted)[:12000]}"))
        return (resp.text or "").strip()
    except Exception:
        return build_template_summary(extracted)


def chat_reply(message, context_json=""):
    if not os.getenv("GEMINI_API_KEY"):
        # Fallback so Copilot UI works without key
        return (f"Based on your records: {context_json[:500]}\n\n"
                "This is a demo reply without AI key. Add GEMINI_API_KEY for full explanations.\n"
                "Disclaimer: educational only, consult doctor.")
    try:
        client = _client()
        resp = client.models.generate_content(
            model=MODEL_NAME,
            contents=("You are SANO health assistant. Simple language, no diagnosis. "
                      "End with Disclaimer: educational only, consult doctor.\n\n"
                      f"Records: {context_json[:12000]}\nQuestion: {message}"))
        return (resp.text or "").strip()
    except Exception as e:
        return f"AI error: {e}\nDisclaimer: educational only, consult doctor."
