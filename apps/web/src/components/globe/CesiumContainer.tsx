'use client'

import { useEffect, useRef, useLayoutEffect } from 'react'
import * as Cesium from 'cesium'
import { eciToEcefMeters } from '@/lib/cesium-utils'
import type { Satellite } from './GlobeView'

export interface SatellitePosition {
  noradId: number
  timestamp: string
  position: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
}

interface Props {
  satellites: Satellite[]
  positions: Map<number, SatellitePosition>
  orbitPoints: Array<{ timestamp: string; position: { x: number; y: number; z: number } }> | null
  selectedNoradId: number | null
  onSelectSatellite: (noradId: number) => void
}

const POINT_COLOR = Cesium.Color.fromCssColorString('#22d3ee') // cyan-400
const POINT_COLOR_SELECTED = Cesium.Color.fromCssColorString('#facc15') // yellow-400
const POINT_SIZE = 4
const POINT_SIZE_SELECTED = 8

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
  onSelectSatellite,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const collectionRef = useRef<Cesium.PointPrimitiveCollection | null>(null)
  const pointsMapRef = useRef<Map<number, Cesium.PointPrimitive>>(new Map())
  const orbitEntityRef = useRef<Cesium.Entity | null>(null)
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null)

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

    // Click-to-select
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction(
      (click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = viewer.scene.pick(click.position)
        if (Cesium.defined(picked) && typeof picked.id === 'number') {
          onSelectSatellite(picked.id as number)
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

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep click handler current without re-init
  const onSelectRef = useRef(onSelectSatellite)
  onSelectRef.current = onSelectSatellite

  // Update satellite point primitives when positions change
  useEffect(() => {
    const collection = collectionRef.current
    const viewer = viewerRef.current
    if (!collection || !viewer || positions.size === 0) return

    positions.forEach((pos, noradId) => {
      const cesiumPos = toCesiumCartesian(pos.position, pos.timestamp)
      const isSelected = noradId === selectedNoradId

      if (pointsMapRef.current.has(noradId)) {
        const point = pointsMapRef.current.get(noradId)!
        point.position = cesiumPos
        point.color = isSelected ? POINT_COLOR_SELECTED : POINT_COLOR
        point.pixelSize = isSelected ? POINT_SIZE_SELECTED : POINT_SIZE
      } else {
        const point = collection.add({
          position: cesiumPos,
          color: isSelected ? POINT_COLOR_SELECTED : POINT_COLOR,
          pixelSize: isSelected ? POINT_SIZE_SELECTED : POINT_SIZE,
          id: noradId,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
          outlineWidth: 1,
        })
        pointsMapRef.current.set(noradId, point)
      }
    })

    viewer.scene.requestRender()
  }, [positions, selectedNoradId])

  // Update selection highlight when selectedNoradId changes without position change
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    pointsMapRef.current.forEach((point, noradId) => {
      const isSelected = noradId === selectedNoradId
      point.color = isSelected ? POINT_COLOR_SELECTED : POINT_COLOR
      point.pixelSize = isSelected ? POINT_SIZE_SELECTED : POINT_SIZE
    })

    // Fly to selected satellite
    if (selectedNoradId !== null) {
      const point = pointsMapRef.current.get(selectedNoradId)
      if (point) {
        viewer.camera.flyToBoundingSphere(
          new Cesium.BoundingSphere(point.position, 3_000_000),
          { duration: 1.5 },
        )
      }
    }

    viewer.scene.requestRender()
  }, [selectedNoradId])

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
