// ============================================
// Grid Settings
// ============================================

const DEFAULT_GRID_TEMPLATE: Omit<LayoutGridConfig, "id" | "createdAt"> = {
  width: "1044px",
  columns: 12,
  gutterWidth: "24px",
  isGutterOnOutside: false,
  position: "center"
};

const DEFAULT_GRID_OVERLAY_SETTINGS: Omit<GridOverlaySettings, "activeLayoutGridId"> = {
  showLayoutGrid: false,
  layoutGridColor: "rgba(0, 0, 255, 0.05)",
  showSpacingGrid: false,
  spacingGridColor: "rgba(255, 0, 0, 0.05)",
  spacingGridHeight: "8px"
};

// ============================================
// Mockup Settings
// ============================================

const MOCKUP_THUMBNAIL_SIZE = 352;

// Opacity settings
const OPACITY_STEP = 0.05;
const OPACITY_MIN = 0.1;
const OPACITY_MAX = 0.9;
const OPACITY_DEFAULT = 0.5;

// Scale settings
const SCALE_OPTIONS = [0.5, 1] as const;
const ZOOM_FACTOR = 2;

// Pinch zoom & custom scale range
const PINCH_SCALE_MIN = 0.25;
const PINCH_SCALE_MAX = 4;

// ============================================
// File Upload Settings
// ============================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

// ============================================
// Touch Settings
// ============================================

// Double-tap detection window (ms)
const DOUBLE_TAP_DELAY = 300;

// Minimum movement (px) before considering it a drag vs tap
// MockupOverlay uses smaller threshold for precision
const DRAG_THRESHOLD = 5;

// Global double-tap uses larger threshold (more forgiving on whole page)
const DRAG_THRESHOLD_GLOBAL = 10;

// Cooldown after scroll before accepting taps (prevents accidental double-tap)
const SCROLL_COOLDOWN = 150;

// ============================================
// Validation Limits
// ============================================

const GRID_COLUMNS_MIN = 1;
const GRID_COLUMNS_MAX = 100;

export {
  ALLOWED_MIME_TYPES,
  DEFAULT_GRID_OVERLAY_SETTINGS,
  DEFAULT_GRID_TEMPLATE,
  DOUBLE_TAP_DELAY,
  DRAG_THRESHOLD,
  DRAG_THRESHOLD_GLOBAL,
  GRID_COLUMNS_MAX,
  GRID_COLUMNS_MIN,
  MAX_FILE_SIZE,
  MOCKUP_THUMBNAIL_SIZE,
  OPACITY_DEFAULT,
  OPACITY_MAX,
  OPACITY_MIN,
  OPACITY_STEP,
  PINCH_SCALE_MAX,
  PINCH_SCALE_MIN,
  SCALE_OPTIONS,
  SCROLL_COOLDOWN,
  ZOOM_FACTOR
};
