'use client'

import { useCallback, useEffect, useRef, useLayoutEffect, memo } from 'react'
import * as Cesium from 'cesium'
import { eciToEcefMeters } from '@/lib/cesium-utils'
import { SEVERITY_COLORS, type Severity } from '@/lib/severity'
import type { Satellite } from './GlobeView'

export interface SatellitePosition {
  noradId: number
  timestamp: string
  position: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
}

export interface ConjunctionVisual {
  id: string
  riskLevel: Severity
  aNoradId: number
  bNoradId: number
  closestApproachKm: number
  approachPoint: { x: number; y: number; z: number } | null
}

interface Props {
  satellites: Satellite[]
  positions: Map<number, SatellitePosition>
  orbitPoints: Array<{ timestamp: string; position: { x: number; y: number; z: number } }> | null
  selectedNoradId: number | null
  nearbyNoradIds: Set<number>
  conjunctions: ConjunctionVisual[]
  severityBySat: Map<number, Severity>
  selectedConjunctionId: string | null
  onSelectSatellite: (noradId: number) => void
  onSelectConjunction: (id: string) => void
  onReady?: (controls: { resetView: () => void }) => void
}

// Module-level constants — never re-allocated
const COLOR_PAYLOAD = Cesium.Color.fromCssColorString('#22d3ee')
const COLOR_ROCKET = Cesium.Color.fromCssColorString('#f97316')
const COLOR_DEBRIS = Cesium.Color.fromCssColorString('#94a3b8')
const COLOR_SELECTED = Cesium.Color.fromCssColorString('#e8f400')
const COLOR_NEARBY = Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.6)
const POINT_SIZE = 3
const POINT_SIZE_SELECTED = 8
const POINT_SIZE_AT_RISK = 6
const POINT_SIZE_NEARBY = 5
const MAX_CONJUNCTIONS = 50

const SEVERITY_CESIUM_COLORS = Object.fromEntries(
  Object.entries(SEVERITY_COLORS).map(([level, css]) => [
    level,
    Cesium.Color.fromCssColorString(css),
  ]),
) as Record<Severity, Cesium.Color>

const CONJUNCTION_ENTITY_PREFIX = 'conjunction:'

function pointColor(objectType: string): Cesium.Color {
  const t = objectType?.toUpperCase()
  if (t === 'ROCKET BODY') return COLOR_ROCKET
  if (t === 'DEBRIS') return COLOR_DEBRIS
  return COLOR_PAYLOAD
}

// Accepts optional result to allow Cartesian3 reuse across calls
function toCesiumCartesian(
  position: { x: number; y: number; z: number },
  timestamp: string,
  result?: Cesium.Cartesian3,
): Cesium.Cartesian3 {
  const [x, y, z] = eciToEcefMeters(position, new Date(timestamp))
  if (result) {
    result.x = x
    result.y = y
    result.z = z
    return result
  }
  return new Cesium.Cartesian3(x, y, z)
}

export const CesiumContainer = memo(function CesiumContainer({
  satellites,
  positions,
  orbitPoints,
  selectedNoradId,
  nearbyNoradIds,
  conjunctions,
  severityBySat,
  selectedConjunctionId,
  onSelectSatellite,
  onSelectConjunction,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const collectionRef = useRef<Cesium.PointPrimitiveCollection | null>(null)
  const pointsMapRef = useRef<Map<number, Cesium.PointPrimitive>>(new Map())
  const orbitEntityRef = useRef<Cesium.Entity | null>(null)
  const conjunctionEntitiesRef = useRef<Cesium.Entity[]>([])
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null)
  const satTypeMap = useRef<Map<number, string>>(new Map())
  // Live position state for the rAF animation loop — updated from API, read every frame
  const livePositionsRef = useRef<Map<number, {
    pos: { x: number; y: number; z: number }
    vel: { x: number; y: number; z: number }
    t: number
  }>>(new Map())

  useEffect(() => {
    satTypeMap.current = new Map(satellites.map((s) => [s.noradId, s.objectType]))
  }, [satellites])

  useLayoutEffect(() => {
    if (!containerRef.current) return

    ;(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium/'

    // CSS flex chain resolves to 0×0 at init — measure directly from the DOM
    const aside = document.querySelector('aside')
    const header = document.querySelector('header')
    const sidebarW = aside?.offsetWidth ?? 256
    const headerH = header?.offsetHeight ?? 0
    containerRef.current.style.width = (window.innerWidth - sidebarW) + 'px'
    containerRef.current.style.height = (window.innerHeight - headerH) + 'px'

    const imageryProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 10,
    })

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      baseLayer: new Cesium.ImageryLayer(imageryProvider),
      // Only re-render when explicitly requested — biggest single perf win
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      useBrowserRecommendedResolution: false,
      // Disable MSAA — not worth the cost for point primitives
      msaaSamples: 1,
      // Disable translucency sorting — not needed for our scene
      orderIndependentTranslucency: false,
      // Saves ~15% GPU memory; we never need alpha in the backbuffer
      contextOptions: {
        webgl: {
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance' as WebGLPowerPreference,
          stencil: false,
          depth: true,
        },
      },
      scene3DOnly: true,
    })

    // Globe settings
    // Render at 1.5× max on retina — 44% fewer pixels vs native 2×
    viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5)

    viewer.scene.globe.enableLighting = false
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false
    viewer.scene.globe.showGroundAtmosphere = false
    viewer.scene.backgroundColor = Cesium.Color.BLACK
    // Coarser LOD — at orbital altitude tile detail barely matters
    viewer.scene.globe.maximumScreenSpaceError = 24
    viewer.scene.globe.tileCacheSize = 300
    viewer.scene.fog.enabled = false

    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        maximumLevel: 10,
      }),
    )

    const collection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
    collectionRef.current = collection

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction(
      (click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = viewer.scene.pick(click.position)
        if (!Cesium.defined(picked)) return
        if (typeof picked.id === 'number') {
          onSelectRef.current(picked.id as number)
        } else if (
          picked.id instanceof Cesium.Entity &&
          picked.id.id.startsWith(CONJUNCTION_ENTITY_PREFIX)
        ) {
          const conjunctionId = picked.id.id
            .slice(CONJUNCTION_ENTITY_PREFIX.length)
            .replace(/:(line|marker)$/, '')
          onSelectConjunctionRef.current(conjunctionId)
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    )
    handlerRef.current = handler
    viewerRef.current = viewer

    onReady?.({
      resetView: () => {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(0, 20, 22_000_000),
          orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
          duration: 1.5,
        })
      },
    })

    const resizeObserver = new ResizeObserver(() => {
      if (viewer.isDestroyed()) return
      viewer.resize()
      viewer.scene.requestRender()
    })
    resizeObserver.observe(containerRef.current)

    setTimeout(() => {
      if (viewer.isDestroyed()) return
      viewer.resize()
      viewer.scene.requestRender()
    }, 0)

    // Smooth animation loop — extrapolates each satellite's position every frame
    // using pos + vel × dt. GMST is computed once per frame for all satellites.
    const animScratch = new Cesium.Cartesian3()
    let animId: number
    function animate() {
      if (viewer.isDestroyed()) return
      const nowMs = Date.now()
      const jd = nowMs / 86400000.0 + 2440587.5
      const T = (jd - 2451545.0) / 36525.0
      const deg =
        280.46061837 +
        360.98564736629 * (jd - 2451545.0) +
        0.000387933 * T * T -
        (T * T * T) / 38710000.0
      const gmst = (((deg % 360) + 360) % 360) * (Math.PI / 180)
      const cosG = Math.cos(gmst)
      const sinG = Math.sin(gmst)

      let dirty = false
      livePositionsRef.current.forEach(({ pos, vel, t }, noradId) => {
        const point = pointsMapRef.current.get(noradId)
        if (!point) return
        const dt = (nowMs - t) / 1000
        const ex = pos.x + vel.x * dt
        const ey = pos.y + vel.y * dt
        const ez = pos.z + vel.z * dt
        animScratch.x = (ex * cosG + ey * sinG) * 1000
        animScratch.y = (-ex * sinG + ey * cosG) * 1000
        animScratch.z = ez * 1000
        point.position = animScratch
        dirty = true
      })

      if (dirty) viewer.scene.requestRender()
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      resizeObserver.disconnect()
      handler.destroy()
      viewer.destroy()
      viewerRef.current = null
      collectionRef.current = null
      handlerRef.current = null
      pointsMapRef.current.clear()
      livePositionsRef.current.clear()
      conjunctionEntitiesRef.current = []
      orbitEntityRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSelectRef = useRef(onSelectSatellite)
  onSelectRef.current = onSelectSatellite
  const onSelectConjunctionRef = useRef(onSelectConjunction)
  onSelectConjunctionRef.current = onSelectConjunction

  const stylePoint = useCallback(
    (point: Cesium.PointPrimitive, noradId: number) => {
      const isSelected = noradId === selectedNoradId
      const isNearby = nearbyNoradIds.has(noradId)
      const severity = severityBySat.get(noradId)
      point.color = isSelected
        ? COLOR_SELECTED
        : severity
          ? SEVERITY_CESIUM_COLORS[severity]
          : isNearby
            ? COLOR_NEARBY
            : pointColor(satTypeMap.current.get(noradId) ?? '')
      point.pixelSize = isSelected
        ? POINT_SIZE_SELECTED
        : severity
          ? POINT_SIZE_AT_RISK
          : isNearby
            ? POINT_SIZE_NEARBY
            : POINT_SIZE
    },
    [selectedNoradId, severityBySat, nearbyNoradIds],
  )

  // Sync API position data → livePositionsRef (animation loop reads this every frame)
  // Also handles adding/removing points from the Cesium collection.
  useEffect(() => {
    const collection = collectionRef.current
    const viewer = viewerRef.current
    if (!collection || !viewer || positions.size === 0) return

    const toRemove: number[] = []
    pointsMapRef.current.forEach((_, noradId) => {
      if (!positions.has(noradId)) toRemove.push(noradId)
    })
    toRemove.forEach((noradId) => {
      collection.remove(pointsMapRef.current.get(noradId)!)
      pointsMapRef.current.delete(noradId)
      livePositionsRef.current.delete(noradId)
    })

    positions.forEach((pos, noradId) => {
      // Feed the animation loop with fresh reference data
      livePositionsRef.current.set(noradId, {
        pos: pos.position,
        vel: pos.velocity,
        t: new Date(pos.timestamp).getTime(),
      })

      if (pointsMapRef.current.has(noradId)) {
        stylePoint(pointsMapRef.current.get(noradId)!, noradId)
      } else {
        // Initial placement — animation loop takes over immediately after
        const point = collection.add({
          position: toCesiumCartesian(pos.position, pos.timestamp),
          id: noradId,
        })
        stylePoint(point, noradId)
        pointsMapRef.current.set(noradId, point)
      }
    })

    viewer.scene.requestRender()
  }, [positions, stylePoint])

  // Restyle all points when selection or severity changes
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    pointsMapRef.current.forEach((point, noradId) => stylePoint(point, noradId))
    viewer.scene.requestRender()
  }, [stylePoint])

  // Fly to selected satellite
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || selectedNoradId === null) return
    const point = pointsMapRef.current.get(selectedNoradId)
    if (point) {
      viewer.camera.flyToBoundingSphere(
        new Cesium.BoundingSphere(point.position, 3_000_000),
        { duration: 1.5 },
      )
    }
  }, [selectedNoradId])

  // Conjunction lines and approach markers — cap at MAX_CONJUNCTIONS
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    conjunctionEntitiesRef.current.forEach((e) => viewer.entities.remove(e))
    conjunctionEntitiesRef.current = []

    for (const conj of conjunctions.slice(0, MAX_CONJUNCTIONS)) {
      const isSelected = conj.id === selectedConjunctionId
      const color = SEVERITY_CESIUM_COLORS[conj.riskLevel]
      const posA = positions.get(conj.aNoradId)
      const posB = positions.get(conj.bNoradId)

      if (posA && posB) {
        const line = viewer.entities.add({
          id: `${CONJUNCTION_ENTITY_PREFIX}${conj.id}:line`,
          polyline: {
            positions: [
              toCesiumCartesian(posA.position, posA.timestamp),
              toCesiumCartesian(posB.position, posB.timestamp),
            ],
            width: isSelected ? 3 : 1.5,
            material: new Cesium.PolylineDashMaterialProperty({
              color: color.withAlpha(isSelected ? 1 : 0.65),
              dashLength: 16,
            }),
          },
        })
        conjunctionEntitiesRef.current.push(line)
      }

      if (conj.approachPoint) {
        const marker = viewer.entities.add({
          id: `${CONJUNCTION_ENTITY_PREFIX}${conj.id}:marker`,
          position: new Cesium.Cartesian3(
            conj.approachPoint.x,
            conj.approachPoint.y,
            conj.approachPoint.z,
          ),
          point: {
            pixelSize: isSelected ? 14 : 10,
            color: color.withAlpha(0.9),
            outlineColor: Cesium.Color.WHITE.withAlpha(isSelected ? 0.9 : 0.5),
            outlineWidth: 2,
          },
          label: {
            text:
              conj.closestApproachKm < 1
                ? `${(conj.closestApproachKm * 1000).toFixed(0)} m`
                : `${conj.closestApproachKm.toFixed(2)} km`,
            font: '11px monospace',
            fillColor: color,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
            pixelOffset: new Cesium.Cartesian2(0, -18),
            show: isSelected,
          },
        })
        conjunctionEntitiesRef.current.push(marker)
      }
    }

    viewer.scene.requestRender()
  }, [conjunctions, positions, selectedConjunctionId])

  // Fly to selected conjunction approach point (once per selection)
  const flownConjunctionRef = useRef<string | null>(null)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || selectedConjunctionId === null) {
      flownConjunctionRef.current = null
      return
    }
    if (flownConjunctionRef.current === selectedConjunctionId) return
    const conj = conjunctions.find((c) => c.id === selectedConjunctionId)
    if (!conj?.approachPoint) return
    flownConjunctionRef.current = selectedConjunctionId
    viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(
        new Cesium.Cartesian3(
          conj.approachPoint.x,
          conj.approachPoint.y,
          conj.approachPoint.z,
        ),
        2_000_000,
      ),
      { duration: 1.5 },
    )
  }, [selectedConjunctionId, conjunctions])

  // Orbit track
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (orbitEntityRef.current) {
      viewer.entities.remove(orbitEntityRef.current)
      orbitEntityRef.current = null
    }

    if (orbitPoints && orbitPoints.length >= 2) {
      const ecefPositions = orbitPoints.map((p) => {
        const [x, y, z] = eciToEcefMeters(p.position, new Date(p.timestamp))
        return new Cesium.Cartesian3(x, y, z)
      })

      orbitEntityRef.current = viewer.entities.add({
        polyline: {
          positions: ecefPositions,
          width: 1.5,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString('#22d3ee').withAlpha(0.5),
          ),
          clampToGround: false,
        },
      })
    }

    viewer.scene.requestRender()
  }, [orbitPoints])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ background: '#000' }}
    />
  )
})

CesiumContainer.displayName = 'CesiumContainer'
