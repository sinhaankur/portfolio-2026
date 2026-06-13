from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


OUTPUT_PATH = "webos-assets/UniverseEngineTV_UX_Scenario.pdf"


def build_story():
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleLarge",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        spaceAfter=8,
    )
    h_style = ParagraphStyle(
        "Heading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        spaceBefore=8,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        spaceAfter=4,
    )

    story = []
    story.append(Paragraph("Universe Engine TV - UX Scenario", title_style))
    story.append(Paragraph("Document version: 1.0 | App version: 0.0.1", body_style))
    story.append(Spacer(1, 4))

    story.append(Paragraph("1. App Overview", h_style))
    story.append(
        Paragraph(
            "Universe Engine TV is a remote-friendly ambient visual app for webOS TVs. "
            "It provides three main modes: Solar System, Known Space, and Signature Screen.",
            body_style,
        )
    )

    story.append(Paragraph("2. Target Devices and Input", h_style))
    story.append(Paragraph("- Device requirement: None", body_style))
    story.append(Paragraph("- Remote support: Both Magic and general remote", body_style))
    story.append(Paragraph("- No gamepad, camera, gesture, or voice-only dependency", body_style))

    story.append(Paragraph("3. Navigation Model", h_style))
    story.append(Paragraph("- Left/Right or Up/Down: move focus between mode buttons", body_style))
    story.append(Paragraph("- OK/Enter: activate selected mode", body_style))
    story.append(Paragraph("- Back: return to home selection state", body_style))

    story.append(Paragraph("4. Primary User Flow", h_style))
    story.append(Paragraph("Step 1: User launches Universe Engine TV.", body_style))
    story.append(Paragraph("Step 2: Focus starts on Solar System mode.", body_style))
    story.append(Paragraph("Step 3: User switches between available modes with the remote.", body_style))
    story.append(Paragraph("Step 4: Preview panel updates with selected mode status.", body_style))
    story.append(Paragraph("Step 5: If user is idle, app auto-cycles modes like a screensaver.", body_style))

    story.append(Paragraph("5. Idle and Screensaver Behavior", h_style))
    story.append(
        Paragraph(
            "When no user input is detected for the idle interval, the app enters auto-cycle mode. "
            "Modes rotate in sequence and status text updates accordingly.",
            body_style,
        )
    )

    story.append(Paragraph("6. Non-Functional Notes", h_style))
    story.append(Paragraph("- No account/login required", body_style))
    story.append(Paragraph("- No payment or subscription flow", body_style))
    story.append(Paragraph("- No in-app ads", body_style))
    story.append(Paragraph("- No adult content", body_style))
    story.append(Paragraph("- No personal data collection", body_style))

    story.append(Paragraph("7. QA Verification Checklist", h_style))
    story.append(Paragraph("- Launch app and confirm default focus state", body_style))
    story.append(Paragraph("- Verify remote navigation and mode activation", body_style))
    story.append(Paragraph("- Verify Back behavior", body_style))
    story.append(Paragraph("- Verify idle auto-cycle starts and rotates scenes", body_style))
    story.append(Paragraph("- Verify stability on 1080p and 720p package variants", body_style))

    story.append(Paragraph("8. Contact", h_style))
    story.append(Paragraph("Support email: support@sinhaankur.com", body_style))

    return story


def main():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="Universe Engine TV UX Scenario",
        author="Ankur Sinha",
    )
    doc.build(build_story())
    print(f"Generated {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
