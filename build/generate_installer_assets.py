from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
ART_SOURCE = BUILD / "installer-art-source-v1.png"
LOGO_SOURCE = ROOT / "assets" / "brand" / "deepseek-codex-ink-mark.png"

# Keep the native MUI layout proportions while providing enough source pixels
# for Windows to scale cleanly at 125% / 150% display density.
BITMAP_SCALE = 3
SIDEBAR_BASE_SIZE = (164, 314)
HEADER_BASE_SIZE = (150, 57)
SIDEBAR_SIZE = tuple(value * BITMAP_SCALE for value in SIDEBAR_BASE_SIZE)
HEADER_SIZE = tuple(value * BITMAP_SCALE for value in HEADER_BASE_SIZE)

# NSIS stretches the 164x314 wizard bitmap into a font-scaled control whose
# horizontal and vertical scale factors differ slightly. Pre-compensate the
# circular logo only so it renders as a true circle in the installer window.
NSIS_LOGO_X_COMPENSATION = 1.125

INK = (7, 11, 16)
PANEL = (11, 18, 26)
ORANGE = (244, 119, 33)
MUTED = (79, 91, 105)


def fit_art(size: tuple[int, int]) -> Image.Image:
    art = Image.open(ART_SOURCE).convert("RGB")
    art = ImageOps.fit(art, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    art = ImageEnhance.Contrast(art).enhance(1.06)
    art = ImageEnhance.Color(art).enhance(0.92)
    veil = Image.new("RGB", size, INK)
    return Image.blend(art, veil, 0.14)


def add_logo(
    base: Image.Image,
    size: int,
    center: tuple[int, int],
    horizontal_compensation: float = 1.0,
) -> Image.Image:
    canvas = base.convert("RGBA")
    logo = Image.open(LOGO_SOURCE).convert("RGBA")
    logo.thumbnail((size, size), Image.Resampling.LANCZOS)
    if horizontal_compensation != 1.0:
        compensated_width = round(logo.width * horizontal_compensation)
        logo = logo.resize((compensated_width, logo.height), Image.Resampling.LANCZOS)

    halo = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    halo_draw = ImageDraw.Draw(halo)
    radius_y = int(size * 0.55)
    radius_x = round(radius_y * horizontal_compensation)
    halo_draw.ellipse(
        (
            center[0] - radius_x,
            center[1] - radius_y,
            center[0] + radius_x,
            center[1] + radius_y,
        ),
        fill=(244, 119, 33, 38),
    )
    halo = halo.filter(ImageFilter.GaussianBlur(max(5, size // 9)))
    canvas.alpha_composite(halo)

    x = center[0] - logo.width // 2
    y = center[1] - logo.height // 2
    canvas.alpha_composite(logo, (x, y))
    return canvas


def make_sidebar() -> None:
    sidebar = fit_art(SIDEBAR_SIZE)
    sidebar = add_logo(
        sidebar,
        104 * BITMAP_SCALE,
        (82 * BITMAP_SCALE, 129 * BITMAP_SCALE),
        horizontal_compensation=NSIS_LOGO_X_COMPENSATION,
    )
    sidebar.convert("RGB").save(BUILD / "installerSidebar.bmp", format="BMP")

    uninstall = fit_art(SIDEBAR_SIZE)
    uninstall = ImageEnhance.Brightness(uninstall).enhance(0.86)
    uninstall = add_logo(
        uninstall,
        90 * BITMAP_SCALE,
        (82 * BITMAP_SCALE, 126 * BITMAP_SCALE),
        horizontal_compensation=NSIS_LOGO_X_COMPENSATION,
    )
    uninstall.convert("RGB").save(BUILD / "uninstallerSidebar.bmp", format="BMP")


def make_header() -> None:
    # MUI only grants a 150x57 area on the right. Keep this graphic quiet and
    # use four neutral nodes so it reads as a compact installation journey.
    background = Image.new("RGB", HEADER_SIZE, PANEL)
    draw = ImageDraw.Draw(background)

    y = 28 * BITMAP_SCALE
    xs = tuple(value * BITMAP_SCALE for value in (18, 56, 94, 132))
    for index in range(len(xs) - 1):
        draw.line(
            (
                xs[index] + 6 * BITMAP_SCALE,
                y,
                xs[index + 1] - 6 * BITMAP_SCALE,
                y,
            ),
            fill=MUTED,
            width=BITMAP_SCALE,
        )
    for x in xs:
        draw.ellipse(
            (
                x - 5 * BITMAP_SCALE,
                y - 5 * BITMAP_SCALE,
                x + 5 * BITMAP_SCALE,
                y + 5 * BITMAP_SCALE,
            ),
            outline=MUTED,
            width=2 * BITMAP_SCALE,
        )
        draw.ellipse(
            (
                x - 2 * BITMAP_SCALE,
                y - 2 * BITMAP_SCALE,
                x + 2 * BITMAP_SCALE,
                y + 2 * BITMAP_SCALE,
            ),
            fill=ORANGE,
        )

    # A restrained brand accent keeps the small header connected to the app.
    draw.line(
        tuple(value * BITMAP_SCALE for value in (8, 49, 74, 49)),
        fill=(78, 38, 18),
        width=BITMAP_SCALE,
    )
    draw.line(
        tuple(value * BITMAP_SCALE for value in (8, 51, 48, 51)),
        fill=ORANGE,
        width=BITMAP_SCALE,
    )
    background.save(BUILD / "installerHeader.bmp", format="BMP")


if __name__ == "__main__":
    make_sidebar()
    make_header()
    for name in ("installerSidebar.bmp", "uninstallerSidebar.bmp", "installerHeader.bmp"):
        image = Image.open(BUILD / name)
        print(f"{name}: {image.size[0]}x{image.size[1]} {image.mode}")
