// ============================================
// Mode & Theme Types (as const for stricter typing)
// ============================================

type DockMode = "toolbar" | "mockups" | "grids";
type DockPosition = "top" | "bottom";
type Theme = "light" | "dark";
type MockupAlignmentX = "left" | "center" | "right" | null;
type MockupAlignmentY = "top" | "bottom" | null;
type LayoutGridPosition = "left" | "right" | "center";

// ============================================
// Geometry Types
// ============================================

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

// ============================================
// Entity Types
// ============================================

/** A mockup in the library; the full-size image is stored separately (see getMockupImage) */
interface Mockup {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: number;
  thumbnail: Blob;
  /** Natural size and file size; unknown for mockups uploaded before database version 3 */
  width?: number;
  height?: number;
  fileSize?: number;
}

interface LayoutGridConfig {
  id: string;
  width: string; // CSS length (e.g., "1140px", "100%")
  columns: number;
  gutterWidth: string; // CSS length
  isGutterOnOutside: boolean;
  position: LayoutGridPosition;
  createdAt: number;
}

// ============================================
// Settings Types
// ============================================

interface DockSettings {
  position: DockPosition;
  theme: Theme | null;
}

interface MockupOverlaySettings {
  activeMockupId: string | null;
  isHidden: boolean;
  isLocked: boolean;
  opacity: number;
  position: Position;
  alignmentX: MockupAlignmentX;
  alignmentY: MockupAlignmentY;
  scale: number;
}

interface GridOverlaySettings {
  activeLayoutGridId: string;
  showLayoutGrid: boolean;
  layoutGridColor: string;
  showSpacingGrid: boolean;
  spacingGridColor: string;
  spacingGridHeight: string;
}

interface AppSettings {
  dock: DockSettings;
  mockupOverlay: MockupOverlaySettings;
  gridOverlay: GridOverlaySettings;
}

type SettingGroup = keyof AppSettings;

// ============================================
// Input Types (for creating new entities)
// ============================================

type MockupInput = Omit<Mockup, "id" | "createdAt"> & { image: Blob };
type GridInput = Omit<LayoutGridConfig, "id" | "createdAt">;
