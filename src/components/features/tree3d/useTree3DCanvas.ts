import { useRef, useEffect, useState, useCallback } from "react";
import {
  Tree3DRenderer,
  TreeNode3D,
  SpatialNode,
} from "./Tree3DRenderer";

export interface UseTree3DCanvasOptions {
  data: TreeNode3D[];
  accentColor?: string;
  onSelectNode?: (nodeId: string) => void;
}

export interface UseTree3DCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeNode: SpatialNode | null;
  isVerticalLocked: boolean;
  zoom: number;
  pitch: number;
  isMouseOver: boolean;
  setIsMouseOver: (over: boolean) => void;
  handleClick: (e: React.MouseEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleWheel: (e: React.WheelEvent) => void;
  handleKeyboardNav: (key: string) => void;
  toggleVerticalLock: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  focusOnNode: (nodeId: string) => void;
}

/**
 * React hook connecting a canvas element to the independent Tree3DRenderer engine.
 */
export function useTree3DCanvas({
  data,
  accentColor = "#00e5ff",
  onSelectNode,
}: UseTree3DCanvasOptions): UseTree3DCanvasReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Tree3DRenderer | null>(null);

  // HUD-facing reactive states
  const [activeNode, setActiveNode] = useState<SpatialNode | null>(null);
  const [isVerticalLocked, setIsVerticalLocked] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(0.2);
  const [isMouseOver, setIsMouseOver] = useState<boolean>(false);

  // Initialize renderer engine on canvas mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new Tree3DRenderer({
      canvas,
      accentColor,
      onActiveNodeChange: (node) => {
        setActiveNode(node);
      },
      onSelectNode: (nodeId) => {
        if (onSelectNode) onSelectNode(nodeId);
      },
      onVerticalLockChange: (locked) => {
        setIsVerticalLocked(locked);
      },
      onZoomChange: (newZoom) => {
        setZoom(newZoom);
      },
      onPitchChange: (newPitch) => {
        setPitch(newPitch);
      },
    });

    renderer.setData(data);
    renderer.start();
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Synchronize data changes into renderer
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setData(data);
    }
  }, [data]);

  // Synchronize accentColor changes into renderer
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setAccentColor(accentColor);
    }
  }, [accentColor]);

  // Synchronize onSelectNode callback reference
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setOptions({ onSelectNode });
    }
  }, [onSelectNode]);

  // Mouse click handler
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!rendererRef.current) return;
    const clickedNode = rendererRef.current.getNodeAt(e.clientX, e.clientY);
    if (clickedNode) {
      rendererRef.current.focusOnNode(clickedNode.id);
    }
  }, []);

  // Mouse drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
    if (rendererRef.current) {
      rendererRef.current.startDrag(e.clientX, e.clientY);
    }
  }, []);

  // Mouse move / hover / drag
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (rendererRef.current) {
      rendererRef.current.updateHover(e.clientX, e.clientY);
      rendererRef.current.drag(e.clientX, e.clientY);
    }
  }, []);

  // Mouse drag end
  const handleMouseUp = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.endDrag();
    }
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (rendererRef.current) {
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      rendererRef.current.zoomBy(delta);
    }
  }, []);

  // Keyboard navigation
  const handleKeyboardNav = useCallback((key: string) => {
    if (rendererRef.current) {
      rendererRef.current.navigateKeyboard(key);
    }
  }, []);

  // Global keydown when mouse is hovered
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (
        isMouseOver &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        handleKeyboardNav(e.key);
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [isMouseOver, handleKeyboardNav]);

  const toggleVerticalLock = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.toggleVerticalLock();
    }
  }, []);

  const zoomIn = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.zoomBy(0.15);
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.zoomBy(-0.15);
    }
  }, []);

  const resetView = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.resetView();
    }
  }, []);

  const focusOnNode = useCallback((nodeId: string) => {
    if (rendererRef.current) {
      rendererRef.current.focusOnNode(nodeId);
    }
  }, []);

  return {
    canvasRef,
    containerRef,
    activeNode,
    isVerticalLocked,
    zoom,
    pitch,
    isMouseOver,
    setIsMouseOver,
    handleClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleKeyboardNav,
    toggleVerticalLock,
    zoomIn,
    zoomOut,
    resetView,
    focusOnNode,
  };
}

