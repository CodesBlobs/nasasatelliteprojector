'use client'

import { useCallback, useEffect, useRef, useLayoutEffect } from 'react'
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
  // ECEF meters; null until the predicted approach point has been propagated
  approachPoint: { x: number; y: number; z: number } | null
}

interface Props {
  satellites: Satellite[]
  positions: Map<number, SatellitePosition>
  orbitPoints: Array<{ timestamp: string; position: { x: number; y: number; z: number } }> | null
  selectedNoradId: number | null
  conjunctions: ConjunctionVisual[]
  severityBySat: Map<number, Severity>
  selectedConjunctionId: string | null
  onSelectSatellite: (noradId: number) => void
  onSelectConjunction: (id: string) => void
}

const COLOR_PAYLOAD = Cesium.Color.fromCssColorString('#22d3ee')
const COLOR_ROCKET = Cesium.Color.fromCssColorString('#f97316')
const COLOR_DEBRIS = Cesium.Color.fromCssColorString('#94a3b8')
const COLOR_SELECTED = Cesium.Color.fromCssColorString('#e8f400')
const POINT_SIZE = 3
const POINT_SIZE_SELECTED = 8
const POINT_SIZE_AT_RISK = 6

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

function toCesiumCartesian(
  position: { x: number; y: number; z: number },
  timestamp: string,
): Cesium.Cartesian3 {
  const [x, y, z] = eciToEcefMeters(position, new Date(timestamp))
  return new Cesium.Cartesian3(x, y, z)
}

export function CesiumContainer({
  satellites,
  positions,
  orbitPoints,
  selectedNoradId,
  conjunctions,
  severityBySat,
  selectedConjunctionId,
  onSelectSatellite,
  onSelectConjunction,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const collectionRef = useRef<Cesium.PointPrimitiveCollection | null>(null)
  const pointsMapRef = useRef<Map<number, Cesium.PointPrimitive>>(new Map())
  const orbitEntityRef = useRef<Cesium.Entity | null>(null)
  const conjunctionEntitiesRef = useRef<Cesium.Entity[]>([])
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null)
  const satTypeMap = useRef<Map<number, string>>(new Map())

  useEffect(() => {
    satTypeMap.current = new Map(satellites.map((s) => [s.noradId, s.objectType]))
  }, [satellites])

  // Initialize viewer once
  useLayoutEffect(() => {
    if (!containerRef.current) return

      ;(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium/'
      // CSS Chain resolves 0x0 at start so i have to fucking resize it
      const aside = document.querySelector('aside')
      const header = document.querySelector('header')
      const sidebarW = aside?.offsetWidth ?? 256
      const headerH = header?.offsetHeight ?? 0
      containerRef.current.style.width = (window.innerWidth - sidebarW) + 'px'
      containerRef.current.style.height = (window.innerHeight - headerH) + 'px'


    // UrlTemplateImageryProvider is synchronous — avoids silent async failures.
    // {reverseY} flips the Y axis to match TMS geodetic tile coordinates.
    const imageryProvider = new Cesium.UrlTemplateImageryProvider({
      url: '/cesium/Assets/Textures/NaturalEarthII/{z}/{x}/{reverseY}.jpg',
      tilingScheme: new Cesium.GeographicTilingScheme(),
      tileWidth: 256,
      tileHeight: 256,
      minimumLevel: 0,
      maximumLevel: 2,
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
    })

    viewer.scene.globe.enableLighting = true
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true
    viewer.scene.backgroundColor = Cesium.Color.BLACK
    viewer.scene.globe.atmosphereLightIntensity = 20.0

    // Use PointPrimitiveCollection for performance (100–500 satellites)
    const collection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
    collectionRef.current = collection

    // Click-to-select: satellites are point primitives with numeric ids,
    // conjunction lines/markers are entities with prefixed string ids
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction(
      (click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = viewer.scene.pick(click.position)
        if (!Cesium.defined(picked)) return
        if (typeof picked.id === 'number') {
          onSelectRef.current(picked.id as number)
        } else if (picked.id instanceof Cesium.Entity && picked.id.id.startsWith(CONJUNCTION_ENTITY_PREFIX)) {
          const conjunctionId = picked.id.id.slice(CONJUNCTION_ENTITY_PREFIX.length).replace(/:(line|marker)$/, '')
          onSelectConjunctionRef.current(conjunctionId)
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    )
    handlerRef.current = handler
    viewerRef.current = viewer

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

    return () => {
      resizeObserver.disconnect()
      handler.destroy()
      viewer.destroy()
      viewerRef.current = null
      collectionRef.current = null
      handlerRef.current = null
      pointsMapRef.current.clear()
      conjunctionEntitiesRef.current = []
      orbitEntityRef.current = null

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep click handlers current without re-init
  const onSelectRef = useRef(onSelectSatellite)
  onSelectRef.current = onSelectSatellite
  const onSelectConjunctionRef = useRef(onSelectConjunction)
  onSelectConjunctionRef.current = onSelectConjunction

  // Selection wins over risk, risk wins over object-type color
  const stylePoint = useCallback(
    (point: Cesium.PointPrimitive, noradId: number) => {
      const isSelected = noradId === selectedNoradId
      const severity = severityBySat.get(noradId)
      point.color = isSelected
        ? COLOR_SELECTED
        : severity
          ? SEVERITY_CESIUM_COLORS[severity]
          : pointColor(satTypeMap.current.get(noradId) ?? '')
      point.pixelSize = isSelected
        ? POINT_SIZE_SELECTED
        : severity
          ? POINT_SIZE_AT_RISK
          : POINT_SIZE
    },
    [selectedNoradId, severityBySat],
  )

  // Update satellite point primitives when positions change
  useEffect(() => {
    const collection = collectionRef.current
    const viewer = viewerRef.current
    if (!collection || !viewer || positions.size === 0) return

    // Remove points no longer in the visible set
    const toRemove: number[] = []
    pointsMapRef.current.forEach((_, noradId) => {
      if (!positions.has(noradId)) toRemove.push(noradId)
    })
    toRemove.forEach((noradId) => {
      collection.remove(pointsMapRef.current.get(noradId)!)
      pointsMapRef.current.delete(noradId)
    })

    positions.forEach((pos, noradId) => {
      const cesiumPos = toCesiumCartesian(pos.position, pos.timestamp)

      if (pointsMapRef.current.has(noradId)) {
        const point = pointsMapRef.current.get(noradId)!
        point.position = cesiumPos
        stylePoint(point, noradId)
      } else {
        const point = collection.add({
          position: cesiumPos,
          id: noradId,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
          outlineWidth: 1,
        })
        stylePoint(point, noradId)
        pointsMapRef.current.set(noradId, point)
      }
    })

    viewer.scene.requestRender()
  }, [positions, stylePoint])

  // Update selection highlight when selectedNoradId changes without position change
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

  // Render conjunction warning lines and predicted approach markers
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    conjunctionEntitiesRef.current.forEach((e) => viewer.entities.remove(e))
    conjunctionEntitiesRef.current = []

    for (const conj of conjunctions) {
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
            text: `${conj.closestApproachKm < 1 ? `${(conj.closestApproachKm * 1000).toFixed(0)} m` : `${conj.closestApproachKm.toFixed(2)} km`}`,
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

  // Fly to selected conjunction's predicted approach point (once per selection,
  // deferred until the approach point has been propagated)
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
        new Cesium.Cartesian3(conj.approachPoint.x, conj.approachPoint.y, conj.approachPoint.z),
        2_000_000,
      ),
      { duration: 1.5 },
    )
  }, [selectedConjunctionId, conjunctions])

  // Update orbit track for selected satellite
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
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.15,
            color: Cesium.Color.fromCssColorString('#22d3ee').withAlpha(0.6),
          }),
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
}
